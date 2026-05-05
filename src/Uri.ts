import { Schema } from "effect";

/**
 * Returns whether a value is an absolute URI.
 *
 * Use this for JSON:API extension and profile identifiers, which must be URIs
 * rather than relative references.
 *
 * @example
 * ```ts
 * isUri("https://jsonapi.org/ext/version"); // true
 * isUri("/articles/1"); // false
 * ```
 */
export const isUri = (value: string): boolean => {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
};

/**
 * Returns whether a value can be parsed as a URI-reference.
 *
 * JSON:API links may be absolute URI strings or relative URI-reference strings.
 *
 * @example
 * ```ts
 * isUriReference("/articles/1"); // true
 * isUriReference("https://api.example.com/articles/1"); // true
 * ```
 */
export const isUriReference = (value: string): boolean => {
	try {
		new URL(value, "https://jsonapi.local");
		return true;
	} catch {
		return false;
	}
};

/**
 * Schema for an absolute URI used by JSON:API extension and profile metadata.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(Uri)("https://example.com/profile/timestamps");
 * ```
 */
export const Uri = Schema.String.check(
	Schema.makeFilter((value) => (isUri(value) ? undefined : "Expected an absolute URI")),
).annotate({
	identifier: "JsonApiUri",
	description: "A URI used to identify a JSON:API extension or profile.",
});

/**
 * Schema for a URI-reference used as a JSON:API link target.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(UriReference)("/articles/1");
 * ```
 */
export const UriReference = Schema.String.check(
	Schema.makeFilter((value) =>
		isUriReference(value) ? undefined : "Expected a valid URI-reference",
	),
).annotate({
	identifier: "JsonApiUriReference",
	description: "A URI-reference used as a JSON:API link target.",
});
