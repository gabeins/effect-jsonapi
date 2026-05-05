import { Schema } from "effect";
import { extensibleObject } from "./Extension.js";
import { LinksObject, RelationshipLinksObject } from "./Link.js";
import { MetaObject } from "./Meta.js";
import { FieldName, MemberName } from "./MemberName.js";

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

/**
 * Base JSON:API resource identifier class before the id-or-lid validation.
 */
export class ResourceIdentifierObjectClass extends Schema.Class<ResourceIdentifierObjectClass>(
	"JsonApiResourceIdentifierObject",
)({
	type: ResourceType,
	id: Schema.optionalKey(ResourceId),
	lid: Schema.optionalKey(LocalId),
	meta: Schema.optionalKey(MetaObject),
}) {}

const ResourceIdentifierObjectStruct = extensibleObject(
	Schema.Struct(ResourceIdentifierObjectClass.fields),
);

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

/**
 * Base JSON:API relationship object class before the non-empty-member validation.
 */
export class RelationshipObjectClass extends Schema.Class<RelationshipObjectClass>(
	"JsonApiRelationshipObject",
)({
	links: Schema.optionalKey(RelationshipLinksObject),
	data: Schema.optionalKey(ResourceLinkage),
	meta: Schema.optionalKey(MetaObject),
}) {}

const RelationshipObjectStruct = extensibleObject(Schema.Struct(RelationshipObjectClass.fields));

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

const objectKeys = (value: unknown): ReadonlyArray<string> =>
	typeof value === "object" && value !== null && !Array.isArray(value) ? Object.keys(value) : [];

/**
 * Base JSON:API resource object class before field-collision validation.
 */
export class ResourceObjectClass extends Schema.Class<ResourceObjectClass>("JsonApiResourceObject")(
	{
		type: ResourceType,
		id: Schema.optionalKey(ResourceId),
		lid: Schema.optionalKey(LocalId),
		attributes: Schema.optionalKey(AttributesObject),
		relationships: Schema.optionalKey(RelationshipsObject),
		links: Schema.optionalKey(LinksObject),
		meta: Schema.optionalKey(MetaObject),
	},
) {}

const ResourceObjectStruct = extensibleObject(Schema.Struct(ResourceObjectClass.fields));

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
 * Schema for a response resource object with a server-assigned id.
 */
export const ResponseResourceObject = PersistedResourceObject.annotate({
	identifier: "JsonApiResponseResourceObject",
	description: "A JSON:API resource object returned by the server.",
});

/**
 * Schema for an included resource object in a compound response document.
 */
export const IncludedResourceObject = PersistedResourceObject.annotate({
	identifier: "JsonApiIncludedResourceObject",
	description: "A JSON:API included resource object with a server-assigned id.",
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
 * Schema for a resource object submitted for update.
 *
 * Update requests target an existing server resource and therefore must carry
 * a server-assigned `id`.
 */
export const UpdateResourceObject = PersistedResourceObject.annotate({
	identifier: "JsonApiUpdateResourceObject",
	description: "A JSON:API resource object submitted for update.",
});

/**
 * Schema for data values that can identify or represent a resource.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ResourceData)({ type: "articles", id: "1" });
 * ```
 */
export const ResourceData = Schema.Union([ResourceObject, ResourceIdentifierObject]).annotate({
	identifier: "JsonApiResourceData",
	description: "A JSON:API resource object or resource identifier object.",
});

/**
 * Schema for response data values that identify or represent persisted resources.
 */
export const ResponseResourceData = Schema.Union([
	ResponseResourceObject,
	PersistedResourceIdentifierObject,
]).annotate({
	identifier: "JsonApiResponseResourceData",
	description: "A JSON:API response resource object or persisted resource identifier object.",
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
	ResourceData,
	Schema.Null,
	Schema.Array(ResourceData),
]).annotate({
	identifier: "JsonApiPrimaryData",
	description: "A JSON:API top-level primary data value.",
});

/**
 * Type of top-level JSON:API primary data decoded by {@link PrimaryData}.
 */
export type PrimaryData = typeof PrimaryData.Type;

/**
 * Schema for response primary data.
 *
 * Response resource objects and resource identifiers must use server-assigned
 * ids rather than only local ids.
 */
export const ResponsePrimaryData = Schema.Union([
	ResponseResourceData,
	Schema.Null,
	Schema.Array(ResponseResourceData),
]).annotate({
	identifier: "JsonApiResponsePrimaryData",
	description: "A JSON:API response primary data value.",
});

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

/**
 * Builds a resource identifier schema for a concrete resource type and id schema.
 *
 * @example
 * ```ts
 * const ArticleIdentifier = resourceIdentifier("articles", Schema.String);
 *
 * Schema.decodeUnknownSync(ArticleIdentifier)({
 * 	type: "articles",
 * 	id: "1",
 * });
 * ```
 */
export const resourceIdentifier = <Type extends string, Id extends Schema.Top>(
	type: Type,
	id: Id,
) =>
	Schema.Struct({
		type: Schema.Literal(type),
		id: Schema.optionalKey(id),
		lid: Schema.optionalKey(LocalId),
		meta: Schema.optionalKey(MetaObject),
	}).check(
		Schema.makeFilter((value) =>
			"id" in value || "lid" in value
				? undefined
				: "A resource identifier object must contain id or lid",
		),
	);

/**
 * Builds a resource object schema for a concrete resource type.
 *
 * @example
 * ```ts
 * const Article = resourceObject({
 * 	type: "articles",
 * 	id: Schema.String,
 * 	attributes: Schema.Struct({ title: Schema.String }),
 * 	relationships: Schema.Struct({}),
 * });
 * ```
 */
export const resourceObject = <
	Type extends string,
	Id extends Schema.Top,
	Attributes extends Schema.Top,
	Relationships extends Schema.Top,
>(options: {
	readonly type: Type;
	readonly id: Id;
	readonly attributes: Attributes;
	readonly relationships: Relationships;
}) =>
	Schema.Struct({
		type: Schema.Literal(options.type),
		id: Schema.optionalKey(options.id),
		lid: Schema.optionalKey(LocalId),
		attributes: Schema.optionalKey(options.attributes),
		relationships: Schema.optionalKey(options.relationships),
		links: Schema.optionalKey(LinksObject),
		meta: Schema.optionalKey(MetaObject),
	}).check(Schema.makeFilter(fieldCollisionIssues));
