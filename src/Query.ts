import { Schema } from "effect";
import type { ErrorObject } from "./Error.js";
import {
	IncludeParameter,
	SortParameter,
	SparseFieldsetParameter,
	isExtensionQueryParameterBaseName,
	isImplementationQueryParameterBaseName,
	isMemberName,
	isRelationshipPath,
} from "./MemberName.js";

/**
 * Classification for a JSON:API query parameter name.
 */
export type QueryParameterKind = "standard" | "extension" | "implementation" | "invalid";

/**
 * Standard JSON:API query parameter base names supported by this module.
 */
export const STANDARD_QUERY_PARAMETER_BASE_NAMES = ["include", "fields", "sort", "page", "filter"];

const familyEnabledStandardBaseNames = new Set(["fields", "page", "filter"]);

/**
 * Returns the base name for a JSON:API query parameter family member.
 *
 * @example
 * ```ts
 * queryParameterBaseName("fields[articles]"); // "fields"
 * queryParameterBaseName("include"); // "include"
 * ```
 */
export const queryParameterBaseName = (name: string) => {
	const bracketIndex = name.indexOf("[");
	return bracketIndex === -1 ? name : name.slice(0, bracketIndex);
};

const familySegments = (name: string, baseName: string): ReadonlyArray<string> | undefined => {
	if (!name.startsWith(baseName)) {
		return undefined;
	}
	let rest = name.slice(baseName.length);
	const segments: Array<string> = [];
	while (rest.length > 0) {
		if (!rest.startsWith("[")) {
			return undefined;
		}
		const end = rest.indexOf("]");
		if (end === -1) {
			return undefined;
		}
		segments.push(rest.slice(1, end));
		rest = rest.slice(end + 1);
	}
	return segments;
};

/**
 * Returns whether a name belongs to a query parameter family.
 *
 * Family segments must be empty or valid relationship paths.
 *
 * @example
 * ```ts
 * isQueryParameterFamilyMember("fields", "fields[articles]"); // true
 * isQueryParameterFamilyMember("fields", "fields[articles][author]"); // true
 * ```
 */
export const isQueryParameterFamilyMember = (baseName: string, name: string): boolean => {
	const segments = familySegments(name, baseName);
	return (
		segments !== undefined &&
		segments.every((segment) => segment === "" || isRelationshipPath(segment))
	);
};

/**
 * Returns whether a query parameter name is defined by the JSON:API specification.
 *
 * Fixed standard parameters such as `include` and `sort` cannot use family
 * brackets. Family-enabled standard parameters include `fields`, `page`, and
 * `filter`.
 *
 * @example
 * ```ts
 * isStandardQueryParameterName("include"); // true
 * isStandardQueryParameterName("fields[articles]"); // true
 * isStandardQueryParameterName("include[author]"); // false
 * ```
 */
export const isStandardQueryParameterName = (name: string): boolean => {
	const baseName = queryParameterBaseName(name);
	if (baseName === "include" || baseName === "sort") {
		return name === baseName;
	}
	return (
		familyEnabledStandardBaseNames.has(baseName) && isQueryParameterFamilyMember(baseName, name)
	);
};

/**
 * Returns whether a query parameter name is defined by a JSON:API extension.
 *
 * @example
 * ```ts
 * isExtensionQueryParameterName("version:id"); // true
 * isExtensionQueryParameterName("version:id[articles]"); // true
 * ```
 */
export const isExtensionQueryParameterName = (name: string): boolean => {
	const baseName = queryParameterBaseName(name);
	return (
		isExtensionQueryParameterBaseName(baseName) && isQueryParameterFamilyMember(baseName, name)
	);
};

/**
 * Returns whether a query parameter name is implementation-specific.
 *
 * @example
 * ```ts
 * isImplementationQueryParameterName("page-size"); // true
 * isImplementationQueryParameterName("page"); // false
 * ```
 */
export const isImplementationQueryParameterName = (name: string): boolean => {
	const baseName = queryParameterBaseName(name);
	return (
		isImplementationQueryParameterBaseName(baseName) && isQueryParameterFamilyMember(baseName, name)
	);
};

/**
 * Classifies a query parameter name as standard, extension, implementation, or invalid.
 *
 * @example
 * ```ts
 * classifyQueryParameterName("fields[articles]"); // "standard"
 * classifyQueryParameterName("version:id"); // "extension"
 * classifyQueryParameterName("page-size"); // "implementation"
 * ```
 */
export const classifyQueryParameterName = (name: string): QueryParameterKind => {
	if (isStandardQueryParameterName(name)) {
		return "standard";
	}
	if (isExtensionQueryParameterName(name)) {
		return "extension";
	}
	if (isImplementationQueryParameterName(name)) {
		return "implementation";
	}
	return "invalid";
};

/**
 * Schema for a JSON:API query parameter name.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(QueryParameterName)("fields[articles]");
 * ```
 */
export const QueryParameterName = Schema.String.check(
	Schema.makeFilter((value) =>
		classifyQueryParameterName(value) === "invalid"
			? "JSON:API query parameter names must be standard, extension-specific, or implementation-specific names"
			: undefined,
	),
).annotate({
	identifier: "JsonApiQueryParameterName",
	description: "A JSON:API query parameter name.",
});

/**
 * JSON:API query parameter class.
 *
 * @example
 * ```ts
 * const parameter = new QueryParameter({
 * 	name: "include",
 * 	value: "author",
 * });
 * ```
 */
export class QueryParameter extends Schema.Class<QueryParameter>("JsonApiQueryParameter")({
	name: QueryParameterName,
	value: Schema.String,
}) {}

/**
 * Options for validating JSON:API query parameter names against an endpoint.
 */
export type QueryParameterValidationOptions = {
	readonly allowedParameterNames?: ReadonlyArray<string>;
	readonly allowedParameterFamilies?: ReadonlyArray<string>;
};

/**
 * Result of validating query parameter names before endpoint processing.
 */
export type QueryParameterValidation =
	| {
			readonly _tag: "ValidQueryParameters";
			readonly parameters: ReadonlyArray<typeof QueryParameter.Type>;
	  }
	| {
			readonly _tag: "InvalidQueryParameters";
			readonly errors: ReadonlyArray<ErrorObject>;
	  };

const searchParamsFromInput = (input: string | URL | URLSearchParams) =>
	typeof input === "string"
		? new URL(input, "https://jsonapi.local").searchParams
		: input instanceof URL
			? input.searchParams
			: input;

const parameterIsAllowed = (name: string, options: QueryParameterValidationOptions): boolean => {
	if (options.allowedParameterNames?.includes(name) === true) {
		return true;
	}
	return (
		options.allowedParameterFamilies?.some((baseName) =>
			isQueryParameterFamilyMember(baseName, name),
		) === true
	);
};

const invalidQueryParameterError = (name: string, detail: string): ErrorObject => ({
	status: "400",
	title: "Invalid query parameter",
	detail,
	source: { parameter: name },
});

/**
 * Validates JSON:API query parameter names and preserves iteration order.
 *
 * Invalid or unsupported query parameters are returned as JSON:API error
 * objects with `source.parameter` populated.
 */
export const validateQueryParameters = (
	input: string | URL | URLSearchParams,
	options: QueryParameterValidationOptions = {},
): QueryParameterValidation => {
	const parameters: Array<typeof QueryParameter.Type> = [];
	const errors: Array<ErrorObject> = [];

	for (const [name, value] of searchParamsFromInput(input).entries()) {
		if (classifyQueryParameterName(name) === "invalid") {
			errors.push(
				invalidQueryParameterError(
					name,
					"Query parameter names must be standard, extension-specific, or implementation-specific JSON:API names",
				),
			);
			continue;
		}
		if (
			(options.allowedParameterNames !== undefined ||
				options.allowedParameterFamilies !== undefined) &&
			!parameterIsAllowed(name, options)
		) {
			errors.push(invalidQueryParameterError(name, `Unsupported query parameter: ${name}`));
			continue;
		}
		parameters.push(new QueryParameter({ name, value }));
	}

	return errors.length === 0
		? { _tag: "ValidQueryParameters", parameters }
		: { _tag: "InvalidQueryParameters", errors };
};

/**
 * Schema for common fixed-name JSON:API fetch query parameters.
 *
 * This intentionally models only fixed names. Sparse fieldsets and query
 * families are represented by their own helpers.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(FetchQuery)({
 * 	include: "author,comments",
 * 	sort: "-publishedAt",
 * });
 * ```
 */
export const FetchQuery = Schema.Struct({
	include: Schema.optionalKey(IncludeParameter),
	sort: Schema.optionalKey(SortParameter),
}).annotate({
	identifier: "JsonApiFetchQuery",
	description: "Common JSON:API fetch query parameters with fixed names.",
});

/**
 * Schema for a `fields[TYPE]` query parameter value.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(FieldsetQueryValue)("title,body");
 * ```
 */
export const FieldsetQueryValue = SparseFieldsetParameter;

/**
 * Builds the query parameter name for a sparse fieldset resource type.
 *
 * @throws When `type` is not a valid JSON:API member name.
 *
 * @example
 * ```ts
 * makeSparseFieldsetQueryName("articles"); // "fields[articles]"
 * ```
 */
export const makeSparseFieldsetQueryName = (type: string) => {
	if (!isMemberName(type)) {
		throw new Error(`Invalid JSON:API resource type for sparse fieldset query: ${type}`);
	}
	return `fields[${type}]`;
};

/**
 * Builds a JSON:API query parameter family name from a base name and segments.
 *
 * @throws When the base name or any segment is not valid for a query family.
 *
 * @example
 * ```ts
 * makeQueryFamilyName("page", ["number"]); // "page[number]"
 * makeQueryFamilyName("filter", ["author.name"]); // "filter[author.name]"
 * ```
 */
export const makeQueryFamilyName = (baseName: string, segments: ReadonlyArray<string> = []) => {
	if (!isMemberName(baseName) && !isExtensionQueryParameterBaseName(baseName)) {
		throw new Error(`Invalid JSON:API query parameter family base name: ${baseName}`);
	}
	for (const segment of segments) {
		if (segment !== "" && !isRelationshipPath(segment)) {
			throw new Error(`Invalid JSON:API query parameter family segment: ${segment}`);
		}
	}
	return `${baseName}${segments.map((segment) => `[${segment}]`).join("")}`;
};

/**
 * Parses query parameters from a URL string, URL, or URLSearchParams object.
 *
 * Repeated parameters are preserved in iteration order.
 *
 * @example
 * ```ts
 * parseQueryParameters("https://api.example.com/articles?include=author");
 * // [{ name: "include", value: "author" }]
 * ```
 */
export const parseQueryParameters = (
	input: string | URL | URLSearchParams,
): ReadonlyArray<typeof QueryParameter.Type> => {
	const parameters: Array<typeof QueryParameter.Type> = [];
	for (const [name, value] of searchParamsFromInput(input).entries()) {
		parameters.push(new QueryParameter({ name, value }));
	}
	return parameters;
};
