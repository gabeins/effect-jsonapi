import type * as Resource from "./Resource.js";

/**
 * A to-one JSON:API relationship to another resource definition.
 *
 * The target resource is referenced lazily so that mutually related resources
 * can be defined across modules.
 */
export interface ToOne<out Target extends Resource.Any = Resource.Any> {
	readonly _tag: "JsonApiRelationshipToOne";
	readonly resource: () => Target;
	readonly nullable: boolean;
}

/**
 * A to-many JSON:API relationship to another resource definition.
 *
 * The target resource is referenced lazily so that mutually related resources
 * can be defined across modules.
 */
export interface ToMany<out Target extends Resource.Any = Resource.Any> {
	readonly _tag: "JsonApiRelationshipToMany";
	readonly resource: () => Target;
}

/**
 * A JSON:API relationship definition.
 */
export type Relationship<Target extends Resource.Any = Resource.Any> =
	| ToOne<Target>
	| ToMany<Target>;

/**
 * Any JSON:API relationship definition.
 */
export type Any = Relationship<any>;

/**
 * A record of named JSON:API relationship definitions, as accepted by
 * `Resource.make`.
 */
export type Fields = {
	readonly [name: string]: Any;
};

/**
 * Extracts the target resource definition of a relationship.
 */
export type Target<R extends Any> = R extends Relationship<infer T> ? T : never;

/**
 * Defines a to-one relationship to another resource.
 *
 * To-one relationship linkage is nullable by default, matching the JSON:API
 * empty to-one relationship (`data: null`). Pass `nullable: false` to require
 * a resource identifier.
 *
 * For mutually related resources, annotate the thunk return type explicitly to
 * break type-level circularity, or fall back to `Resource.Any`.
 *
 * @example
 * ```ts
 * const PostResource = Resource.make("posts", {
 * 	attributes: { title: Schema.String },
 * 	relationships: {
 * 		author: Relationship.toOne(() => UserResource, { nullable: false }),
 * 	},
 * });
 * ```
 */
export const toOne = <Target extends Resource.Any>(
	resource: () => Target,
	options?: {
		readonly nullable?: boolean;
	},
): ToOne<Target> => ({
	_tag: "JsonApiRelationshipToOne",
	resource,
	nullable: options?.nullable ?? true,
});

/**
 * Defines a to-many relationship to another resource.
 *
 * @example
 * ```ts
 * const UserResource = Resource.make("users", {
 * 	attributes: { name: Schema.String },
 * 	relationships: {
 * 		posts: Relationship.toMany(() => PostResource),
 * 	},
 * });
 * ```
 */
export const toMany = <Target extends Resource.Any>(resource: () => Target): ToMany<Target> => ({
	_tag: "JsonApiRelationshipToMany",
	resource,
});

/**
 * Returns whether a relationship definition is a to-one relationship.
 */
export const isToOne = (relationship: Any): relationship is ToOne =>
	relationship._tag === "JsonApiRelationshipToOne";

/**
 * Returns whether a relationship definition is a to-many relationship.
 */
export const isToMany = (relationship: Any): relationship is ToMany =>
	relationship._tag === "JsonApiRelationshipToMany";
