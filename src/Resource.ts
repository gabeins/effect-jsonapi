import { Schema } from "effect";
import type { ResourceDocument } from "./Document.js";
import {
	JsonApiObject,
	LocalId,
	relationshipDocument,
	requestDataDocument,
	ResourceId,
} from "./Document.js";
import { LinksObject, RelationshipLinksObject } from "./Link.js";
import { asJsonApi } from "./MediaType.js";
import { MetaObject } from "./Meta.js";
import { isFieldName, isMemberName } from "./MemberName.js";
import * as Relationship from "./Relationship.js";

/**
 * Constraint for resource id schemas.
 *
 * JSON:API resource ids must be strings on the wire, so id schemas must decode
 * to a string (or branded string) type.
 */
export type IdSchema = Schema.Top & { readonly Type: string };

/**
 * A JSON:API resource definition.
 *
 * A resource definition ties a resource `type` to an id schema, an attributes
 * struct, and named relationships to other resource definitions. All request
 * and response document schemas are derived from it.
 *
 * Created with {@link make}.
 */
export interface JsonApiResource<
	Type extends string = string,
	Id extends IdSchema = IdSchema,
	AttributeFields extends Schema.Struct.Fields = Schema.Struct.Fields,
	Relationships extends Relationship.Fields = {},
> {
	/** The JSON:API resource type. */
	readonly type: Type;
	/** The schema for the resource id. */
	readonly id: Id;
	/** The schema for the resource attributes object. */
	readonly attributes: Schema.Struct<AttributeFields>;
	/** The relationship definitions of this resource. */
	readonly relationships: Relationships;

	/**
	 * Schema for a resource identifier object of this resource:
	 * `{ type, id, meta? }`.
	 */
	readonly Identifier: Schema.Codec<
		IdentifierFor<JsonApiResource<Type, Id, AttributeFields, Relationships>>
	>;

	/**
	 * Schema for a response resource object of this resource. Attributes are
	 * individually optional so that sparse fieldsets remain valid documents.
	 */
	readonly ResourceObject: Schema.Codec<
		ResourceObjectFor<JsonApiResource<Type, Id, AttributeFields, Relationships>>
	>;

	/**
	 * Schema for a single-resource response document. Use as an `HttpApiEndpoint`
	 * success schema; it carries the JSON:API media type.
	 */
	readonly Document: Schema.Codec<
		ResourceDocument<ResourceObjectFor<JsonApiResource<Type, Id, AttributeFields, Relationships>>>
	>;

	/**
	 * Schema for a nullable single-resource response document, used by to-one
	 * related resource endpoints.
	 */
	readonly NullableDocument: Schema.Codec<
		ResourceDocument<ResourceObjectFor<
			JsonApiResource<Type, Id, AttributeFields, Relationships>
		> | null>
	>;

	/**
	 * Schema for a resource-collection response document.
	 */
	readonly CollectionDocument: Schema.Codec<
		ResourceDocument<
			ReadonlyArray<ResourceObjectFor<JsonApiResource<Type, Id, AttributeFields, Relationships>>>
		>
	>;

	/**
	 * Schema for a create-resource request document (`POST` payload). The primary
	 * data must not carry a server-assigned `id` and requires full attributes.
	 */
	readonly CreateDocument: Schema.Codec<
		CreateDocumentFor<JsonApiResource<Type, Id, AttributeFields, Relationships>>
	>;

	/**
	 * Schema for an update-resource request document (`PATCH` payload). Attributes
	 * and relationships are partial; missing members keep their current values.
	 */
	readonly UpdateDocument: Schema.Codec<
		UpdateDocumentFor<JsonApiResource<Type, Id, AttributeFields, Relationships>>
	>;
}

/**
 * Any JSON:API resource definition.
 */
export type Any = JsonApiResource<any, any, any, any>;

/**
 * Extracts the resource type literal of a resource definition.
 */
export type TypeOf<R extends Any> = R["type"];

/**
 * Extracts the decoded id type of a resource definition.
 */
export type IdOf<R extends Any> = R["id"]["Type"];

/**
 * Extracts the decoded attributes type of a resource definition.
 */
export type AttributesOf<R extends Any> = R["attributes"]["Type"];

/**
 * The resource identifier object shape of a resource definition.
 */
export interface IdentifierFor<R extends Any> {
	readonly type: TypeOf<R>;
	readonly id: IdOf<R>;
	readonly meta?: MetaObject;
}

/**
 * The resource linkage shape of a relationship definition.
 */
export type LinkageFor<Rel extends Relationship.Any> =
	Rel extends Relationship.ToOne<infer Target>
		? IdentifierFor<Target> | null
		: Rel extends Relationship.ToMany<infer Target>
			? ReadonlyArray<IdentifierFor<Target>>
			: never;

/**
 * The response relationship object shape of a relationship definition.
 */
export interface RelationshipObjectFor<Rel extends Relationship.Any> {
	readonly data?: LinkageFor<Rel>;
	readonly links?: LinksObject;
	readonly meta?: MetaObject;
}

/**
 * The response resource object shape of a resource definition.
 */
export interface ResourceObjectFor<R extends Any> {
	readonly type: TypeOf<R>;
	readonly id: IdOf<R>;
	readonly attributes?: Partial<AttributesOf<R>>;
	readonly relationships?: {
		readonly [K in keyof R["relationships"]]?: RelationshipObjectFor<R["relationships"][K]>;
	};
	readonly links?: LinksObject;
	readonly meta?: MetaObject;
}

/**
 * The request relationship object shape of a relationship definition.
 *
 * Relationship objects provided in request documents must contain `data`.
 */
export interface RequestRelationshipObjectFor<Rel extends Relationship.Any> {
	readonly data: LinkageFor<Rel>;
	readonly meta?: MetaObject;
}

/**
 * The create-resource request document shape of a resource definition.
 */
export interface CreateDocumentFor<R extends Any> {
	readonly data: {
		readonly type: TypeOf<R>;
		readonly lid?: string;
		readonly attributes: AttributesOf<R>;
		readonly relationships?: {
			readonly [K in keyof R["relationships"]]?: RequestRelationshipObjectFor<
				R["relationships"][K]
			>;
		};
		readonly meta?: MetaObject;
	};
	readonly links?: LinksObject;
	readonly meta?: MetaObject;
	readonly jsonapi?: JsonApiObject;
}

/**
 * The update-resource request document shape of a resource definition.
 */
export interface UpdateDocumentFor<R extends Any> {
	readonly data: {
		readonly type: TypeOf<R>;
		readonly id: IdOf<R>;
		readonly attributes?: Partial<AttributesOf<R>>;
		readonly relationships?: {
			readonly [K in keyof R["relationships"]]?: RequestRelationshipObjectFor<
				R["relationships"][K]
			>;
		};
		readonly meta?: MetaObject;
	};
	readonly links?: LinksObject;
	readonly meta?: MetaObject;
	readonly jsonapi?: JsonApiObject;
}

/**
 * A reference to a related resource by id, optionally carrying identifier
 * `meta`.
 */
export type Ref<R extends Any> =
	| IdOf<R>
	| {
			readonly id: IdOf<R>;
			readonly meta?: MetaObject;
	  };

/**
 * An entity value for a relationship: either a reference (linkage only) or a
 * full embedded entity (linkage plus availability for compound `included`).
 */
export type EntityRelationshipFor<Rel extends Relationship.Any> =
	Rel extends Relationship.ToOne<infer Target>
		? Ref<Target> | Entity<Target> | null
		: Rel extends Relationship.ToMany<infer Target>
			? ReadonlyArray<Ref<Target> | Entity<Target>>
			: never;

/**
 * The serialization input for a resource definition, as accepted by the
 * `Document.fromResource` and `Document.fromCollection` builders.
 *
 * `attributes` accepts any value of the attributes type; extra properties (such
 * as the model id) are ignored during serialization. Relationship values may be
 * plain ids, `{ id, meta }` references, or full embedded entities of the target
 * resource. Embedded entities become compound `included` resources when their
 * path is requested via the `include` query parameter.
 */
export interface Entity<R extends Any> {
	readonly id: IdOf<R>;
	readonly attributes: AttributesOf<R>;
	readonly relationships?: {
		readonly [K in keyof R["relationships"]]?: EntityRelationshipFor<R["relationships"][K]>;
	};
	readonly links?: LinksObject;
	readonly meta?: MetaObject;
}

type AttributesInput = Schema.Struct.Fields | Schema.Struct<Schema.Struct.Fields>;

type AttributeFieldsOf<A extends AttributesInput> =
	A extends Schema.Struct<infer Fields> ? Fields : A extends Schema.Struct.Fields ? A : never;

const isStructSchema = (value: AttributesInput): value is Schema.Struct<Schema.Struct.Fields> =>
	"ast" in value && "fields" in value && "make" in value;

const documentFields = (data: Schema.Top) => ({
	jsonapi: Schema.optionalKey(JsonApiObject),
	links: Schema.optionalKey(LinksObject),
	data,
	meta: Schema.optionalKey(MetaObject),
});

/**
 * Creates a JSON:API resource definition.
 *
 * The resource `type`, attribute names, and relationship names are validated
 * eagerly: invalid member names or attribute/relationship collisions throw at
 * definition time.
 *
 * @example
 * ```ts
 * const UserResource = Resource.make("users", {
 * 	attributes: {
 * 		name: Schema.String,
 * 		email: Schema.NullOr(Schema.String),
 * 	},
 * 	relationships: {
 * 		posts: Relationship.toMany(() => PostResource),
 * 	},
 * });
 * ```
 */
export const make = <
	const Type extends string,
	const Attributes extends AttributesInput,
	Id extends IdSchema = typeof ResourceId,
	const Relationships extends Relationship.Fields = {},
>(
	type: Type,
	options: {
		readonly id?: Id;
		readonly attributes: Attributes;
		readonly relationships?: Relationships;
	},
): JsonApiResource<Type, Id, AttributeFieldsOf<Attributes>, Relationships> => {
	if (!isMemberName(type)) {
		throw new Error(`Invalid JSON:API resource type: ${type}`);
	}

	const id = (options.id ?? ResourceId) as unknown as Id;
	const attributes = (
		isStructSchema(options.attributes) ? options.attributes : Schema.Struct(options.attributes)
	) as Schema.Struct<AttributeFieldsOf<Attributes>>;
	const relationships = (options.relationships ?? {}) as Relationships;

	const attributeNames = Object.keys(attributes.fields);
	for (const name of attributeNames) {
		if (!isFieldName(name)) {
			throw new Error(`Invalid JSON:API attribute name on resource "${type}": ${name}`);
		}
	}
	const attributeNameSet = new Set(attributeNames);
	for (const name of Object.keys(relationships)) {
		if (!isFieldName(name)) {
			throw new Error(`Invalid JSON:API relationship name on resource "${type}": ${name}`);
		}
		if (attributeNameSet.has(name)) {
			throw new Error(
				`Attribute and relationship fields share the same name on resource "${type}": ${name}`,
			);
		}
	}

	const idSchema = id as unknown as Schema.Top;

	const Identifier = Schema.Struct({
		type: Schema.Literal(type),
		id: idSchema,
		meta: Schema.optionalKey(MetaObject),
	}).annotate({
		identifier: `${type}.identifier`,
		description: `A JSON:API resource identifier object for the "${type}" resource.`,
	});

	const self = {
		type,
		id,
		attributes,
		relationships,
		Identifier,
	} as Record<string, unknown>;

	const targetIdentifier = (relationship: Relationship.Any): Schema.Top =>
		Schema.suspend(() => relationship.resource().Identifier as unknown as Schema.Top);

	const responseLinkage = (relationship: Relationship.Relationship): Schema.Top => {
		if (relationship._tag === "JsonApiRelationshipToMany") {
			return Schema.Array(targetIdentifier(relationship));
		}
		return relationship.nullable
			? Schema.Union([targetIdentifier(relationship), Schema.Null])
			: targetIdentifier(relationship);
	};

	const responseRelationshipFields = Object.fromEntries(
		Object.entries(relationships).map(([name, relationship]) => [
			name,
			Schema.optionalKey(
				Schema.Struct({
					data: Schema.optionalKey(responseLinkage(relationship)),
					links: Schema.optionalKey(RelationshipLinksObject),
					meta: Schema.optionalKey(MetaObject),
				}),
			),
		]),
	);

	const requestRelationshipFields = Object.fromEntries(
		Object.entries(relationships).map(([name, relationship]) => [
			name,
			Schema.optionalKey(
				Schema.Struct({
					data: responseLinkage(relationship),
					meta: Schema.optionalKey(MetaObject),
				}),
			),
		]),
	);

	const partialAttributeFields = Object.fromEntries(
		Object.entries(attributes.fields).map(([name, field]) => [
			name,
			Schema.optionalKey(field as Schema.Top),
		]),
	);

	const ResourceObject = Schema.Struct({
		type: Schema.Literal(type),
		id: idSchema,
		attributes: Schema.optionalKey(Schema.Struct(partialAttributeFields)),
		relationships: Schema.optionalKey(Schema.Struct(responseRelationshipFields)),
		links: Schema.optionalKey(LinksObject),
		meta: Schema.optionalKey(MetaObject),
	}).annotate({
		identifier: `${type}.resource`,
		description: `A JSON:API resource object for the "${type}" resource.`,
	});

	// The compound `included` member may contain any resource reachable through
	// this resource's relationship graph, encoded with its own resource schema.
	// The union is computed lazily so that mutually recursive definitions are
	// fully constructed before their thunks resolve.
	let includedUnion: Schema.Top | undefined;
	const Included = Schema.Array(
		Schema.suspend(() => {
			if (includedUnion === undefined) {
				const reachable = new Map<string, Schema.Top>();
				const queue: Array<Record<string, unknown>> = [self];
				while (queue.length > 0) {
					const current = queue.shift() as {
						type: string;
						relationships: Relationship.Fields;
						ResourceObject: Schema.Top;
					};
					if (reachable.has(current.type)) {
						continue;
					}
					reachable.set(current.type, current.ResourceObject);
					for (const relationship of Object.values(current.relationships)) {
						queue.push(relationship.resource() as unknown as Record<string, unknown>);
					}
				}
				const members = [...reachable.values()];
				includedUnion =
					members.length === 1
						? (members[0] as Schema.Top)
						: (Schema.Union(members as ReadonlyArray<Schema.Top>) as unknown as Schema.Top);
			}
			return includedUnion;
		}),
	);

	const documentSchema = (data: Schema.Top, suffix: string, description: string) =>
		Schema.Struct({
			...documentFields(data),
			included: Schema.optionalKey(Included),
		})
			.annotate({
				identifier: `${type}.${suffix}`,
				description,
			})
			.pipe(asJsonApi());

	const Document = documentSchema(
		ResourceObject,
		"document",
		`A JSON:API document with a single "${type}" resource.`,
	);

	const NullableDocument = documentSchema(
		Schema.NullOr(ResourceObject),
		"nullableDocument",
		`A JSON:API document with a single "${type}" resource or null.`,
	);

	const CollectionDocument = documentSchema(
		Schema.Array(ResourceObject),
		"collectionDocument",
		`A JSON:API document with a collection of "${type}" resources.`,
	);

	const CreateDocument = requestDataDocument(
		Schema.Struct({
			type: Schema.Literal(type),
			// Client-generated ids are not supported: any `id` member is rejected so
			// that servers can respond with `400 Bad Request` per the specification.
			id: Schema.optionalKey(Schema.Never),
			lid: Schema.optionalKey(LocalId),
			attributes,
			relationships: Schema.optionalKey(Schema.Struct(requestRelationshipFields)),
			meta: Schema.optionalKey(MetaObject),
		}),
	)
		.annotate({
			identifier: `${type}.createDocument`,
			description: `A JSON:API request document for creating a "${type}" resource.`,
		})
		.pipe(asJsonApi());

	const UpdateDocument = requestDataDocument(
		Schema.Struct({
			type: Schema.Literal(type),
			id: idSchema,
			attributes: Schema.optionalKey(Schema.Struct(partialAttributeFields)),
			relationships: Schema.optionalKey(Schema.Struct(requestRelationshipFields)),
			meta: Schema.optionalKey(MetaObject),
		}),
	)
		.annotate({
			identifier: `${type}.updateDocument`,
			description: `A JSON:API request document for updating a "${type}" resource.`,
		})
		.pipe(asJsonApi());

	self.ResourceObject = ResourceObject;
	self.Document = Document;
	self.NullableDocument = NullableDocument;
	self.CollectionDocument = CollectionDocument;
	self.CreateDocument = CreateDocument;
	self.UpdateDocument = UpdateDocument;

	return self as unknown as JsonApiResource<Type, Id, AttributeFieldsOf<Attributes>, Relationships>;
};

/**
 * Builds a request document schema for replacing a to-one relationship.
 *
 * The primary data is a resource identifier of the target resource or `null`.
 *
 * @example
 * ```ts
 * const AuthorRelationshipDocument = Resource.toOneRelationshipDocument(UserResource);
 * ```
 */
export const toOneRelationshipDocument = <R extends Any>(resource: R) =>
	relationshipDocument(Schema.NullOr(resource.Identifier as unknown as Schema.Top)).pipe(
		asJsonApi(),
	) as unknown as Schema.Codec<{
		readonly data: IdentifierFor<R> | null;
		readonly links?: LinksObject;
		readonly meta?: MetaObject;
	}>;

/**
 * Builds a request document schema for replacing a to-many relationship.
 *
 * The primary data is an array of resource identifiers of the target resource.
 *
 * @example
 * ```ts
 * const PostsRelationshipDocument = Resource.toManyRelationshipDocument(PostResource);
 * ```
 */
export const toManyRelationshipDocument = <R extends Any>(resource: R) =>
	relationshipDocument(Schema.Array(resource.Identifier as unknown as Schema.Top)).pipe(
		asJsonApi(),
	) as unknown as Schema.Codec<{
		readonly data: ReadonlyArray<IdentifierFor<R>>;
		readonly links?: LinksObject;
		readonly meta?: MetaObject;
	}>;
