import { Schema } from "effect";
import { extensibleObject } from "./Extension.js";
import { ErrorObject } from "./JsonApiError.js";
import { LinksObject, RelationshipLinksObject } from "./Link.js";
import { withJsonApiStatus } from "./MediaType.js";
import { MetaObject } from "./Meta.js";
import { ExtensionMemberName, FieldName, MemberName } from "./MemberName.js";
import * as Relationship from "./Relationship.js";
import type * as Resource from "./Resource.js";
import { Uri } from "./Uri.js";

// -------------------------------------------------------------------------------------
// Resource-level wire schemas
// -------------------------------------------------------------------------------------

/**
 * Schema for a JSON:API resource type.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ResourceType)("articles");
 * ```
 */
export const ResourceType = MemberName.annotate({
	identifier: "JsonApiResourceType",
	description: "A JSON:API resource type.",
});

/**
 * Schema for a server-assigned JSON:API resource id.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ResourceId)("1");
 * ```
 */
export const ResourceId = Schema.String.annotate({
	identifier: "JsonApiResourceId",
	description: "A JSON:API resource id.",
});

/**
 * Schema for a JSON:API local id.
 *
 * Local ids identify new resources within a single request document before the
 * server assigns durable resource ids.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(LocalId)("temp-1");
 * ```
 */
export const LocalId = Schema.String.annotate({
	identifier: "JsonApiLocalId",
	description: "A JSON:API local id used to identify new resources within a document.",
});

/**
 * Schema for a JSON:API attributes object.
 *
 * Attribute names must be legal field names and values may be any JSON value.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(AttributesObject)({
 * 	title: "JSON:API paints my bikeshed!",
 * });
 * ```
 */
export const AttributesObject = Schema.Record(FieldName, Schema.Json).annotate({
	identifier: "JsonApiAttributesObject",
	description: "A JSON:API attributes object.",
});

/**
 * Type of a JSON:API attributes object decoded by {@link AttributesObject}.
 */
export type AttributesObject = typeof AttributesObject.Type;

const resourceIdentifierFields = {
	type: ResourceType,
	id: Schema.optionalKey(ResourceId),
	lid: Schema.optionalKey(LocalId),
	meta: Schema.optionalKey(MetaObject),
};

const ResourceIdentifierObjectStruct = extensibleObject(Schema.Struct(resourceIdentifierFields));

/**
 * Schema for a JSON:API resource identifier object.
 *
 * A resource identifier must contain either `id` or `lid`.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ResourceIdentifierObject)({
 * 	type: "articles",
 * 	id: "1",
 * });
 * ```
 */
export const ResourceIdentifierObject = ResourceIdentifierObjectStruct.check(
	Schema.makeFilter((value) =>
		value.id !== undefined || value.lid !== undefined
			? undefined
			: "A resource identifier object must contain id or lid",
	),
).annotate({
	identifier: "JsonApiResourceIdentifierObject",
	description: "A JSON:API resource identifier object.",
});

/**
 * Schema for a persisted JSON:API resource identifier object.
 *
 * Use this for response documents where server-assigned identities are required.
 */
export const PersistedResourceIdentifierObject = ResourceIdentifierObjectStruct.check(
	Schema.makeFilter((value) =>
		value.id !== undefined ? undefined : "A persisted resource identifier object must contain id",
	),
).annotate({
	identifier: "JsonApiPersistedResourceIdentifierObject",
	description: "A JSON:API resource identifier object with a server-assigned id.",
});

/**
 * Type of a JSON:API resource identifier object decoded by
 * {@link ResourceIdentifierObject}.
 */
export type ResourceIdentifierObject = typeof ResourceIdentifierObject.Type;

/**
 * Schema for JSON:API resource linkage.
 *
 * Linkage may be `null`, a single resource identifier, or an array of resource
 * identifiers.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ResourceLinkage)([
 * 	{ type: "comments", id: "1" },
 * ]);
 * ```
 */
export const ResourceLinkage = Schema.Union([
	Schema.Null,
	ResourceIdentifierObject,
	Schema.Array(ResourceIdentifierObject),
]).annotate({
	identifier: "JsonApiResourceLinkage",
	description: "JSON:API resource linkage.",
});

/**
 * Type of JSON:API resource linkage decoded by {@link ResourceLinkage}.
 */
export type ResourceLinkage = typeof ResourceLinkage.Type;

const relationshipObjectFields = {
	links: Schema.optionalKey(RelationshipLinksObject),
	data: Schema.optionalKey(ResourceLinkage),
	meta: Schema.optionalKey(MetaObject),
};

const RelationshipObjectStruct = extensibleObject(Schema.Struct(relationshipObjectFields));

/**
 * Schema for a JSON:API relationship object.
 *
 * A relationship object must contain at least one of `links`, `data`, or `meta`.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(RelationshipObject)({
 * 	data: { type: "people", id: "9" },
 * });
 * ```
 */
export const RelationshipObject = RelationshipObjectStruct.check(
	Schema.makeFilter((value) =>
		value.links !== undefined || value.data !== undefined || value.meta !== undefined
			? undefined
			: "A relationship object must contain links, data, or meta",
	),
).annotate({
	identifier: "JsonApiRelationshipObject",
	description: "A JSON:API relationship object.",
});

/**
 * Type of a JSON:API relationship object decoded by {@link RelationshipObject}.
 */
export type RelationshipObject = typeof RelationshipObject.Type;

/**
 * Schema for a JSON:API relationships object keyed by field name.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(RelationshipsObject)({
 * 	author: { data: { type: "people", id: "9" } },
 * });
 * ```
 */
export const RelationshipsObject = Schema.Record(FieldName, RelationshipObject).annotate({
	identifier: "JsonApiRelationshipsObject",
	description: "A JSON:API relationships object.",
});

/**
 * Type of a JSON:API relationships object decoded by {@link RelationshipsObject}.
 */
export type RelationshipsObject = typeof RelationshipsObject.Type;

const objectKeys = (value: unknown): ReadonlyArray<string> =>
	typeof value === "object" && value !== null && !Array.isArray(value) ? Object.keys(value) : [];

const fieldCollisionIssues = (value: {
	readonly attributes?: unknown;
	readonly relationships?: unknown;
}) => {
	const issues: Array<Schema.FilterIssue> = [];
	const attributeNames = new Set(objectKeys(value.attributes));
	const relationshipNames = new Set(objectKeys(value.relationships));

	for (const reserved of ["type", "id"]) {
		if (attributeNames.has(reserved)) {
			issues.push({ path: ["attributes", reserved], issue: `Field name ${reserved} is reserved` });
		}
		if (relationshipNames.has(reserved)) {
			issues.push({
				path: ["relationships", reserved],
				issue: `Field name ${reserved} is reserved`,
			});
		}
	}

	for (const name of attributeNames) {
		if (relationshipNames.has(name)) {
			issues.push({
				path: ["relationships", name],
				issue: `Attribute and relationship fields share the same name: ${name}`,
			});
		}
	}

	return issues.length === 0 ? undefined : issues;
};

const resourceObjectFields = {
	type: ResourceType,
	id: Schema.optionalKey(ResourceId),
	lid: Schema.optionalKey(LocalId),
	attributes: Schema.optionalKey(AttributesObject),
	relationships: Schema.optionalKey(RelationshipsObject),
	links: Schema.optionalKey(LinksObject),
	meta: Schema.optionalKey(MetaObject),
};

const ResourceObjectStruct = extensibleObject(Schema.Struct(resourceObjectFields));

/**
 * Schema for a JSON:API resource object.
 *
 * Attribute and relationship names cannot collide with each other or with the
 * reserved `type` and `id` members.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ResourceObject)({
 * 	type: "articles",
 * 	id: "1",
 * 	attributes: { title: "JSON:API paints my bikeshed!" },
 * });
 * ```
 */
export const ResourceObject = ResourceObjectStruct.check(
	Schema.makeFilter(fieldCollisionIssues),
).annotate({
	identifier: "JsonApiResourceObject",
	description: "A JSON:API resource object.",
});

/**
 * Type of a JSON:API resource object decoded by {@link ResourceObject}.
 */
export type ResourceObject = typeof ResourceObject.Type;

/**
 * Schema for a persisted resource object with a server-assigned id.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(PersistedResourceObject)({
 * 	type: "articles",
 * 	id: "1",
 * });
 * ```
 */
export const PersistedResourceObject = ResourceObjectStruct.check(
	Schema.makeFilter((value) => {
		const issues = fieldCollisionIssues(value);
		if (issues !== undefined) {
			return issues;
		}
		return value.id !== undefined ? undefined : "A persisted resource object must contain id";
	}),
).annotate({
	identifier: "JsonApiPersistedResourceObject",
	description: "A JSON:API resource object with a server-assigned id.",
});

/**
 * Schema for a new resource object submitted for creation.
 *
 * New resource objects may include `lid` but must not include a server-assigned
 * `id`.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(NewResourceObject)({
 * 	type: "articles",
 * 	lid: "temp-1",
 * 	attributes: { title: "New article" },
 * });
 * ```
 */
export const NewResourceObject = ResourceObjectStruct.check(
	Schema.makeFilter((value) => {
		const issues = fieldCollisionIssues(value);
		if (issues !== undefined) {
			return issues;
		}
		return value.id === undefined ? undefined : "A new resource object must not contain id";
	}),
).annotate({
	identifier: "JsonApiNewResourceObject",
	description: "A JSON:API resource object submitted for creation.",
});

/**
 * Schema for top-level JSON:API primary data.
 *
 * Primary data may be a single resource, `null`, or an array of resources.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(PrimaryData)([{ type: "articles", id: "1" }]);
 * ```
 */
export const PrimaryData = Schema.Union([
	ResourceObject,
	ResourceIdentifierObject,
	Schema.Null,
	Schema.Array(Schema.Union([ResourceObject, ResourceIdentifierObject])),
]).annotate({
	identifier: "JsonApiPrimaryData",
	description: "A JSON:API top-level primary data value.",
});

/**
 * Type of top-level JSON:API primary data decoded by {@link PrimaryData}.
 */
export type PrimaryData = typeof PrimaryData.Type;

/**
 * Minimal identity shape shared by resource objects and resource identifiers.
 */
export type ResourceIdentity = {
	readonly type: string;
	readonly id?: string;
	readonly lid?: string;
};

/**
 * Builds a stable key for a resource identity.
 *
 * Server ids take precedence over local ids. Returns `undefined` when neither
 * identity field is present.
 *
 * @example
 * ```ts
 * resourceIdentityKey({ type: "articles", id: "1" }); // "articles:id:1"
 * resourceIdentityKey({ type: "articles", lid: "temp-1" }); // "articles:lid:temp-1"
 * ```
 */
export const resourceIdentityKey = (resource: ResourceIdentity): string | undefined => {
	if (resource.id !== undefined) {
		return `${resource.type}:id:${resource.id}`;
	}
	if (resource.lid !== undefined) {
		return `${resource.type}:lid:${resource.lid}`;
	}
	return undefined;
};

// -------------------------------------------------------------------------------------
// Top-level document wire schemas
// -------------------------------------------------------------------------------------

/**
 * Schema for the JSON:API version object.
 *
 * This object describes the JSON:API implementation and any applied extension
 * or profile URIs.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(JsonApiObject)({
 * 	version: "1.1",
 * 	ext: ["https://jsonapi.org/ext/version"],
 * });
 * ```
 */
export const JsonApiObject = Schema.Struct({
	version: Schema.optionalKey(Schema.String),
	ext: Schema.optionalKey(Schema.Array(Uri)),
	profile: Schema.optionalKey(Schema.Array(Uri)),
	meta: Schema.optionalKey(MetaObject),
}).annotate({
	identifier: "JsonApiObject",
	description: "A JSON:API object describing the server implementation.",
});

/**
 * Type of the JSON:API version object decoded by {@link JsonApiObject}.
 */
export type JsonApiObject = typeof JsonApiObject.Type;

const topLevelDocumentFields = {
	jsonapi: Schema.optionalKey(JsonApiObject),
	links: Schema.optionalKey(LinksObject),
	data: Schema.optionalKey(PrimaryData),
	errors: Schema.optionalKey(Schema.Array(ErrorObject)),
	meta: Schema.optionalKey(MetaObject),
	included: Schema.optionalKey(Schema.Array(ResourceObject)),
};

const hasKey = <Key extends PropertyKey>(value: object, key: Key) => key in value;

const TopLevelDocumentStruct = extensibleObject(Schema.Struct(topLevelDocumentFields));

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

const collectRelationshipIdentities = (resource: object): ReadonlyArray<ResourceIdentity> => {
	const relationships = (resource as { readonly relationships?: RelationshipsObject })
		.relationships;
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
 * Builds a schema for a JSON:API top-level document with configurable
 * document-level validation.
 *
 * @example
 * ```ts
 * const StrictDocument = topLevelDocument({ requireFullLinkage: true });
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
export const TopLevelDocument = topLevelDocument();

/**
 * Type of a JSON:API top-level document decoded by {@link TopLevelDocument}.
 */
export type TopLevelDocument = typeof TopLevelDocument.Type;

const normalizeResourceData = (
	data: Exclude<PrimaryData, null>,
): ReadonlyArray<ResourceObject | ResourceIdentifierObject> =>
	(Array.isArray(data) ? data : [data]) as ReadonlyArray<ResourceObject | ResourceIdentifierObject>;

const isResourceIdentityArray = (
	linkage: ResourceLinkage,
): linkage is ReadonlyArray<ResourceIdentity> => Array.isArray(linkage);

const collectRelationshipKeys = (resource: object): ReadonlyArray<string> => {
	const relationships = (resource as { readonly relationships?: RelationshipsObject })
		.relationships;
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
 * hasFullLinkage({
 * 	data: {
 * 		type: "articles",
 * 		id: "1",
 * 		relationships: { author: { data: { type: "people", id: "9" } } },
 * 	},
 * 	included: [{ type: "people", id: "9" }],
 * }); // true
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

// -------------------------------------------------------------------------------------
// Document schema combinators
// -------------------------------------------------------------------------------------

/**
 * Builds a top-level JSON:API document schema with required `data`.
 *
 * @example
 * ```ts
 * const ArticleDocument = dataDocument(ResourceObject);
 * ```
 */
export const dataDocument = <Data extends Schema.Top>(data: Data) =>
	Schema.Struct({
		jsonapi: Schema.optionalKey(JsonApiObject),
		links: Schema.optionalKey(LinksObject),
		data,
		meta: Schema.optionalKey(MetaObject),
		included: Schema.optionalKey(Schema.Array(PersistedResourceObject)),
	});

/**
 * Builds a JSON:API request document schema with required `data`.
 *
 * Request data documents do not carry compound `included` resources.
 */
export const requestDataDocument = <Data extends Schema.Top>(data: Data) =>
	Schema.Struct({
		jsonapi: Schema.optionalKey(JsonApiObject),
		links: Schema.optionalKey(LinksObject),
		data,
		meta: Schema.optionalKey(MetaObject),
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
	Schema.Struct({
		jsonapi: Schema.optionalKey(JsonApiObject),
		links: Schema.optionalKey(LinksObject),
		meta,
	});

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
	Schema.Struct({
		data,
		meta: Schema.optionalKey(MetaObject),
		links: Schema.optionalKey(LinksObject),
	});

/**
 * Generic JSON:API response document schema validating all top-level document
 * rules, including full linkage for compound documents.
 */
export const ResponseDocument = TopLevelDocumentStruct.check(
	Schema.makeFilter((value) => topLevelDocumentIssues(value, { requireFullLinkage: true })),
).annotate({
	identifier: "JsonApiResponseDocument",
	description: "A JSON:API response document.",
});

/**
 * Builds an Effect HttpApi success response schema for a JSON:API data document.
 *
 * @example
 * ```ts
 * const CreatedArticleResponse = successResponse(201)(ArticleResource.Document);
 * ```
 */
export const successResponse =
	(status: number) =>
	<Data extends Schema.Top>(data: Data) =>
		data.pipe(withJsonApiStatus(status));

// -------------------------------------------------------------------------------------
// Document building from resource definitions
// -------------------------------------------------------------------------------------

/**
 * A resource object with unknown attribute and relationship shapes, as carried
 * by the `included` member of compound documents.
 */
export interface AnyResourceObject {
	readonly type: string;
	readonly id: string;
	readonly attributes?: { readonly [name: string]: unknown };
	readonly relationships?: {
		readonly [name: string]: {
			readonly data?: ResourceLinkage;
			readonly links?: LinksObject;
			readonly meta?: MetaObject;
		};
	};
	readonly links?: LinksObject;
	readonly meta?: MetaObject;
}

/**
 * The shape of a JSON:API document built from a resource definition.
 */
export interface ResourceDocument<Data> {
	readonly data: Data;
	readonly included?: ReadonlyArray<AnyResourceObject>;
	readonly links?: LinksObject;
	readonly meta?: MetaObject;
	readonly jsonapi?: JsonApiObject;
}

/**
 * Options accepted by the document builders.
 *
 * Pass the decoded JSON:API query to apply sparse fieldsets and build the
 * compound `included` member from embedded related entities.
 */
export interface BuildOptions {
	readonly query?: {
		readonly include?: ReadonlyArray<string>;
		readonly fields?: { readonly [type: string]: ReadonlyArray<string> };
	};
	readonly links?: LinksObject;
	readonly meta?: MetaObject;
	readonly jsonapi?: JsonApiObject;
}

type IncludeTree = Map<string, IncludeTree>;

const parseIncludeTree = (paths: ReadonlyArray<string>): IncludeTree => {
	const tree: IncludeTree = new Map();
	for (const path of paths) {
		let current = tree;
		for (const segment of path.split(".")) {
			const existing = current.get(segment);
			if (existing !== undefined) {
				current = existing;
				continue;
			}
			const next: IncludeTree = new Map();
			current.set(segment, next);
			current = next;
		}
	}
	return tree;
};

type Fieldsets = { readonly [type: string]: ReadonlyArray<string> } | undefined;

const fieldsetFor = (fieldsets: Fieldsets, type: string): ReadonlySet<string> | undefined => {
	const fields = fieldsets?.[type];
	return fields === undefined ? undefined : new Set(fields);
};

const isEmbeddedEntity = (value: unknown): value is Resource.Entity<Resource.Any> =>
	typeof value === "object" && value !== null && "attributes" in value;

const identifierOf = (
	type: string,
	value:
		| string
		| { readonly id: string; readonly meta?: MetaObject }
		| Resource.Entity<Resource.Any>,
): { readonly type: string; readonly id: string; readonly meta?: MetaObject } => {
	if (typeof value === "string") {
		return { type, id: value };
	}
	if (isEmbeddedEntity(value)) {
		return { type, id: value.id as string };
	}
	return value.meta === undefined
		? { type, id: value.id }
		: { type, id: value.id, meta: value.meta };
};

type SerializeContext = {
	readonly fieldsets: Fieldsets;
	readonly included: Map<string, AnyResourceObject>;
	readonly primaryKeys: ReadonlySet<string>;
};

const serializeEntity = (
	resource: Resource.Any,
	entity: Resource.Entity<Resource.Any>,
	includeTree: IncludeTree,
	context: SerializeContext,
): AnyResourceObject => {
	const fieldset = fieldsetFor(context.fieldsets, resource.type);
	const attributeKeys = Object.keys(resource.attributes.fields);

	const attributes: Record<string, unknown> = {};
	let attributeCount = 0;
	for (const key of attributeKeys) {
		if (fieldset !== undefined && !fieldset.has(key)) {
			continue;
		}
		if (key in entity.attributes) {
			attributes[key] = (entity.attributes as Record<string, unknown>)[key];
			attributeCount = attributeCount + 1;
		}
	}

	const relationships: Record<string, NonNullable<AnyResourceObject["relationships"]>[string]> = {};
	let relationshipCount = 0;
	const entityRelationships = (entity.relationships ?? {}) as Record<string, unknown>;
	for (const [name, relationship] of Object.entries(
		resource.relationships as Relationship.Fields,
	)) {
		const value = entityRelationships[name];
		if (value === undefined) {
			continue;
		}
		const target = relationship.resource();
		const subtree = includeTree.get(name);

		const serializeRelated = (related: unknown) => {
			if (subtree !== undefined && isEmbeddedEntity(related)) {
				addIncluded(target, related, subtree, context);
			}
		};

		let data: ResourceLinkage;
		if (Relationship.isToMany(relationship)) {
			const values = value as ReadonlyArray<never>;
			data = values.map((related) => {
				serializeRelated(related);
				return identifierOf(target.type, related);
			});
		} else if (value === null) {
			data = null;
		} else {
			serializeRelated(value);
			data = identifierOf(target.type, value as never);
		}

		if (fieldset === undefined || fieldset.has(name)) {
			relationships[name] = { data };
			relationshipCount = relationshipCount + 1;
		}
	}

	const serialized: {
		type: string;
		id: string;
		attributes?: Record<string, unknown>;
		relationships?: typeof relationships;
		links?: LinksObject;
		meta?: MetaObject;
	} = {
		type: resource.type,
		id: entity.id as string,
	};
	if (attributeCount > 0) {
		serialized.attributes = attributes;
	}
	if (relationshipCount > 0) {
		serialized.relationships = relationships;
	}
	if (entity.links !== undefined) {
		serialized.links = entity.links;
	}
	if (entity.meta !== undefined) {
		serialized.meta = entity.meta;
	}
	return serialized as AnyResourceObject;
};

const addIncluded = (
	resource: Resource.Any,
	entity: Resource.Entity<Resource.Any>,
	includeTree: IncludeTree,
	context: SerializeContext,
): void => {
	const key = `${resource.type}:id:${entity.id as string}`;
	if (context.primaryKeys.has(key)) {
		// Primary resources are never duplicated in `included`, but their own
		// relationships may still contribute further included resources.
		serializeEntity(resource, entity, includeTree, context);
		return;
	}
	const serialized = serializeEntity(resource, entity, includeTree, context);
	if (!context.included.has(key)) {
		context.included.set(key, serialized);
	}
};

const buildDocument = <Data>(
	data: Data,
	context: SerializeContext,
	options: BuildOptions | undefined,
): ResourceDocument<Data> => {
	const document: {
		data: Data;
		included?: ReadonlyArray<AnyResourceObject>;
		links?: LinksObject;
		meta?: MetaObject;
		jsonapi?: JsonApiObject;
	} = { data };
	if (context.included.size > 0) {
		document.included = [...context.included.values()];
	}
	if (options?.links !== undefined) {
		document.links = options.links;
	}
	if (options?.meta !== undefined) {
		document.meta = options.meta;
	}
	if (options?.jsonapi !== undefined) {
		document.jsonapi = options.jsonapi;
	}
	return document;
};

const makeContext = (
	resource: Resource.Any,
	entities: ReadonlyArray<Resource.Entity<Resource.Any>>,
	options: BuildOptions | undefined,
): SerializeContext => ({
	fieldsets: options?.query?.fields,
	included: new Map(),
	primaryKeys: new Set(entities.map((entity) => `${resource.type}:id:${entity.id as string}`)),
});

/**
 * Builds a single-resource JSON:API document from a resource definition and an
 * entity value.
 *
 * Sparse fieldsets from `options.query.fields` are applied to attributes and
 * relationships. Related entities embedded in `relationships` are serialized
 * into the compound `included` member when their path is requested through
 * `options.query.include`, guaranteeing full linkage by construction.
 *
 * @example
 * ```ts
 * Document.fromResource(UserResource, {
 * 	id: user.id,
 * 	attributes: user,
 * 	relationships: { posts: posts.map((post) => post.id) },
 * });
 * ```
 */
export const fromResource = <R extends Resource.Any>(
	resource: R,
	entity: Resource.Entity<R>,
	options?: BuildOptions,
): ResourceDocument<Resource.ResourceObjectFor<R>> => {
	const includeTree = parseIncludeTree(options?.query?.include ?? []);
	const context = makeContext(resource, [entity], options);
	const data = serializeEntity(resource, entity, includeTree, context);
	return buildDocument(data as unknown as Resource.ResourceObjectFor<R>, context, options);
};

/**
 * Builds a nullable single-resource JSON:API document.
 *
 * Use this for endpoints whose primary data is an empty to-one relationship.
 *
 * @example
 * ```ts
 * Document.fromNullableResource(UserResource, null);
 * ```
 */
export const fromNullableResource = <R extends Resource.Any>(
	resource: R,
	entity: Resource.Entity<R> | null,
	options?: BuildOptions,
): ResourceDocument<Resource.ResourceObjectFor<R> | null> => {
	if (entity === null) {
		return buildDocument(null, makeContext(resource, [], options), options);
	}
	return fromResource(resource, entity, options);
};

/**
 * Builds a resource-collection JSON:API document from a resource definition
 * and entity values.
 *
 * @example
 * ```ts
 * Document.fromCollection(UserResource, users.map((user) => ({
 * 	id: user.id,
 * 	attributes: user,
 * })), {
 * 	links: Page.numberSizeLinks({ url: request.url, page, totalPages }),
 * });
 * ```
 */
export const fromCollection = <R extends Resource.Any>(
	resource: R,
	entities: ReadonlyArray<Resource.Entity<R>>,
	options?: BuildOptions,
): ResourceDocument<ReadonlyArray<Resource.ResourceObjectFor<R>>> => {
	const includeTree = parseIncludeTree(options?.query?.include ?? []);
	const context = makeContext(resource, entities, options);
	const data = entities.map((entity) => serializeEntity(resource, entity, includeTree, context));
	return buildDocument(
		data as unknown as ReadonlyArray<Resource.ResourceObjectFor<R>>,
		context,
		options,
	);
};
