import { Schema } from "effect";

const lowercaseAscii = "abcdefghijklmnopqrstuvwxyz";
const uppercaseAscii = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const digits = "0123456789";
const globallyAllowedAscii = `${lowercaseAscii}${uppercaseAscii}${digits}`;
const internallyAllowedAscii = `${globallyAllowedAscii}-_ `;

const codePoint = (character: string) => character.codePointAt(0);

const isGloballyAllowedCharacter = (character: string) => {
	const point = codePoint(character);
	return point !== undefined && (point >= 0x80 || globallyAllowedAscii.includes(character));
};

const isInternallyAllowedCharacter = (character: string) => {
	const point = codePoint(character);
	return point !== undefined && (point >= 0x80 || internallyAllowedAscii.includes(character));
};

const isLowercaseAsciiName = (value: string) =>
	value.length > 0 && Array.from(value).every((character) => lowercaseAscii.includes(character));

const isAlphanumericAsciiName = (value: string) =>
	value.length > 0 &&
	Array.from(value).every((character) => globallyAllowedAscii.includes(character));

const memberNameIssue =
	"JSON:API member names must be non-empty, start and end with a globally allowed character, and contain only allowed member-name characters";

/**
 * Returns whether a value is a legal JSON:API member name.
 *
 * Member names must be non-empty, start and end with a globally allowed
 * character, and contain only JSON:API member-name characters internally.
 *
 * @example
 * ```ts
 * isMemberName("published-at"); // true
 * isMemberName(" published "); // false
 * ```
 */
export const isMemberName = (value: string): boolean => {
	const characters = Array.from(value);
	if (characters.length === 0) {
		return false;
	}
	const first = characters[0];
	const last = characters[characters.length - 1];
	if (first === undefined || last === undefined) {
		return false;
	}
	return (
		isGloballyAllowedCharacter(first) &&
		isGloballyAllowedCharacter(last) &&
		characters.every(isInternallyAllowedCharacter)
	);
};

/**
 * Returns whether a value is a legal JSON:API @-member name.
 *
 * @example
 * ```ts
 * isAtMemberName("@context"); // true
 * isAtMemberName("context"); // false
 * ```
 */
export const isAtMemberName = (value: string): boolean => {
	const name = value.slice(1);
	return value.startsWith("@") && isMemberName(name);
};

/**
 * Returns whether a value is a legal JSON:API extension namespace.
 *
 * Extension namespaces are ASCII alphanumeric and are used before the colon in
 * extension member and query parameter names.
 *
 * @example
 * ```ts
 * isExtensionNamespace("version1"); // true
 * isExtensionNamespace("version-id"); // false
 * ```
 */
export const isExtensionNamespace = isAlphanumericAsciiName;

/**
 * Returns whether a value is a legal JSON:API extension member name.
 *
 * @example
 * ```ts
 * isExtensionMemberName("version:id"); // true
 * isExtensionMemberName("version:id:extra"); // false
 * ```
 */
export const isExtensionMemberName = (value: string): boolean => {
	const separatorIndex = value.indexOf(":");
	if (separatorIndex <= 0 || separatorIndex !== value.lastIndexOf(":")) {
		return false;
	}
	const namespace = value.slice(0, separatorIndex);
	const name = value.slice(separatorIndex + 1);
	return isExtensionNamespace(namespace) && isMemberName(name);
};

/**
 * Returns whether a value can be used as a JSON:API object member name.
 *
 * This accepts regular member names, @-members, and extension member names.
 *
 * @example
 * ```ts
 * isObjectMemberName("links"); // true
 * isObjectMemberName("@context"); // true
 * isObjectMemberName("version:id"); // true
 * ```
 */
export const isObjectMemberName = (value: string): boolean =>
	isMemberName(value) || isAtMemberName(value) || isExtensionMemberName(value);

/**
 * Returns whether a value is a legal JSON:API resource field name.
 *
 * Field names share the object member-name rules but cannot be `type` or `id`.
 *
 * @example
 * ```ts
 * isFieldName("title"); // true
 * isFieldName("type"); // false
 * ```
 */
export const isFieldName = (value: string): boolean =>
	isObjectMemberName(value) && value !== "type" && value !== "id";

/**
 * Returns whether a value is a dot-separated relationship path.
 *
 * @example
 * ```ts
 * isRelationshipPath("author.organization"); // true
 * isRelationshipPath("author..organization"); // false
 * ```
 */
export const isRelationshipPath = (value: string): boolean =>
	value.length > 0 && value.split(".").every(isMemberName);

/**
 * Returns whether a value is empty or a comma-separated list of relationship paths.
 *
 * This matches the JSON:API `include` query parameter value shape.
 *
 * @example
 * ```ts
 * isCommaSeparatedRelationshipPaths("author,comments.author"); // true
 * isCommaSeparatedRelationshipPaths(""); // true
 * ```
 */
export const isCommaSeparatedRelationshipPaths = (value: string): boolean =>
	value === "" || value.split(",").every(isRelationshipPath);

/**
 * Returns whether a value is empty or a comma-separated list of field names.
 *
 * This matches the JSON:API sparse fieldset query parameter value shape.
 *
 * @example
 * ```ts
 * isCommaSeparatedFieldNames("title,body"); // true
 * isCommaSeparatedFieldNames("type"); // false
 * ```
 */
export const isCommaSeparatedFieldNames = (value: string): boolean =>
	value === "" || value.split(",").every(isFieldName);

/**
 * Returns whether a value is a sort field path with an optional descending marker.
 *
 * @example
 * ```ts
 * isSortField("-publishedAt"); // true
 * isSortField("--publishedAt"); // false
 * ```
 */
export const isSortField = (value: string): boolean => {
	const field = value.startsWith("-") ? value.slice(1) : value;
	return isRelationshipPath(field);
};

/**
 * Returns whether a value is a non-empty comma-separated list of sort fields.
 *
 * @example
 * ```ts
 * isCommaSeparatedSortFields("-publishedAt,title"); // true
 * isCommaSeparatedSortFields(""); // false
 * ```
 */
export const isCommaSeparatedSortFields = (value: string): boolean =>
	value.length > 0 && value.split(",").every(isSortField);

/**
 * Returns whether a value is a legal extension query parameter base name.
 *
 * Extension query parameter names use `namespace:lowercasename` before any
 * query-family brackets.
 *
 * @example
 * ```ts
 * isExtensionQueryParameterBaseName("version:id"); // true
 * isExtensionQueryParameterBaseName("version:Id"); // false
 * ```
 */
export const isExtensionQueryParameterBaseName = (value: string): boolean => {
	const separatorIndex = value.indexOf(":");
	if (separatorIndex <= 0 || separatorIndex !== value.lastIndexOf(":")) {
		return false;
	}
	const namespace = value.slice(0, separatorIndex);
	const name = value.slice(separatorIndex + 1);
	return isExtensionNamespace(namespace) && isLowercaseAsciiName(name);
};

/**
 * Returns whether a value is a legal implementation-specific query parameter base name.
 *
 * Lowercase ASCII names are reserved for future JSON:API standard query
 * parameters, so implementation-specific base names must not be purely
 * lowercase ASCII.
 *
 * @example
 * ```ts
 * isImplementationQueryParameterBaseName("page-size"); // true
 * isImplementationQueryParameterBaseName("page"); // false
 * ```
 */
export const isImplementationQueryParameterBaseName = (value: string): boolean =>
	isMemberName(value) && !isLowercaseAsciiName(value);

/**
 * Schema for a JSON:API implementation or profile-defined member name.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(MemberName)("published-at");
 * ```
 */
export const MemberName = Schema.String.check(
	Schema.makeFilter((value) => (isMemberName(value) ? undefined : memberNameIssue)),
).annotate({
	identifier: "JsonApiMemberName",
	description: "A JSON:API implementation or profile-defined member name.",
});

/**
 * Schema for a JSON:API @-member name.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(AtMemberName)("@context");
 * ```
 */
export const AtMemberName = Schema.String.check(
	Schema.makeFilter((value) =>
		isAtMemberName(value)
			? undefined
			: "JSON:API @-member names must begin with @ followed by a legal member name",
	),
).annotate({
	identifier: "JsonApiAtMemberName",
	description: "A JSON:API @-member name.",
});

/**
 * Schema for a JSON:API extension namespace.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ExtensionNamespace)("version");
 * ```
 */
export const ExtensionNamespace = Schema.String.check(
	Schema.makeFilter((value) =>
		isExtensionNamespace(value)
			? undefined
			: "JSON:API extension namespaces must contain only ASCII letters and digits",
	),
).annotate({
	identifier: "JsonApiExtensionNamespace",
	description: "A JSON:API extension namespace.",
});

/**
 * Schema for a JSON:API extension member name.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ExtensionMemberName)("version:id");
 * ```
 */
export const ExtensionMemberName = Schema.String.check(
	Schema.makeFilter((value) =>
		isExtensionMemberName(value)
			? undefined
			: "JSON:API extension member names must be namespace-prefixed with a legal member name",
	),
).annotate({
	identifier: "JsonApiExtensionMemberName",
	description: "A JSON:API extension member name.",
});

/**
 * Schema for any JSON:API object member name accepted by this module.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ObjectMemberName)("links");
 * Schema.decodeUnknownSync(ObjectMemberName)("@context");
 * Schema.decodeUnknownSync(ObjectMemberName)("version:id");
 * ```
 */
export const ObjectMemberName = Schema.Union([
	MemberName,
	AtMemberName,
	ExtensionMemberName,
]).annotate({
	identifier: "JsonApiObjectMemberName",
	description: "A JSON:API object member name, including extension and @-members.",
});

/**
 * Schema for a JSON:API resource field name.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(FieldName)("title");
 * ```
 */
export const FieldName = Schema.String.check(
	Schema.makeFilter((value) =>
		isFieldName(value)
			? undefined
			: "JSON:API field names must be legal member names and must not be type or id",
	),
).annotate({
	identifier: "JsonApiFieldName",
	description: "A JSON:API resource field name.",
});

/**
 * Schema for a dot-separated JSON:API relationship path.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(RelationshipPath)("comments.author");
 * ```
 */
export const RelationshipPath = Schema.String.check(
	Schema.makeFilter((value) =>
		isRelationshipPath(value)
			? undefined
			: "JSON:API relationship paths must be dot-separated legal member names",
	),
).annotate({
	identifier: "JsonApiRelationshipPath",
	description: "A dot-separated JSON:API relationship path.",
});

/**
 * Schema for the JSON:API `include` query parameter value.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(IncludeParameter)("author,comments.author");
 * ```
 */
export const IncludeParameter = Schema.String.check(
	Schema.makeFilter((value) =>
		isCommaSeparatedRelationshipPaths(value)
			? undefined
			: "The include query parameter must be empty or a comma-separated list of relationship paths",
	),
).annotate({
	identifier: "JsonApiIncludeParameter",
	description: "The JSON:API include query parameter value.",
});

/**
 * Schema for a JSON:API sparse fieldset query parameter value.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(SparseFieldsetParameter)("title,body,author");
 * ```
 */
export const SparseFieldsetParameter = Schema.String.check(
	Schema.makeFilter((value) =>
		isCommaSeparatedFieldNames(value)
			? undefined
			: "Sparse fieldset query parameter values must be empty or comma-separated legal field names",
	),
).annotate({
	identifier: "JsonApiSparseFieldsetParameter",
	description: "The JSON:API fields[TYPE] query parameter value.",
});

/**
 * Schema for the JSON:API `sort` query parameter value.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(SortParameter)("-publishedAt,title");
 * ```
 */
export const SortParameter = Schema.String.check(
	Schema.makeFilter((value) =>
		isCommaSeparatedSortFields(value)
			? undefined
			: "The sort query parameter must be a comma-separated list of field paths optionally prefixed with -",
	),
).annotate({
	identifier: "JsonApiSortParameter",
	description: "The JSON:API sort query parameter value.",
});
