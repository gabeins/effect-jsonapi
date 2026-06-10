import { Schema } from "effect";
import { extensibleObject } from "./Extension.js";
import { LinksObject } from "./Link.js";
import { JSON_API_MEDIA_TYPE } from "./MediaType.js";
import { MetaObject } from "./Meta.js";

/**
 * Schema for an HTTP status code encoded as a JSON string.
 *
 * JSON:API error objects use strings for the `status` member.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(HttpStatusCodeString)("404");
 * ```
 */
export const HttpStatusCodeString = Schema.String.check(
	Schema.makeFilter((value) =>
		/^[1-5][0-9][0-9]$/.test(value)
			? undefined
			: "JSON:API error status values must be HTTP status codes expressed as strings",
	),
).annotate({
	identifier: "JsonApiHttpStatusCodeString",
	description: "An HTTP status code expressed as a string.",
});

/**
 * Schema for a JSON:API error source object.
 *
 * Use this to point at the request member, query parameter, or header that
 * caused an error.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ErrorSourceObject)({
 * 	pointer: "/data/attributes/title",
 * });
 * ```
 */
export const ErrorSourceObject = Schema.Struct({
	pointer: Schema.optionalKey(Schema.String),
	parameter: Schema.optionalKey(Schema.String),
	header: Schema.optionalKey(Schema.String),
}).annotate({
	identifier: "JsonApiErrorSourceObject",
	description: "A JSON:API error source object.",
});

/**
 * Type of a JSON:API error source object decoded by {@link ErrorSourceObject}.
 */
export type ErrorSourceObject = typeof ErrorSourceObject.Type;

const ErrorObjectStruct = extensibleObject(
	Schema.Struct({
		id: Schema.optionalKey(Schema.String),
		links: Schema.optionalKey(LinksObject),
		status: Schema.optionalKey(HttpStatusCodeString),
		code: Schema.optionalKey(Schema.String),
		title: Schema.optionalKey(Schema.String),
		detail: Schema.optionalKey(Schema.String),
		source: Schema.optionalKey(ErrorSourceObject),
		meta: Schema.optionalKey(MetaObject),
	}),
);

/**
 * Schema for a JSON:API error object.
 *
 * At least one JSON:API error member must be present.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ErrorObject)({
 * 	status: "404",
 * 	title: "Not Found",
 * 	detail: "Article 1 does not exist.",
 * });
 * ```
 */
export const ErrorObject = ErrorObjectStruct.check(
	Schema.makeFilter((value) =>
		value.id !== undefined ||
		value.links !== undefined ||
		value.status !== undefined ||
		value.code !== undefined ||
		value.title !== undefined ||
		value.detail !== undefined ||
		value.source !== undefined ||
		value.meta !== undefined
			? undefined
			: "A JSON:API error object must contain at least one error member",
	),
).annotate({
	identifier: "JsonApiErrorObject",
	description: "A JSON:API error object.",
});

/**
 * Type of a JSON:API error object decoded by {@link ErrorObject}.
 */
export type ErrorObject = typeof ErrorObject.Type;

/**
 * Schema for a JSON:API document containing errors.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ErrorsDocument)({
 * 	errors: [{ status: "400", title: "Bad Request" }],
 * });
 * ```
 */
export const ErrorsDocument = extensibleObject(
	Schema.Struct({
		links: Schema.optionalKey(LinksObject),
		errors: Schema.Array(ErrorObject),
		meta: Schema.optionalKey(MetaObject),
	}),
).annotate({
	identifier: "JsonApiErrorsDocument",
	description: "A JSON:API document containing errors.",
});

/**
 * Type of a JSON:API errors document decoded by {@link ErrorsDocument}.
 */
export type ErrorsDocument = typeof ErrorsDocument.Type;

/**
 * Builds an errors-document schema for a specialized error schema.
 *
 * @example
 * ```ts
 * const ValidationErrorsDocument = errorDocument(ValidationErrorObject);
 * ```
 */
export const errorDocument = <S extends Schema.Top>(error: S) =>
	extensibleObject(
		Schema.Struct({
			links: Schema.optionalKey(LinksObject),
			errors: Schema.Array(error),
			meta: Schema.optionalKey(MetaObject),
		}),
	);

const statusErrorFields = {
	errors: Schema.Array(ErrorObject),
	meta: Schema.optionalKey(MetaObject),
	links: Schema.optionalKey(LinksObject),
} as const;

const statusErrorAnnotations = (tag: string, status: number, title: string) => ({
	"identifier": `JsonApi${tag}`,
	"description": `A JSON:API ${status} ${title} errors document.`,
	"httpApiStatus": status,
	"~httpApiEncoding": {
		_tag: "Json",
		contentType: JSON_API_MEDIA_TYPE,
	},
});

const defaultErrorObject = (status: number, title: string, error: Partial<ErrorObject>) => ({
	status: `${status}`,
	title,
	...error,
});

/**
 * Input accepted by the per-status error class `of` constructors.
 *
 * The `status` and `title` members default to the values of the error class.
 */
export type ErrorObjectInput = Partial<ErrorObject>;

/**
 * JSON:API error for a `400 Bad Request` response.
 *
 * Declaring this class as an endpoint or middleware error encodes failures as a
 * JSON:API errors document with the `application/vnd.api+json` content type.
 *
 * @example
 * ```ts
 * Effect.fail(BadRequest.of({ detail: "Unsupported query parameter: foo" }));
 * ```
 */
export class BadRequest extends Schema.ErrorClass<BadRequest>(
	"effect-jsonapi/JsonApiError/BadRequest",
)(
	{
		_tag: Schema.tagDefaultOmit("JsonApiBadRequest"),
		...statusErrorFields,
	},
	statusErrorAnnotations("BadRequest", 400, "Bad Request"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): BadRequest {
		return new BadRequest({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(400, "Bad Request", error),
			),
		});
	}
}

/**
 * JSON:API error for a `401 Unauthorized` response.
 *
 * @example
 * ```ts
 * Effect.fail(Unauthorized.of());
 * ```
 */
export class Unauthorized extends Schema.ErrorClass<Unauthorized>(
	"effect-jsonapi/JsonApiError/Unauthorized",
)(
	{
		_tag: Schema.tagDefaultOmit("JsonApiUnauthorized"),
		...statusErrorFields,
	},
	statusErrorAnnotations("Unauthorized", 401, "Unauthorized"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): Unauthorized {
		return new Unauthorized({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(401, "Unauthorized", error),
			),
		});
	}
}

/**
 * JSON:API error for a `403 Forbidden` response.
 *
 * @example
 * ```ts
 * Effect.fail(Forbidden.of({ detail: "Client-generated ids are not allowed." }));
 * ```
 */
export class Forbidden extends Schema.ErrorClass<Forbidden>(
	"effect-jsonapi/JsonApiError/Forbidden",
)(
	{
		_tag: Schema.tagDefaultOmit("JsonApiForbidden"),
		...statusErrorFields,
	},
	statusErrorAnnotations("Forbidden", 403, "Forbidden"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): Forbidden {
		return new Forbidden({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(403, "Forbidden", error),
			),
		});
	}
}

/**
 * JSON:API error for a `404 Not Found` response.
 *
 * @example
 * ```ts
 * Effect.fail(NotFound.of({ detail: "Article 1 does not exist." }));
 * ```
 */
export class NotFound extends Schema.ErrorClass<NotFound>("effect-jsonapi/JsonApiError/NotFound")(
	{
		_tag: Schema.tagDefaultOmit("JsonApiNotFound"),
		...statusErrorFields,
	},
	statusErrorAnnotations("NotFound", 404, "Not Found"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): NotFound {
		return new NotFound({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(404, "Not Found", error),
			),
		});
	}
}

/**
 * JSON:API error for a `406 Not Acceptable` response.
 *
 * Servers must respond with `406 Not Acceptable` when the `Accept` header only
 * contains JSON:API media types with unsupported parameters.
 *
 * @example
 * ```ts
 * Effect.fail(NotAcceptable.of());
 * ```
 */
export class NotAcceptable extends Schema.ErrorClass<NotAcceptable>(
	"effect-jsonapi/JsonApiError/NotAcceptable",
)(
	{
		_tag: Schema.tagDefaultOmit("JsonApiNotAcceptable"),
		...statusErrorFields,
	},
	statusErrorAnnotations("NotAcceptable", 406, "Not Acceptable"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): NotAcceptable {
		return new NotAcceptable({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(406, "Not Acceptable", error),
			),
		});
	}
}

/**
 * JSON:API error for a `409 Conflict` response.
 *
 * @example
 * ```ts
 * Effect.fail(Conflict.of({ detail: "A resource with this id already exists." }));
 * ```
 */
export class Conflict extends Schema.ErrorClass<Conflict>("effect-jsonapi/JsonApiError/Conflict")(
	{
		_tag: Schema.tagDefaultOmit("JsonApiConflict"),
		...statusErrorFields,
	},
	statusErrorAnnotations("Conflict", 409, "Conflict"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): Conflict {
		return new Conflict({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(409, "Conflict", error),
			),
		});
	}
}

/**
 * JSON:API error for a `415 Unsupported Media Type` response.
 *
 * Servers must respond with `415 Unsupported Media Type` when a request
 * `Content-Type` specifies the JSON:API media type with unsupported parameters.
 *
 * @example
 * ```ts
 * Effect.fail(UnsupportedMediaType.of());
 * ```
 */
export class UnsupportedMediaType extends Schema.ErrorClass<UnsupportedMediaType>(
	"effect-jsonapi/JsonApiError/UnsupportedMediaType",
)(
	{
		_tag: Schema.tagDefaultOmit("JsonApiUnsupportedMediaType"),
		...statusErrorFields,
	},
	statusErrorAnnotations("UnsupportedMediaType", 415, "Unsupported Media Type"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): UnsupportedMediaType {
		return new UnsupportedMediaType({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(415, "Unsupported Media Type", error),
			),
		});
	}
}

/**
 * JSON:API error for a `422 Unprocessable Content` response.
 *
 * @example
 * ```ts
 * Effect.fail(
 * 	UnprocessableContent.of({
 * 		detail: "Title must not be empty.",
 * 		source: { pointer: "/data/attributes/title" },
 * 	}),
 * );
 * ```
 */
export class UnprocessableContent extends Schema.ErrorClass<UnprocessableContent>(
	"effect-jsonapi/JsonApiError/UnprocessableContent",
)(
	{
		_tag: Schema.tagDefaultOmit("JsonApiUnprocessableContent"),
		...statusErrorFields,
	},
	statusErrorAnnotations("UnprocessableContent", 422, "Unprocessable Content"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): UnprocessableContent {
		return new UnprocessableContent({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(422, "Unprocessable Content", error),
			),
		});
	}
}

/**
 * JSON:API error for a `500 Internal Server Error` response.
 *
 * @example
 * ```ts
 * Effect.fail(InternalServerError.of());
 * ```
 */
export class InternalServerError extends Schema.ErrorClass<InternalServerError>(
	"effect-jsonapi/JsonApiError/InternalServerError",
)(
	{
		_tag: Schema.tagDefaultOmit("JsonApiInternalServerError"),
		...statusErrorFields,
	},
	statusErrorAnnotations("InternalServerError", 500, "Internal Server Error"),
) {
	static of(...errors: ReadonlyArray<ErrorObjectInput>): InternalServerError {
		return new InternalServerError({
			errors: (errors.length === 0 ? [{}] : errors).map((error) =>
				defaultErrorObject(500, "Internal Server Error", error),
			),
		});
	}
}
