import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from "effect";
import {
	isExtensionQueryParameterBaseName,
	isImplementationQueryParameterBaseName,
	isRelationshipPath,
} from "./MemberName.js";
import type * as Page from "./Page.js";
import type * as Resource from "./Resource.js";

// -------------------------------------------------------------------------------------
// Query parameter name classification
// -------------------------------------------------------------------------------------

/**
 * Classification for a JSON:API query parameter name.
 */
export type QueryParameterKind = "standard" | "extension" | "implementation" | "invalid";

/**
 * Standard JSON:API query parameter base names.
 */
export const STANDARD_QUERY_PARAMETER_BASE_NAMES = [
	"include",
	"fields",
	"sort",
	"page",
	"filter",
] as const;

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

// -------------------------------------------------------------------------------------
// Typed JSON:API query
// -------------------------------------------------------------------------------------

/**
 * A parsed sort field with its direction.
 */
export interface SortField {
	readonly field: string;
	readonly descending: boolean;
}

/**
 * The decoded JSON:API fetch query for an endpoint.
 *
 * `page` is typed by the configured pagination strategy and `undefined` when no
 * strategy is configured.
 */
export interface JsonApiQuery<P = undefined> {
	/** Validated relationship paths from the `include` parameter. */
	readonly include: ReadonlyArray<string>;
	/** Sparse fieldsets keyed by resource type from `fields[TYPE]` parameters. */
	readonly fields: { readonly [type: string]: ReadonlyArray<string> };
	/** Parsed sort fields from the `sort` parameter. */
	readonly sort: ReadonlyArray<SortField>;
	/** The decoded page value of the configured pagination strategy. */
	readonly page: P;
	/** Raw `filter[...]` values keyed by their bracket path joined with dots. */
	readonly filter: { readonly [name: string]: string };
}

/**
 * The wire shape of a JSON:API query schema, matching the record produced by
 * Effect's `UrlParams`.
 */
export type QueryEncoded = {
	readonly [name: string]: string | ReadonlyArray<string> | undefined;
};

/**
 * Options for deriving a JSON:API query schema from a resource definition.
 *
 * Unconfigured features are rejected with `400 Bad Request` when a client uses
 * the corresponding query parameter, as required by the JSON:API specification
 * for unsupported `include` and `sort` requests.
 */
export interface Options<P> {
	/** Pagination strategy for the `page` parameter family. */
	readonly page?: Page.Strategy<P>;
	/** Allowed sort fields. The `-` descending prefix is always accepted. */
	readonly sort?: ReadonlyArray<string>;
	/** Accept arbitrary `filter[...]` parameters. Defaults to `false`. */
	readonly filter?: boolean;
	/** Support the `include` parameter. Defaults to `true` when the resource has relationships. */
	readonly include?: boolean;
	/** Support `fields[TYPE]` sparse fieldsets. Defaults to `true`. */
	readonly fields?: boolean;
	/** Maximum `include` path depth. Defaults to `3`. */
	readonly maxIncludeDepth?: number;
}

const invalidParameter = (name: string, message: string): SchemaIssue.Issue =>
	new SchemaIssue.Pointer([name], new SchemaIssue.InvalidValue(Option.none(), { message }));

const reachableResourcesByType = (root: Resource.Any): Map<string, Resource.Any> => {
	const reachable = new Map<string, Resource.Any>();
	const queue: Array<Resource.Any> = [root];
	while (queue.length > 0) {
		const current = queue.shift() as Resource.Any;
		if (reachable.has(current.type as string)) {
			continue;
		}
		reachable.set(current.type as string, current);
		for (const relationship of Object.values(current.relationships as Record<string, never>)) {
			queue.push((relationship as { resource: () => Resource.Any }).resource());
		}
	}
	return reachable;
};

const includePathError = (
	root: Resource.Any,
	path: string,
	maxDepth: number,
): string | undefined => {
	const segments = path.split(".");
	if (path === "" || segments.some((segment) => segment === "")) {
		return `Invalid include path: ${path}`;
	}
	if (segments.length > maxDepth) {
		return `Include paths must not exceed a depth of ${maxDepth}: ${path}`;
	}
	let current = root;
	for (const segment of segments) {
		const relationship = (
			current.relationships as Record<string, { resource: () => Resource.Any } | undefined>
		)[segment];
		if (relationship === undefined) {
			return `Unknown relationship "${segment}" on resource type "${current.type as string}" in include path: ${path}`;
		}
		current = relationship.resource();
	}
	return undefined;
};

const resourceFieldNames = (resource: Resource.Any): ReadonlySet<string> =>
	new Set([
		...Object.keys((resource.attributes as { fields: object }).fields),
		...Object.keys(resource.relationships as object),
	]);

/**
 * Derives a typed JSON:API fetch query schema from a resource definition.
 *
 * The resulting schema decodes the full query-string record, so it validates
 * every query parameter of the request:
 *
 * - `include` paths are validated against the resource's relationship graph.
 * - `fields[TYPE]` types must be reachable through the relationship graph and
 *   field names must exist on the targeted resource.
 * - `sort` fields are validated against the configured allow-list.
 * - `page[...]` parameters are decoded with the configured {@link Page.Strategy}.
 * - `filter[...]` parameters are passed through when enabled.
 * - Any other query parameter is rejected, which the JSON:API middleware
 *   reports as `400 Bad Request`.
 *
 * @example
 * ```ts
 * const ListUsersQuery = Query.schema(UserResource, {
 * 	page: Page.numberSize({ defaultSize: 10, maxSize: 100 }),
 * 	sort: ["name", "email"],
 * });
 *
 * const endpoint = HttpApiEndpoint.get("listUsers", "/", {
 * 	query: ListUsersQuery,
 * 	success: UserResource.CollectionDocument,
 * });
 * ```
 */
export const schema = <R extends Resource.Any, P = undefined>(
	resource: R,
	options: Options<P> = {},
): Schema.Codec<JsonApiQuery<P>, QueryEncoded> => {
	const maxIncludeDepth = options.maxIncludeDepth ?? 3;
	const sortFields = options.sort === undefined ? undefined : new Set(options.sort);
	const filterEnabled = options.filter ?? false;
	const fieldsEnabled = options.fields ?? true;
	const includeEnabled =
		options.include ?? Object.keys(resource.relationships as object).length > 0;
	const pageStrategy = options.page;

	const Encoded = Schema.Record(
		Schema.String,
		Schema.Union([Schema.String, Schema.Array(Schema.String), Schema.Undefined]),
	);

	const Decoded = Schema.Struct({
		include: Schema.Array(Schema.String),
		fields: Schema.Record(Schema.String, Schema.Array(Schema.String)),
		sort: Schema.Array(Schema.Struct({ field: Schema.String, descending: Schema.Boolean })),
		page: Schema.Unknown,
		filter: Schema.Record(Schema.String, Schema.String),
	});

	type DecodedShape = {
		include: ReadonlyArray<string>;
		fields: Record<string, ReadonlyArray<string>>;
		sort: ReadonlyArray<SortField>;
		page: unknown;
		filter: Record<string, string>;
	};

	const decode = (input: QueryEncoded): Effect.Effect<DecodedShape, SchemaIssue.Issue> =>
		Effect.gen(function* () {
			const issues: Array<SchemaIssue.Issue> = [];
			const include: Array<string> = [];
			const fields: Record<string, ReadonlyArray<string>> = {};
			const sort: Array<SortField> = [];
			const filter: Record<string, string> = {};
			const pageParameters: Record<string, string> = {};

			// Lazily resolved so that mutually recursive resource definitions are
			// fully constructed before the graph is traversed.
			let reachable: Map<string, Resource.Any> | undefined;
			const reachableByType = () => {
				if (reachable === undefined) {
					reachable = reachableResourcesByType(resource);
				}
				return reachable;
			};

			for (const [name, rawValue] of Object.entries(input)) {
				if (rawValue === undefined) {
					continue;
				}
				if (typeof rawValue !== "string") {
					issues.push(invalidParameter(name, `Query parameter must not be repeated: ${name}`));
					continue;
				}
				const value = rawValue;
				const baseName = queryParameterBaseName(name);

				if (name === "include") {
					if (!includeEnabled) {
						issues.push(
							invalidParameter(name, "This endpoint does not support the include query parameter"),
						);
						continue;
					}
					for (const path of value === "" ? [] : value.split(",")) {
						const error = includePathError(resource, path, maxIncludeDepth);
						if (error === undefined) {
							include.push(path);
						} else {
							issues.push(invalidParameter(name, error));
						}
					}
					continue;
				}

				if (name === "sort") {
					if (sortFields === undefined) {
						issues.push(
							invalidParameter(name, "This endpoint does not support the sort query parameter"),
						);
						continue;
					}
					for (const rawField of value.split(",")) {
						const descending = rawField.startsWith("-");
						const field = descending ? rawField.slice(1) : rawField;
						if (sortFields.has(field)) {
							sort.push({ field, descending });
						} else {
							issues.push(invalidParameter(name, `Unsupported sort field: ${field}`));
						}
					}
					continue;
				}

				if (baseName === "fields" && isQueryParameterFamilyMember("fields", name)) {
					if (!fieldsEnabled) {
						issues.push(
							invalidParameter(
								name,
								"This endpoint does not support sparse fieldset query parameters",
							),
						);
						continue;
					}
					const segments = familySegments(name, "fields") ?? [];
					const type = segments[0];
					if (segments.length !== 1 || type === undefined || type === "") {
						issues.push(
							invalidParameter(name, "Sparse fieldset parameters must use a fields[TYPE] name"),
						);
						continue;
					}
					const target = reachableByType().get(type);
					if (target === undefined) {
						issues.push(
							invalidParameter(name, `Unknown resource type for sparse fieldset: ${type}`),
						);
						continue;
					}
					const validNames = resourceFieldNames(target);
					const names = value === "" ? [] : value.split(",");
					const unknownNames = names.filter((fieldName) => !validNames.has(fieldName));
					if (unknownNames.length > 0) {
						issues.push(
							invalidParameter(
								name,
								`Unknown fields for resource type "${type}": ${unknownNames.join(", ")}`,
							),
						);
						continue;
					}
					fields[type] = names;
					continue;
				}

				if (baseName === "page" && isQueryParameterFamilyMember("page", name)) {
					if (pageStrategy === undefined) {
						issues.push(
							invalidParameter(name, "This endpoint does not support the page query parameter"),
						);
						continue;
					}
					const segments = familySegments(name, "page") ?? [];
					const key = segments[0];
					if (segments.length !== 1 || key === undefined || !pageStrategy.keys.includes(key)) {
						issues.push(invalidParameter(name, `Unsupported page parameter: ${name}`));
						continue;
					}
					pageParameters[key] = value;
					continue;
				}

				if (baseName === "filter" && isQueryParameterFamilyMember("filter", name)) {
					if (!filterEnabled) {
						issues.push(
							invalidParameter(name, "This endpoint does not support the filter query parameter"),
						);
						continue;
					}
					const segments = familySegments(name, "filter") ?? [];
					filter[segments.join(".")] = value;
					continue;
				}

				issues.push(
					classifyQueryParameterName(name) === "invalid"
						? invalidParameter(
								name,
								`Query parameter names must be valid JSON:API query parameter names: ${name}`,
							)
						: invalidParameter(name, `Unsupported query parameter: ${name}`),
				);
			}

			let page: unknown = undefined;
			if (pageStrategy !== undefined) {
				try {
					page = Schema.decodeUnknownSync(pageStrategy.schema)(pageParameters);
				} catch (error) {
					issues.push(
						new SchemaIssue.Pointer(
							["page"],
							Schema.isSchemaError(error)
								? error.issue
								: new SchemaIssue.InvalidValue(Option.some(pageParameters), {
										message: "Invalid page parameters",
									}),
						),
					);
				}
			}

			if (issues.length === 1) {
				return yield* Effect.fail(issues[0] as SchemaIssue.Issue);
			}
			if (issues.length > 1) {
				return yield* Effect.fail(
					new SchemaIssue.Composite(
						Encoded.ast,
						Option.some(input),
						issues as unknown as readonly [SchemaIssue.Issue, ...Array<SchemaIssue.Issue>],
					),
				);
			}

			return { include, fields, sort, page, filter };
		});

	const encode = (decoded: DecodedShape): Effect.Effect<QueryEncoded, SchemaIssue.Issue> =>
		Effect.gen(function* () {
			const output: Record<string, string> = {};
			if (decoded.include.length > 0) {
				output["include"] = decoded.include.join(",");
			}
			for (const [type, names] of Object.entries(decoded.fields)) {
				output[`fields[${type}]`] = names.join(",");
			}
			if (decoded.sort.length > 0) {
				output["sort"] = decoded.sort
					.map((field) => (field.descending ? `-${field.field}` : field.field))
					.join(",");
			}
			if (pageStrategy !== undefined && decoded.page !== undefined) {
				const encoded = yield* Effect.try({
					try: () => Schema.encodeUnknownSync(pageStrategy.schema)(decoded.page),
					catch: (error) =>
						Schema.isSchemaError(error)
							? error.issue
							: new SchemaIssue.InvalidValue(Option.some(decoded.page), {
									message: "Invalid page value",
								}),
				});
				for (const [key, value] of Object.entries(encoded)) {
					if (value !== undefined) {
						output[`page[${key}]`] = value;
					}
				}
			}
			for (const [name, value] of Object.entries(decoded.filter)) {
				const segments = name === "" ? [] : name.split(".");
				output[`filter${segments.map((segment) => `[${segment}]`).join("")}`] = value;
			}
			return output;
		});

	return Encoded.pipe(
		Schema.decodeTo(Decoded, {
			decode: SchemaGetter.transformOrFail((input: QueryEncoded) => decode(input)),
			encode: SchemaGetter.transformOrFail((decoded: DecodedShape) => encode(decoded)),
		}),
	).annotate({
		identifier: `${resource.type as string}.query`,
		description: `JSON:API fetch query parameters for the "${resource.type as string}" resource.`,
	}) as unknown as Schema.Codec<JsonApiQuery<P>, QueryEncoded>;
};
