import { Schema } from "effect";
import { extensibleObject } from "./Extension.js";
import { JSON_API_MEDIA_TYPE } from "./MediaType.js";
import { MetaObject } from "./Meta.js";
import { ObjectMemberName } from "./MemberName.js";
import { UriReference } from "./Uri.js";

/**
 * JSON:API link value.
 *
 * A link can be a URI-reference string, a link object with metadata, or `null`
 * when a link exists but does not currently have a target.
 *
 * @example
 * ```ts
 * const self: Link = "/articles/1";
 * ```
 */
export type Link = string | LinkObject | null;

/**
 * JSON:API link object.
 */
export type LinkObject = {
	readonly href: string;
	readonly rel?: string;
	readonly describedby?: Link;
	readonly title?: string;
	readonly type?: string;
	readonly hreflang?: string | ReadonlyArray<string>;
	readonly meta?: typeof MetaObject.Type;
	readonly [key: string]: unknown;
};

const linkSchema = (): Schema.Codec<Link> => Link;

/**
 * Schema for a web link relation type.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(LinkRelationType)("related");
 * ```
 */
export const LinkRelationType = Schema.String.check(
	Schema.makeFilter((value) =>
		value.length > 0 && !/\s/.test(value)
			? undefined
			: "Link relation types must be non-empty strings without whitespace",
	),
).annotate({
	identifier: "JsonApiLinkRelationType",
	description: "A web link relation type.",
});

/**
 * Schema for the optional media type hint on a JSON:API link object.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(LinkTargetMediaType)("application/vnd.api+json");
 * ```
 */
export const LinkTargetMediaType = Schema.String.check(
	Schema.makeFilter((value) =>
		value.includes("/")
			? undefined
			: "Link target media types must contain a type and subtype separated by /",
	),
).annotate({
	identifier: "JsonApiLinkTargetMediaType",
	description: "A media type hint for a JSON:API link object.",
	examples: [JSON_API_MEDIA_TYPE],
});

/**
 * Schema for a BCP 47-style language tag used by link objects.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(LanguageTag)("en-US");
 * ```
 */
export const LanguageTag = Schema.String.check(
	Schema.makeFilter((value) =>
		value.length > 0 && /^[A-Za-z0-9-]+$/.test(value)
			? undefined
			: "Language tags must be non-empty BCP 47-style strings",
	),
).annotate({
	identifier: "JsonApiLanguageTag",
	description: "A language tag for a JSON:API link object.",
});

/**
 * JSON:API link object class.
 *
 * Use this when a link needs metadata such as a title, relation, language, or
 * target media type instead of only an href string.
 *
 * @example
 * ```ts
 * const link = new LinkObject({
 * 	href: "/articles/1",
 * 	rel: "self",
 * 	type: "application/vnd.api+json",
 * });
 * ```
 */
const LinkObjectStruct = Schema.Struct({
	href: UriReference,
	rel: Schema.optionalKey(LinkRelationType),
	describedby: Schema.optionalKey(Schema.suspend(linkSchema)),
	title: Schema.optionalKey(Schema.String),
	type: Schema.optionalKey(LinkTargetMediaType),
	hreflang: Schema.optionalKey(Schema.Union([LanguageTag, Schema.Array(LanguageTag)])),
	meta: Schema.optionalKey(MetaObject),
});

/**
 * Schema for a JSON:API link object.
 */
export const LinkObject: Schema.Codec<LinkObject> = extensibleObject(LinkObjectStruct).annotate({
	identifier: "JsonApiLinkObject",
	description: "A JSON:API link object.",
});

/**
 * Schema for a JSON:API link value.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(Link)({ href: "/articles/1", title: "Article" });
 * ```
 */
export const Link: Schema.Codec<Link> = Schema.Union([
	UriReference,
	LinkObject,
	Schema.Null,
]).annotate({
	identifier: "JsonApiLink",
	description: "A JSON:API link represented as a URI-reference, link object, or null.",
});

/**
 * Schema for a JSON:API links object keyed by link relation names.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(LinksObject)({
 * 	self: "/articles/1",
 * 	related: "/articles/1/comments",
 * });
 * ```
 */
export const LinksObject = Schema.Record(ObjectMemberName, Link).annotate({
	identifier: "JsonApiLinksObject",
	description: "A JSON:API links object.",
});

/**
 * Type of a JSON:API links object decoded by {@link LinksObject}.
 */
export type LinksObject = typeof LinksObject.Type;

/**
 * Schema for relationship-level links.
 *
 * Relationship links must include at least one member, usually `self` or
 * `related`.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(RelationshipLinksObject)({
 * 	related: "/articles/1/author",
 * });
 * ```
 */
export const RelationshipLinksObject = LinksObject.check(
	Schema.makeFilter((value) =>
		Object.keys(value).length > 0
			? undefined
			: "A relationship links object must contain at least one link",
	),
).annotate({
	identifier: "JsonApiRelationshipLinksObject",
	description: "A JSON:API relationship links object.",
});

/**
 * Schema for JSON:API pagination links.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(PaginationLinks)({
 * 	first: "/articles?page[number]=1",
 * 	next: "/articles?page[number]=2",
 * });
 * ```
 */
export const PaginationLinks = Schema.Struct({
	first: Schema.optionalKey(Link),
	last: Schema.optionalKey(Link),
	prev: Schema.optionalKey(Link),
	next: Schema.optionalKey(Link),
}).annotate({
	identifier: "JsonApiPaginationLinks",
	description: "JSON:API pagination links.",
});

/**
 * Type of pagination links decoded by {@link PaginationLinks}.
 */
export type PaginationLinks = typeof PaginationLinks.Type;
