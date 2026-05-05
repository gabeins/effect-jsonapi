import { Schema } from "effect";
import { ErrorObject } from "./Error.js";
import { extensibleObject } from "./Extension.js";
import { LinksObject } from "./Link.js";
import { withJsonApiStatus } from "./MediaType.js";
import { MetaObject } from "./Meta.js";
import { ExtensionMemberName } from "./MemberName.js";
import {
	IncludedResourceObject,
	PrimaryData,
	ResponsePrimaryData,
	ResourceData,
	ResourceLinkage,
	ResourceObject,
	resourceIdentityKey,
} from "./Resource.js";
import type { ResourceIdentity } from "./Resource.js";
import { Uri } from "./Uri.js";

/**
 * JSON:API version object class.
 *
 * This object describes the JSON:API implementation and any applied extension
 * or profile URIs.
 *
 * @example
 * ```ts
 * const jsonapi = new JsonApiObject({
 * 	version: "1.1",
 * 	ext: ["https://jsonapi.org/ext/version"],
 * });
 * ```
 */
export class JsonApiObject extends Schema.Class<JsonApiObject>("JsonApiObject")({
	version: Schema.optionalKey(Schema.String),
	ext: Schema.optionalKey(Schema.Array(Uri)),
	profile: Schema.optionalKey(Schema.Array(Uri)),
	meta: Schema.optionalKey(MetaObject),
}) {}

/**
 * Base JSON:API top-level document class before document-level validation.
 */
export class TopLevelDocumentClass extends Schema.Class<TopLevelDocumentClass>(
	"JsonApiTopLevelDocument",
)({
	jsonapi: Schema.optionalKey(JsonApiObject),
	links: Schema.optionalKey(LinksObject),
	data: Schema.optionalKey(PrimaryData),
	errors: Schema.optionalKey(Schema.Array(ErrorObject)),
	meta: Schema.optionalKey(MetaObject),
	included: Schema.optionalKey(Schema.Array(ResourceObject)),
}) {}

const hasKey = <Key extends PropertyKey>(value: object, key: Key) => key in value;

const TopLevelDocumentStruct = extensibleObject(Schema.Struct(TopLevelDocumentClass.fields));

const hasExtensionMember = (value: object) =>
	Object.keys(value).some(
		(key) => Schema.decodeUnknownOption(ExtensionMemberName)(key)._tag === "Some",
	);

const includedResourcesAreUnique = (resources: ReadonlyArray<ResourceIdentity>) => {
	const keys = new Set<string>();
	const duplicates: Array<string> = [];
	for (const resource of resources) {
		const key = resourceIdentityKey(resource);
		if (key === undefined) {
			continue;
		}
		if (keys.has(key)) {
			duplicates.push(key);
			continue;
		}
		keys.add(key);
	}
	return duplicates;
};

const collectLinkage = (linkage: ResourceLinkage): ReadonlyArray<ResourceIdentity> => {
	if (linkage === null) {
		return [];
	}
	return isResourceIdentityArray(linkage) ? linkage : [linkage];
};

const collectRelationshipIdentities = (resource: {
	readonly relationships?: ResourceObject["relationships"];
}): ReadonlyArray<ResourceIdentity> => {
	const relationships = resource.relationships;
	if (relationships === undefined) {
		return [];
	}

	const identities: Array<ResourceIdentity> = [];
	for (const relationship of Object.values(relationships)) {
		if (relationship.data === undefined) {
			continue;
		}
		identities.push(...collectLinkage(relationship.data));
	}
	return identities;
};

const documentIdentityConsistencyIssues = (document: {
	readonly data?: PrimaryData;
	readonly included?: ReadonlyArray<ResourceObject>;
}) => {
	const issues: Array<Schema.FilterIssue> = [];
	const idToLid = new Map<string, string>();
	const lidToId = new Map<string, string>();
	const identities: Array<ResourceIdentity> = [];
	const primaryData =
		document.data === undefined || document.data === null
			? []
			: normalizeResourceData(document.data);

	for (const resource of primaryData) {
		identities.push(resource, ...collectRelationshipIdentities(resource));
	}
	for (const resource of document.included ?? []) {
		identities.push(resource, ...collectRelationshipIdentities(resource));
	}

	for (const identity of identities) {
		if (identity.id !== undefined && identity.lid !== undefined) {
			const idKey = `${identity.type}:id:${identity.id}`;
			const lidKey = `${identity.type}:lid:${identity.lid}`;
			const previousLid = idToLid.get(idKey);
			const previousId = lidToId.get(lidKey);
			if (previousLid !== undefined && previousLid !== identity.lid) {
				issues.push(`Resource ${idKey} is represented with multiple local ids`);
			}
			if (previousId !== undefined && previousId !== identity.id) {
				issues.push(`Resource ${lidKey} is represented with multiple server ids`);
			}
			idToLid.set(idKey, identity.lid);
			lidToId.set(lidKey, identity.id);
		}
	}

	return issues;
};

const topLevelDocumentIssues = (
	value: typeof TopLevelDocumentStruct.Type,
	options: {
		readonly requireFullLinkage?: boolean;
	} = {},
) => {
	const issues: Array<Schema.FilterIssue> = [];
	const hasData = hasKey(value, "data");
	const hasErrors = hasKey(value, "errors");
	const hasMeta = hasKey(value, "meta");

	if (!hasData && !hasErrors && !hasMeta && !hasExtensionMember(value)) {
		issues.push("A JSON:API document must contain data, errors, meta, or an extension member");
	}
	if (hasData && hasErrors) {
		issues.push("A JSON:API document must not contain both data and errors");
	}
	if (!hasData && value.included !== undefined) {
		issues.push("A JSON:API document without data must not contain included resources");
	}
	if (value.included !== undefined) {
		for (const duplicate of includedResourcesAreUnique(value.included)) {
			issues.push(`Compound documents must not include duplicate resource ${duplicate}`);
		}
	}
	issues.push(...documentIdentityConsistencyIssues(value));
	if (options.requireFullLinkage === true && !hasFullLinkage(value)) {
		issues.push("Compound documents must include full linkage for every included resource");
	}

	return issues.length === 0 ? undefined : issues;
};

/**
 * Schema for a JSON:API top-level document.
 *
 * The schema enforces the core top-level member rules: at least one of `data`,
 * `errors`, or `meta`; no `data` and `errors` together; no `included` without
 * `data`; and no duplicate included resource identities.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(TopLevelDocument)({
 * 	data: {
 * 		type: "articles",
 * 		id: "1",
 * 		attributes: { title: "JSON:API paints my bikeshed!" },
 * 	},
 * });
 * ```
 */
export const topLevelDocument = (
	options: {
		readonly requireFullLinkage?: boolean;
	} = {},
) =>
	TopLevelDocumentStruct.check(
		Schema.makeFilter((value) => topLevelDocumentIssues(value, options)),
	).annotate({
		identifier: "JsonApiTopLevelDocument",
		description: "A JSON:API top-level document.",
	});

export const TopLevelDocument = topLevelDocument();

/**
 * Type of a JSON:API top-level document decoded by {@link TopLevelDocument}.
 */
export type TopLevelDocument = typeof TopLevelDocument.Type;

const normalizeResourceData = (
	data: typeof ResourceData.Type | ReadonlyArray<typeof ResourceData.Type>,
) => (Array.isArray(data) ? data : [data]);

const isResourceIdentityArray = (
	linkage: ResourceLinkage,
): linkage is ReadonlyArray<ResourceIdentity> => Array.isArray(linkage);

const collectRelationshipKeys = (resource: ResourceObject): ReadonlyArray<string> => {
	const relationships = resource.relationships;
	if (relationships === undefined) {
		return [];
	}

	const keys: Array<string> = [];
	for (const relationship of Object.values(relationships)) {
		if (relationship.data === undefined) {
			continue;
		}
		for (const identifier of collectLinkage(relationship.data)) {
			const key = resourceIdentityKey(identifier);
			if (key !== undefined) {
				keys.push(key);
			}
		}
	}
	return keys;
};

/**
 * Returns whether a compound document satisfies JSON:API full linkage.
 *
 * Documents without `data` or without `included` are considered fully linked.
 * For compound documents, every included resource must be reachable from
 * primary data through relationship linkage.
 *
 * @example
 * ```ts
 * const document = Schema.decodeUnknownSync(TopLevelDocument)({
 * 	data: {
 * 		type: "articles",
 * 		id: "1",
 * 		relationships: {
 * 			author: { data: { type: "people", id: "9" } },
 * 		},
 * 	},
 * 	included: [{ type: "people", id: "9" }],
 * });
 *
 * hasFullLinkage(document); // true
 * ```
 */
export const hasFullLinkage = (document: TopLevelDocument): boolean => {
	if (document.data === undefined || document.included === undefined) {
		return true;
	}

	const includedByKey = new Map<string, ResourceObject>();
	for (const resource of document.included) {
		const key = resourceIdentityKey(resource);
		if (key !== undefined) {
			includedByKey.set(key, resource);
		}
	}

	const primaryData = document.data === null ? [] : normalizeResourceData(document.data);
	const reachable = new Set<string>();
	const queue: Array<string> = [];
	for (const resource of primaryData) {
		for (const key of collectRelationshipKeys(resource)) {
			reachable.add(key);
			queue.push(key);
		}
	}

	while (queue.length > 0) {
		const key = queue.shift();
		if (key === undefined) {
			continue;
		}
		const resource = includedByKey.get(key);
		if (resource === undefined) {
			continue;
		}
		for (const nextKey of collectRelationshipKeys(resource)) {
			if (!reachable.has(nextKey)) {
				reachable.add(nextKey);
				queue.push(nextKey);
			}
		}
	}

	for (const resource of document.included) {
		const key = resourceIdentityKey(resource);
		if (key !== undefined && !reachable.has(key)) {
			return false;
		}
	}
	return true;
};

/**
 * Builds a top-level JSON:API document schema with required `data`.
 *
 * @example
 * ```ts
 * const ArticleDocument = dataDocument(ResourceObject);
 *
 * Schema.decodeUnknownSync(ArticleDocument)({
 * 	data: { type: "articles", id: "1" },
 * });
 * ```
 */
export const dataDocument = <Data extends Schema.Top>(data: Data) =>
	extensibleObject(
		Schema.Struct({
			jsonapi: Schema.optionalKey(JsonApiObject),
			links: Schema.optionalKey(LinksObject),
			data,
			meta: Schema.optionalKey(MetaObject),
			included: Schema.optionalKey(Schema.Array(ResourceObject)),
		}),
	);

/**
 * Builds a JSON:API request document schema with required `data`.
 *
 * Request data documents do not include compound response resources by default.
 */
export const requestDataDocument = <Data extends Schema.Top>(data: Data) =>
	extensibleObject(
		Schema.Struct({
			jsonapi: Schema.optionalKey(JsonApiObject),
			links: Schema.optionalKey(LinksObject),
			data,
			meta: Schema.optionalKey(MetaObject),
		}),
	);

/**
 * Builds a JSON:API response document schema with required `data`.
 *
 * Included resources in response documents must have server-assigned ids.
 */
export const responseDataDocument = <Data extends Schema.Top>(data: Data) =>
	extensibleObject(
		Schema.Struct({
			jsonapi: Schema.optionalKey(JsonApiObject),
			links: Schema.optionalKey(LinksObject),
			data,
			meta: Schema.optionalKey(MetaObject),
			included: Schema.optionalKey(Schema.Array(IncludedResourceObject)),
		}),
	);

/**
 * Generic JSON:API response document schema.
 */
export const ResponseDocument = extensibleObject(
	Schema.Struct({
		jsonapi: Schema.optionalKey(JsonApiObject),
		links: Schema.optionalKey(LinksObject),
		data: Schema.optionalKey(ResponsePrimaryData),
		errors: Schema.optionalKey(Schema.Array(ErrorObject)),
		meta: Schema.optionalKey(MetaObject),
		included: Schema.optionalKey(Schema.Array(IncludedResourceObject)),
	}),
)
	.check(Schema.makeFilter((value) => topLevelDocumentIssues(value, { requireFullLinkage: true })))
	.annotate({
		identifier: "JsonApiResponseDocument",
		description: "A JSON:API response document.",
	});

/**
 * Builds a top-level JSON:API document schema with required `meta`.
 *
 * @example
 * ```ts
 * const PageMetaDocument = metaDocument(Schema.Struct({ total: Schema.Number }));
 * ```
 */
export const metaDocument = <Meta extends Schema.Top>(meta: Meta) =>
	extensibleObject(
		Schema.Struct({
			jsonapi: Schema.optionalKey(JsonApiObject),
			links: Schema.optionalKey(LinksObject),
			meta,
		}),
	);

/**
 * Builds a JSON:API relationship document schema.
 *
 * Relationship documents are used by relationship endpoints and require a
 * `data` member whose shape depends on the relationship cardinality.
 *
 * @example
 * ```ts
 * const AuthorRelationshipDocument = relationshipDocument(
 * 	Schema.Union([ResourceIdentifierObject, Schema.Null]),
 * );
 * ```
 */
export const relationshipDocument = <Data extends Schema.Top>(data: Data) =>
	extensibleObject(
		Schema.Struct({
			data,
			meta: Schema.optionalKey(MetaObject),
			links: Schema.optionalKey(LinksObject),
		}),
	);

/**
 * Builds an Effect HttpApi success response schema for a JSON:API data document.
 *
 * @example
 * ```ts
 * const CreatedArticleResponse = successResponse(201)(ResourceObject);
 * ```
 */
export const successResponse =
	(status: number) =>
	<Data extends Schema.Top>(data: Data) =>
		responseDataDocument(data).pipe(withJsonApiStatus(status));
