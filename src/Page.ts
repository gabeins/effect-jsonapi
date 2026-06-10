import { Schema, SchemaGetter } from "effect";
import type { PaginationLinks } from "./Link.js";
import type { MetaObject } from "./Meta.js";

/**
 * A pagination strategy for the JSON:API `page` query parameter family.
 *
 * A strategy decodes the collected `page[...]` parameters (keyed by the inner
 * bracket name) into a typed page value, and encodes it back for link and
 * OpenAPI generation.
 */
export interface Strategy<A> {
	readonly _tag: "JsonApiPageStrategy";
	/** The inner `page[...]` parameter names understood by this strategy. */
	readonly keys: ReadonlyArray<string>;
	/** Decodes the collected `page[...]` parameters into the page value. */
	readonly schema: Schema.Codec<A, { readonly [key: string]: string }>;
}

const strategy = <A>(
	keys: ReadonlyArray<string>,
	schema: Schema.Codec<A, { readonly [key: string]: string }>,
): Strategy<A> => ({
	_tag: "JsonApiPageStrategy",
	keys,
	schema,
});

const positiveIntFromString = Schema.NumberFromString.check(
	Schema.isInt(),
	Schema.isGreaterThanOrEqualTo(1),
);

const nonNegativeIntFromString = Schema.NumberFromString.check(
	Schema.isInt(),
	Schema.isGreaterThanOrEqualTo(0),
);

/**
 * A page-number/page-size pagination value.
 */
export interface NumberSize {
	readonly number: number;
	readonly size: number;
}

/**
 * Page-based pagination via `page[number]` and `page[size]`.
 *
 * Both parameters are optional on the wire and filled with the configured
 * defaults. Sizes above `maxSize` are rejected with a validation error, which
 * the JSON:API middleware reports as `400 Bad Request`.
 *
 * @example
 * ```ts
 * const query = Query.schema(UserResource, {
 * 	page: Page.numberSize({ defaultSize: 10, maxSize: 100 }),
 * });
 * ```
 */
export const numberSize = (
	options: {
		readonly defaultNumber?: number;
		readonly defaultSize?: number;
		readonly maxSize?: number;
	} = {},
): Strategy<NumberSize> => {
	const defaultNumber = options.defaultNumber ?? 1;
	const defaultSize = options.defaultSize ?? 10;
	const size =
		options.maxSize === undefined
			? positiveIntFromString
			: positiveIntFromString.check(Schema.isLessThanOrEqualTo(options.maxSize));

	const Decoded = Schema.Struct({
		number: Schema.Number,
		size: Schema.Number,
	});

	const schema = Schema.Struct({
		number: Schema.optionalKey(positiveIntFromString),
		size: Schema.optionalKey(size),
	}).pipe(
		Schema.decodeTo(Decoded, {
			decode: SchemaGetter.transform((page: { number?: number; size?: number }) => ({
				number: page.number ?? defaultNumber,
				size: page.size ?? defaultSize,
			})),
			encode: SchemaGetter.transform((page: NumberSize) => page),
		}),
	);

	return strategy(
		["number", "size"],
		schema as unknown as Schema.Codec<NumberSize, { readonly [key: string]: string }>,
	);
};

/**
 * An offset/limit pagination value.
 */
export interface OffsetLimit {
	readonly offset: number;
	readonly limit: number;
}

/**
 * Offset-based pagination via `page[offset]` and `page[limit]`.
 *
 * @example
 * ```ts
 * const query = Query.schema(UserResource, {
 * 	page: Page.offsetLimit({ defaultLimit: 10, maxLimit: 100 }),
 * });
 * ```
 */
export const offsetLimit = (
	options: {
		readonly defaultLimit?: number;
		readonly maxLimit?: number;
	} = {},
): Strategy<OffsetLimit> => {
	const defaultLimit = options.defaultLimit ?? 10;
	const limit =
		options.maxLimit === undefined
			? positiveIntFromString
			: positiveIntFromString.check(Schema.isLessThanOrEqualTo(options.maxLimit));

	const Decoded = Schema.Struct({
		offset: Schema.Number,
		limit: Schema.Number,
	});

	const schema = Schema.Struct({
		offset: Schema.optionalKey(nonNegativeIntFromString),
		limit: Schema.optionalKey(limit),
	}).pipe(
		Schema.decodeTo(Decoded, {
			decode: SchemaGetter.transform((page: { offset?: number; limit?: number }) => ({
				offset: page.offset ?? 0,
				limit: page.limit ?? defaultLimit,
			})),
			encode: SchemaGetter.transform((page: OffsetLimit) => page),
		}),
	);

	return strategy(
		["offset", "limit"],
		schema as unknown as Schema.Codec<OffsetLimit, { readonly [key: string]: string }>,
	);
};

/**
 * A cursor pagination value.
 */
export interface Cursor {
	readonly after?: string;
	readonly before?: string;
	readonly size: number;
}

/**
 * Cursor-based pagination via `page[after]`, `page[before]`, and `page[size]`.
 *
 * @example
 * ```ts
 * const query = Query.schema(UserResource, {
 * 	page: Page.cursor({ defaultSize: 10 }),
 * });
 * ```
 */
export const cursor = (
	options: {
		readonly defaultSize?: number;
		readonly maxSize?: number;
	} = {},
): Strategy<Cursor> => {
	const defaultSize = options.defaultSize ?? 10;
	const size =
		options.maxSize === undefined
			? positiveIntFromString
			: positiveIntFromString.check(Schema.isLessThanOrEqualTo(options.maxSize));

	const Decoded = Schema.Struct({
		after: Schema.optionalKey(Schema.String),
		before: Schema.optionalKey(Schema.String),
		size: Schema.Number,
	});

	const schema = Schema.Struct({
		after: Schema.optionalKey(Schema.String),
		before: Schema.optionalKey(Schema.String),
		size: Schema.optionalKey(size),
	}).pipe(
		Schema.decodeTo(Decoded, {
			decode: SchemaGetter.transform(
				(page: { after?: string; before?: string; size?: number }) => ({
					...page,
					size: page.size ?? defaultSize,
				}),
			),
			encode: SchemaGetter.transform((page: Cursor) => page),
		}),
	);

	return strategy(
		["after", "before", "size"],
		schema as unknown as Schema.Codec<Cursor, { readonly [key: string]: string }>,
	);
};

const withSearchParams = (
	url: string | URL,
	set: (parameters: URLSearchParams) => void,
): string => {
	const isAbsolute = typeof url !== "string" || /^[a-z][a-z0-9+.-]*:/i.test(url);
	const parsed = typeof url === "string" ? new URL(url, "https://jsonapi.local") : new URL(url);
	set(parsed.searchParams);
	return isAbsolute ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
};

/**
 * Builds JSON:API pagination links for {@link numberSize} pagination.
 *
 * All other query parameters of `url` are preserved. `next` and `last` are only
 * present when `totalPages` is known; alternatively pass `hasMore` to emit a
 * `next` link without totals.
 *
 * @example
 * ```ts
 * Page.numberSizeLinks({
 * 	url: request.url,
 * 	page: { number: 2, size: 10 },
 * 	totalPages: 5,
 * });
 * // { first, prev, next, last }
 * ```
 */
export const numberSizeLinks = (options: {
	readonly url: string | URL;
	readonly page: NumberSize;
	readonly totalPages?: number;
	readonly hasMore?: boolean;
}): PaginationLinks => {
	const pageLink = (number: number) =>
		withSearchParams(options.url, (parameters) => {
			parameters.set("page[number]", `${number}`);
			parameters.set("page[size]", `${options.page.size}`);
		});

	const links: {
		first?: string;
		prev?: string;
		next?: string;
		last?: string;
	} = {
		first: pageLink(1),
	};
	if (options.page.number > 1) {
		links.prev = pageLink(options.page.number - 1);
	}
	if (options.totalPages !== undefined) {
		links.last = pageLink(Math.max(1, options.totalPages));
		if (options.page.number < options.totalPages) {
			links.next = pageLink(options.page.number + 1);
		}
	} else if (options.hasMore === true) {
		links.next = pageLink(options.page.number + 1);
	}
	return links;
};

/**
 * Builds JSON:API pagination links for {@link offsetLimit} pagination.
 *
 * @example
 * ```ts
 * Page.offsetLimitLinks({
 * 	url: request.url,
 * 	page: { offset: 10, limit: 10 },
 * 	totalItems: 45,
 * });
 * ```
 */
export const offsetLimitLinks = (options: {
	readonly url: string | URL;
	readonly page: OffsetLimit;
	readonly totalItems?: number;
	readonly hasMore?: boolean;
}): PaginationLinks => {
	const pageLink = (offset: number) =>
		withSearchParams(options.url, (parameters) => {
			parameters.set("page[offset]", `${offset}`);
			parameters.set("page[limit]", `${options.page.limit}`);
		});

	const links: {
		first?: string;
		prev?: string;
		next?: string;
		last?: string;
	} = {
		first: pageLink(0),
	};
	if (options.page.offset > 0) {
		links.prev = pageLink(Math.max(0, options.page.offset - options.page.limit));
	}
	if (options.totalItems !== undefined) {
		const lastOffset = Math.max(
			0,
			Math.floor(Math.max(0, options.totalItems - 1) / options.page.limit) * options.page.limit,
		);
		links.last = pageLink(lastOffset);
		if (options.page.offset + options.page.limit < options.totalItems) {
			links.next = pageLink(options.page.offset + options.page.limit);
		}
	} else if (options.hasMore === true) {
		links.next = pageLink(options.page.offset + options.page.limit);
	}
	return links;
};

/**
 * Builds a JSON:API meta object describing a {@link numberSize} page.
 *
 * @example
 * ```ts
 * Page.numberSizeMeta({ page: { number: 1, size: 10 }, totalItems: 42 });
 * // { page: { number: 1, size: 10, total: 42, pages: 5 } }
 * ```
 */
export const numberSizeMeta = (options: {
	readonly page: NumberSize;
	readonly totalItems?: number;
}): MetaObject => ({
	page: {
		number: options.page.number,
		size: options.page.size,
		...(options.totalItems === undefined
			? {}
			: {
					total: options.totalItems,
					pages: Math.max(1, Math.ceil(options.totalItems / options.page.size)),
				}),
	},
});

/**
 * Slices an in-memory collection according to a {@link numberSize} page.
 *
 * This is a convenience for demos and small data sets; production handlers
 * should paginate in their data layer.
 *
 * @example
 * ```ts
 * const { items, totalPages } = Page.applyNumberSize(allUsers, page);
 * ```
 */
export const applyNumberSize = <A>(
	items: ReadonlyArray<A>,
	page: NumberSize,
): {
	readonly items: ReadonlyArray<A>;
	readonly totalItems: number;
	readonly totalPages: number;
} => {
	const totalItems = items.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / page.size));
	const start = (page.number - 1) * page.size;
	return {
		items: items.slice(start, start + page.size),
		totalItems,
		totalPages,
	};
};
