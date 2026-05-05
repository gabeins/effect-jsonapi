import { Schema } from "effect";
import { relationshipDocument, requestDataDocument } from "./Document.js";
import { NewResourceObject, ResourceIdentifierObject, UpdateResourceObject } from "./Resource.js";

/**
 * Schema for a generic JSON:API create-resource request document.
 *
 * The primary data must be a new resource object without a server-assigned `id`.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(CreateResourceDocument)({
 * 	data: { type: "articles", attributes: { title: "New article" } },
 * });
 * ```
 */
export const CreateResourceDocument = requestDataDocument(NewResourceObject).annotate({
	identifier: "JsonApiCreateResourceDocument",
	description: "A JSON:API request document for creating a resource.",
});

/**
 * Schema for a generic JSON:API update-resource request document.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(UpdateResourceDocument)({
 * 	data: { type: "articles", id: "1", attributes: { title: "Updated" } },
 * });
 * ```
 */
export const UpdateResourceDocument = requestDataDocument(UpdateResourceObject).annotate({
	identifier: "JsonApiUpdateResourceDocument",
	description: "A JSON:API request document for updating a resource.",
});

/**
 * Schema for a generic to-one relationship update request document.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ToOneRelationshipDocument)({
 * 	data: { type: "people", id: "9" },
 * });
 * ```
 */
export const ToOneRelationshipDocument = relationshipDocument(
	Schema.Union([ResourceIdentifierObject, Schema.Null]),
).annotate({
	identifier: "JsonApiToOneRelationshipDocument",
	description: "A JSON:API request document for a to-one relationship update.",
});

/**
 * Schema for a generic to-many relationship update request document.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ToManyRelationshipDocument)({
 * 	data: [{ type: "comments", id: "1" }],
 * });
 * ```
 */
export const ToManyRelationshipDocument = relationshipDocument(
	Schema.Array(ResourceIdentifierObject),
).annotate({
	identifier: "JsonApiToManyRelationshipDocument",
	description: "A JSON:API request document for a to-many relationship update.",
});

/**
 * Builds a create-resource request document schema for a concrete resource schema.
 *
 * @example
 * ```ts
 * const CreateArticleDocument = createResourceDocument(NewArticleResource);
 * ```
 */
export const createResourceDocument = <Resource extends Schema.Top>(resource: Resource) =>
	requestDataDocument(resource);

/**
 * Builds an update-resource request document schema for a concrete resource schema.
 *
 * @example
 * ```ts
 * const UpdateArticleDocument = updateResourceDocument(ArticleResource);
 * ```
 */
export const updateResourceDocument = <Resource extends Schema.Top>(resource: Resource) =>
	requestDataDocument(resource);

/**
 * Builds a to-one relationship document schema for a concrete identifier schema.
 *
 * @example
 * ```ts
 * const AuthorRelationshipDocument = toOneRelationshipDocument(PersonIdentifier);
 * ```
 */
export const toOneRelationshipDocument = <Identifier extends Schema.Top>(identifier: Identifier) =>
	relationshipDocument(Schema.Union([identifier, Schema.Null]));

/**
 * Builds a to-many relationship document schema for a concrete identifier schema.
 *
 * @example
 * ```ts
 * const CommentsRelationshipDocument = toManyRelationshipDocument(CommentIdentifier);
 * ```
 */
export const toManyRelationshipDocument = <Identifier extends Schema.Top>(identifier: Identifier) =>
	relationshipDocument(Schema.Array(identifier));
