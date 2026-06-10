import { Effect, Layer, SchemaIssue } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiError, HttpApiMiddleware } from "effect/unstable/httpapi";
import {
	BadRequest,
	type ErrorObject,
	NotAcceptable,
	UnsupportedMediaType,
} from "./JsonApiError.js";
import { negotiateJsonApiAccept, validateJsonApiContentType } from "./MediaType.js";

/**
 * Options for the JSON:API content negotiation middleware.
 */
export interface ContentNegotiationOptions {
	/**
	 * JSON:API extension URIs supported by this server. Requests applying other
	 * extensions are rejected.
	 */
	readonly supportedExtensions?: ReadonlyArray<string>;
}

/**
 * HttpApi middleware enforcing JSON:API content negotiation.
 *
 * Requests with a JSON:API `Content-Type` carrying unsupported media type
 * parameters or unsupported extension URIs are rejected with
 * `415 Unsupported Media Type`. Requests whose `Accept` header only contains
 * JSON:API media types with unsupported parameters are rejected with
 * `406 Not Acceptable`. Both failures are encoded as JSON:API errors documents.
 *
 * Apply it to an api, group, or endpoint and provide
 * {@link contentNegotiation}.
 *
 * @example
 * ```ts
 * class Api extends HttpApi.make("api")
 * 	.add(UsersApiGroup)
 * 	.middleware(Middleware.ContentNegotiation) {}
 *
 * const ApiLayer = HttpApiBuilder.layer(Api).pipe(
 * 	Layer.provide(Middleware.contentNegotiation()),
 * );
 * ```
 */
export class ContentNegotiation extends HttpApiMiddleware.Service<ContentNegotiation>()(
	"effect-jsonapi/Middleware/ContentNegotiation",
	{
		error: [UnsupportedMediaType, NotAcceptable],
	},
) {}

const contentTypeDetail = (
	validation: Extract<
		ReturnType<typeof validateJsonApiContentType>,
		{ _tag: "UnsupportedMediaType" }
	>,
): string => {
	switch (validation.reason) {
		case "missing":
			return "Requests with a body must use the application/vnd.api+json media type";
		case "not-jsonapi":
			return "Request bodies must use the application/vnd.api+json media type";
		case "invalid-parameter":
			return "The JSON:API media type was specified with invalid parameters";
		case "invalid-uri":
			return `The JSON:API media type was specified with invalid extension or profile URIs: ${validation.details.join(
				", ",
			)}`;
		case "unsupported-parameter":
			return `The JSON:API media type was specified with unsupported parameters: ${validation.details.join(
				", ",
			)}`;
		case "unsupported-extension":
			return `The request applies unsupported JSON:API extensions: ${validation.details.join(
				", ",
			)}`;
	}
};

const acceptDetail = (
	negotiation: Extract<ReturnType<typeof negotiateJsonApiAccept>, { _tag: "NotAcceptable" }>,
): string => {
	switch (negotiation.reason) {
		case "invalid-parameter":
			return "The Accept header specifies the JSON:API media type with invalid parameters";
		case "invalid-quality":
			return "The Accept header specifies invalid quality values for the JSON:API media type";
		case "not-acceptable":
			return "The Accept header does not allow the application/vnd.api+json media type";
		case "unsupported-parameter":
			return `The Accept header specifies unsupported JSON:API media type parameters: ${negotiation.details.join(
				", ",
			)}`;
		case "unsupported-extension":
			return `The Accept header applies unsupported JSON:API extensions: ${negotiation.details.join(
				", ",
			)}`;
	}
};

/**
 * Provides the {@link ContentNegotiation} middleware implementation.
 *
 * @example
 * ```ts
 * Layer.provide(Middleware.contentNegotiation({
 * 	supportedExtensions: ["https://jsonapi.org/ext/atomic"],
 * }));
 * ```
 */
export const contentNegotiation = (
	options: ContentNegotiationOptions = {},
): Layer.Layer<ContentNegotiation> =>
	Layer.succeed(ContentNegotiation)((httpEffect) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;

			const contentType = request.headers["content-type"];
			if (contentType !== undefined && contentType.trim() !== "") {
				const validation = validateJsonApiContentType(contentType, options);
				if (validation._tag === "UnsupportedMediaType" && validation.reason !== "not-jsonapi") {
					return yield* Effect.fail(
						UnsupportedMediaType.of({
							detail: contentTypeDetail(validation),
							source: { header: "content-type" },
						}),
					);
				}
			}

			const negotiation = negotiateJsonApiAccept(request.headers["accept"], options);
			if (negotiation._tag === "NotAcceptable") {
				return yield* Effect.fail(
					NotAcceptable.of({
						detail: acceptDetail(negotiation),
						source: { header: "accept" },
					}),
				);
			}

			return yield* httpEffect;
		}),
	);

/**
 * HttpApi middleware mapping request decoding failures to JSON:API errors.
 *
 * Without this middleware, failures decoding path parameters, query
 * parameters, headers, or request bodies respond with the default Effect
 * `HttpApiSchemaError` encoding. With it, they respond with a
 * `400 Bad Request` JSON:API errors document carrying `source.parameter`,
 * `source.pointer`, or `source.header` members.
 *
 * Apply it to an api, group, or endpoint and provide {@link schemaErrors}.
 *
 * @example
 * ```ts
 * class Api extends HttpApi.make("api")
 * 	.add(UsersApiGroup)
 * 	.middleware(Middleware.SchemaErrors) {}
 *
 * const ApiLayer = HttpApiBuilder.layer(Api).pipe(
 * 	Layer.provide(Middleware.schemaErrors),
 * );
 * ```
 */
export class SchemaErrors extends HttpApiMiddleware.Service<SchemaErrors>()(
	"effect-jsonapi/Middleware/SchemaErrors",
	{
		error: BadRequest,
	},
) {}

type Leaf = {
	readonly path: ReadonlyArray<PropertyKey>;
	readonly issue: SchemaIssue.Issue;
};

const collectLeaves = (
	issue: SchemaIssue.Issue,
	path: ReadonlyArray<PropertyKey>,
): ReadonlyArray<Leaf> => {
	switch (issue._tag) {
		case "Pointer":
			return collectLeaves(issue.issue, [...path, ...issue.path]);
		case "Filter":
		case "Encoding":
			return collectLeaves(issue.issue, path);
		case "Composite":
		case "AnyOf":
			// Union mismatches may carry no inner issues; report the node itself.
			return issue.issues.length === 0
				? [{ path, issue }]
				: issue.issues.flatMap((inner) => collectLeaves(inner, path));
		default:
			return [{ path, issue }];
	}
};

const sourceFor = (
	kind: HttpApiError.HttpApiSchemaError["kind"],
	path: ReadonlyArray<PropertyKey>,
): ErrorObject["source"] => {
	switch (kind) {
		case "Query": {
			const parameter = path[0];
			return parameter === undefined ? undefined : { parameter: String(parameter) };
		}
		case "Headers": {
			const header = path[0];
			return header === undefined ? undefined : { header: String(header) };
		}
		case "Body":
		case "Payload":
			return { pointer: `/${path.map(String).join("/")}` };
		case "Params":
			return undefined;
	}
};

const requestPart = (kind: HttpApiError.HttpApiSchemaError["kind"]): string => {
	switch (kind) {
		case "Query":
			return "query parameter";
		case "Headers":
			return "header";
		case "Params":
			return "path parameter";
		case "Body":
		case "Payload":
			return "document";
	}
};

/**
 * Builds the JSON:API error objects for a request decoding failure.
 *
 * Exposed for custom error mapping; most applications use {@link schemaErrors}.
 */
export const errorObjectsFromSchemaError = (
	error: HttpApiError.HttpApiSchemaError,
): ReadonlyArray<ErrorObject> =>
	collectLeaves(error.cause.issue, []).map((leaf) => {
		const source = sourceFor(error.kind, leaf.path);
		return {
			status: "400",
			title: "Bad Request",
			detail: `Invalid ${requestPart(error.kind)}: ${String(leaf.issue)}`,
			...(source === undefined ? {} : { source }),
		};
	});

/**
 * Provides the {@link SchemaErrors} middleware implementation.
 */
export const schemaErrors: Layer.Layer<SchemaErrors> = HttpApiMiddleware.layerSchemaErrorTransform(
	SchemaErrors,
	(error) => Effect.fail(new BadRequest({ errors: errorObjectsFromSchemaError(error) })),
);

/**
 * Convenience layer providing both {@link ContentNegotiation} and
 * {@link SchemaErrors}.
 *
 * @example
 * ```ts
 * const ApiLayer = HttpApiBuilder.layer(Api).pipe(
 * 	Layer.provide(Middleware.layer()),
 * );
 * ```
 */
export const layer = (
	options: ContentNegotiationOptions = {},
): Layer.Layer<ContentNegotiation | SchemaErrors> =>
	Layer.mergeAll(contentNegotiation(options), schemaErrors);
