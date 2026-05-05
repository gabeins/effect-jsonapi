import { Schema } from "effect";
import { extensibleObject } from "./Extension.js";
import { withJsonApiStatus } from "./MediaType.js";
import { MetaObject } from "./Meta.js";
import { LinksObject } from "./Link.js";

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
 * JSON:API error source object class.
 *
 * Use this to point at the request member, query parameter, or header that
 * caused an error.
 *
 * @example
 * ```ts
 * const source = new ErrorSourceObject({
 * 	pointer: "/data/attributes/title",
 * });
 * ```
 */
export class ErrorSourceObject extends Schema.Class<ErrorSourceObject>("JsonApiErrorSourceObject")({
	pointer: Schema.optionalKey(Schema.String),
	parameter: Schema.optionalKey(Schema.String),
	header: Schema.optionalKey(Schema.String),
}) {}

/**
 * Base JSON:API error object class before the non-empty-member validation.
 */
export class ErrorObjectClass extends Schema.Class<ErrorObjectClass>("JsonApiErrorObject")({
	id: Schema.optionalKey(Schema.String),
	links: Schema.optionalKey(LinksObject),
	status: Schema.optionalKey(HttpStatusCodeString),
	code: Schema.optionalKey(Schema.String),
	title: Schema.optionalKey(Schema.String),
	detail: Schema.optionalKey(Schema.String),
	source: Schema.optionalKey(ErrorSourceObject),
	meta: Schema.optionalKey(MetaObject),
}) {}

const ErrorObjectStruct = extensibleObject(Schema.Struct(ErrorObjectClass.fields));

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

/**
 * Builds an Effect HttpApi response schema for a JSON:API errors document.
 *
 * @example
 * ```ts
 * const NotFoundResponse = errorResponse(404)(ErrorObject);
 * ```
 */
export const errorResponse =
	(status: number) =>
	<S extends Schema.Top>(error: S) =>
		errorDocument(error).pipe(withJsonApiStatus(status));
