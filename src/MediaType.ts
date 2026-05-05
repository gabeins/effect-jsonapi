import { Schema } from "effect";
import { HttpApiSchema } from "effect/unstable/httpapi";
import { Uri } from "./Uri.js";

/**
 * The JSON:API media type required for JSON:API request and response bodies.
 */
export const JSON_API_MEDIA_TYPE = "application/vnd.api+json";

/**
 * Media type parameter name for JSON:API extensions.
 */
export const EXT_PARAMETER = "ext";

/**
 * Media type parameter name for JSON:API profiles.
 */
export const PROFILE_PARAMETER = "profile";

/**
 * Parameters supported by the JSON:API media type formatter and HttpApi helpers.
 *
 * @example
 * ```ts
 * const parameters: JsonApiMediaTypeParameters = {
 * 	ext: ["https://jsonapi.org/ext/version"],
 * 	profile: ["https://example.com/profiles/timestamps"],
 * };
 * ```
 */
export type JsonApiMediaTypeParameters = {
	readonly ext?: ReadonlyArray<string>;
	readonly profile?: ReadonlyArray<string>;
};

/**
 * Parsed media type essence and parameters.
 *
 * The essence is normalized to lowercase and excludes parameters.
 */
export type ParsedMediaType = {
	readonly essence: string;
	readonly parameters: ReadonlyMap<string, string>;
};

/**
 * Parsed `Accept` media type with its HTTP quality value.
 */
export type ParsedAcceptMediaType = ParsedMediaType & {
	readonly quality: number;
};

/**
 * Result of validating a request `Content-Type` against JSON:API rules.
 *
 * Valid content types expose parsed extension and profile URI lists. Invalid
 * content types carry the reason used to map to a `415 Unsupported Media Type`.
 */
export type ContentTypeValidation =
	| {
			readonly _tag: "ValidContentType";
			readonly mediaType: ParsedMediaType;
			readonly extensions: ReadonlyArray<string>;
			readonly profiles: ReadonlyArray<string>;
	  }
	| {
			readonly _tag: "UnsupportedMediaType";
			readonly reason:
				| "missing"
				| "not-jsonapi"
				| "invalid-parameter"
				| "invalid-uri"
				| "unsupported-parameter"
				| "unsupported-extension";
			readonly details: ReadonlyArray<string>;
	  };

/**
 * Result of negotiating a request `Accept` header against JSON:API rules.
 *
 * Not acceptable results describe the reason used to map to
 * `406 Not Acceptable`.
 */
export type AcceptNegotiation =
	| {
			readonly _tag: "Acceptable";
			readonly mediaTypes: ReadonlyArray<ParsedAcceptMediaType>;
	  }
	| {
			readonly _tag: "NotAcceptable";
			readonly reason:
				| "invalid-parameter"
				| "invalid-quality"
				| "not-acceptable"
				| "unsupported-parameter"
				| "unsupported-extension";
			readonly details: ReadonlyArray<string>;
	  };

const splitUnquoted = (value: string, separator: string): ReadonlyArray<string> => {
	const parts: Array<string> = [];
	let current = "";
	let quoted = false;
	let escaped = false;

	for (const character of value) {
		if (escaped) {
			current = `${current}${character}`;
			escaped = false;
			continue;
		}
		if (character === "\\") {
			current = `${current}${character}`;
			escaped = true;
			continue;
		}
		if (character === '"') {
			quoted = !quoted;
			current = `${current}${character}`;
			continue;
		}
		if (character === separator && !quoted) {
			parts.push(current.trim());
			current = "";
			continue;
		}
		current = `${current}${character}`;
	}

	parts.push(current.trim());
	return parts.filter((part) => part.length > 0);
};

const unquote = (value: string) => {
	if (!value.startsWith('"') || !value.endsWith('"')) {
		return value;
	}
	let output = "";
	let escaped = false;
	for (const character of value.slice(1, -1)) {
		if (escaped) {
			output = `${output}${character}`;
			escaped = false;
			continue;
		}
		if (character === "\\") {
			escaped = true;
			continue;
		}
		output = `${output}${character}`;
	}
	return output;
};

const parseParameter = (part: string): readonly [name: string, value: string] | undefined => {
	const separatorIndex = part.indexOf("=");
	if (separatorIndex <= 0) {
		return undefined;
	}
	const name = part.slice(0, separatorIndex).trim().toLowerCase();
	const value = unquote(part.slice(separatorIndex + 1).trim());
	return name.length === 0 || value.length === 0 ? undefined : [name, value];
};

const parseParameterList = (parts: ReadonlyArray<string>) => {
	const parameters = new Map<string, string>();
	for (const part of parts) {
		const parameter = parseParameter(part);
		if (parameter !== undefined) {
			if (parameters.has(parameter[0])) {
				return undefined;
			}
			parameters.set(parameter[0], parameter[1]);
			continue;
		}
		return undefined;
	}
	return parameters;
};

const parseUriListParameter = (
	mediaType: ParsedMediaType,
	parameterName: typeof EXT_PARAMETER | typeof PROFILE_PARAMETER,
) => {
	const value = mediaType.parameters.get(parameterName);
	return value === undefined ? [] : value.split(" ").filter((uri) => uri.length > 0);
};

const unsupportedParameterNames = (
	mediaType: ParsedMediaType,
	allowedParameters: ReadonlySet<string>,
) => {
	const unsupported: Array<string> = [];
	for (const name of mediaType.parameters.keys()) {
		if (!allowedParameters.has(name)) {
			unsupported.push(name);
		}
	}
	return unsupported;
};

const unsupportedExtensionUris = (
	extensions: ReadonlyArray<string>,
	supportedExtensions: ReadonlyArray<string>,
) => extensions.filter((uri) => !supportedExtensions.includes(uri));

const invalidUriListValues = (uris: ReadonlyArray<string>) =>
	uris.filter((uri) => Schema.decodeUnknownOption(Uri)(uri)._tag === "None");

const invalidUriParameters = (mediaType: ParsedMediaType) => [
	...invalidUriListValues(parseUriListParameter(mediaType, EXT_PARAMETER)),
	...invalidUriListValues(parseUriListParameter(mediaType, PROFILE_PARAMETER)),
];

const parseQuality = (value: string | undefined) => {
	if (value === undefined) {
		return 1;
	}
	const quality = Number(value);
	return Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : -1;
};

/**
 * Returns whether a parsed media type is the JSON:API media type.
 *
 * @example
 * ```ts
 * const parsed = parseMediaType("application/vnd.api+json");
 * parsed !== undefined && isJsonApiMediaType(parsed); // true
 * ```
 */
export const isJsonApiMediaType = (mediaType: ParsedMediaType) =>
	mediaType.essence === JSON_API_MEDIA_TYPE;

/**
 * Parses a single media type value into an essence and parameter map.
 *
 * Parameter names and the essence are normalized to lowercase. Quoted
 * parameter values are unquoted.
 *
 * @example
 * ```ts
 * const mediaType = parseMediaType(
 * 	'application/vnd.api+json;ext="https://jsonapi.org/ext/version"',
 * );
 * mediaType?.parameters.get("ext"); // "https://jsonapi.org/ext/version"
 * ```
 */
export const parseMediaType = (value: string): ParsedMediaType | undefined => {
	const parts = splitUnquoted(value, ";");
	const essence = parts[0]?.trim().toLowerCase();
	if (essence === undefined || !essence.includes("/")) {
		return undefined;
	}
	const parameters = parseParameterList(parts.slice(1));
	if (parameters === undefined) {
		return undefined;
	}
	return {
		essence,
		parameters,
	};
};

/**
 * Parses an HTTP `Accept` header into media types with quality values.
 *
 * Invalid media ranges are skipped. The `q` parameter is removed from the
 * returned parameter map and represented as `quality`.
 *
 * @example
 * ```ts
 * parseAcceptHeader("application/vnd.api+json;q=0.5")[0]?.quality; // 0.5
 * ```
 */
export const parseAcceptHeader = (value: string): ReadonlyArray<ParsedAcceptMediaType> =>
	splitUnquoted(value, ",").flatMap((part) => {
		const parsed = parseMediaType(part);
		if (parsed === undefined) {
			return [];
		}
		const q = parsed.parameters.get("q");
		const parameters = new Map(parsed.parameters);
		parameters.delete("q");
		const quality = parseQuality(q);
		return [
			{
				essence: parsed.essence,
				parameters,
				quality,
			},
		];
	});

/**
 * Formats a JSON:API media type with optional `ext` and `profile` parameters.
 *
 * @example
 * ```ts
 * formatJsonApiMediaType({
 * 	ext: ["https://jsonapi.org/ext/version"],
 * });
 * // application/vnd.api+json;ext="https://jsonapi.org/ext/version"
 * ```
 */
export const formatJsonApiMediaType = (parameters: JsonApiMediaTypeParameters = {}) => {
	const formatted: Array<string> = [JSON_API_MEDIA_TYPE];
	if (parameters.ext !== undefined && parameters.ext.length > 0) {
		formatted.push(`${EXT_PARAMETER}="${parameters.ext.join(" ")}"`);
	}
	if (parameters.profile !== undefined && parameters.profile.length > 0) {
		formatted.push(`${PROFILE_PARAMETER}="${parameters.profile.join(" ")}"`);
	}
	return formatted.join(";");
};

/**
 * Validates a request `Content-Type` according to JSON:API server rules.
 *
 * Unsupported parameters or unsupported extension URIs return an
 * `UnsupportedMediaType` result. Profile URIs are parsed but not rejected by
 * this helper.
 *
 * @example
 * ```ts
 * const validation = validateJsonApiContentType(
 * 	'application/vnd.api+json;ext="https://jsonapi.org/ext/version"',
 * 	{ supportedExtensions: ["https://jsonapi.org/ext/version"] },
 * );
 * validation._tag; // "ValidContentType"
 * ```
 */
export const validateJsonApiContentType = (
	contentType: string | undefined,
	options: {
		readonly supportedExtensions?: ReadonlyArray<string>;
	} = {},
): ContentTypeValidation => {
	if (contentType === undefined || contentType.trim() === "") {
		return { _tag: "UnsupportedMediaType", reason: "missing", details: [] };
	}

	const mediaType = parseMediaType(contentType);
	if (mediaType === undefined || !isJsonApiMediaType(mediaType)) {
		if (contentType.trim().toLowerCase().startsWith(JSON_API_MEDIA_TYPE)) {
			return { _tag: "UnsupportedMediaType", reason: "invalid-parameter", details: [] };
		}
		return { _tag: "UnsupportedMediaType", reason: "not-jsonapi", details: [] };
	}

	const allowedParameters = new Set([EXT_PARAMETER, PROFILE_PARAMETER]);
	const unsupportedParameters = unsupportedParameterNames(mediaType, allowedParameters);
	if (unsupportedParameters.length > 0) {
		return {
			_tag: "UnsupportedMediaType",
			reason: "unsupported-parameter",
			details: unsupportedParameters,
		};
	}

	const extensions = parseUriListParameter(mediaType, EXT_PARAMETER);
	const profiles = parseUriListParameter(mediaType, PROFILE_PARAMETER);
	const invalidUris = [...invalidUriListValues(extensions), ...invalidUriListValues(profiles)];
	if (invalidUris.length > 0) {
		return {
			_tag: "UnsupportedMediaType",
			reason: "invalid-uri",
			details: invalidUris,
		};
	}
	const supportedExtensions = options.supportedExtensions ?? [];
	const unsupportedExtensions = unsupportedExtensionUris(extensions, supportedExtensions);
	if (unsupportedExtensions.length > 0) {
		return {
			_tag: "UnsupportedMediaType",
			reason: "unsupported-extension",
			details: unsupportedExtensions,
		};
	}

	return {
		_tag: "ValidContentType",
		mediaType,
		extensions,
		profiles,
	};
};

/**
 * Negotiates an HTTP `Accept` header according to JSON:API server rules.
 *
 * Empty or absent `Accept` headers are acceptable. JSON:API media ranges with
 * unsupported extension URIs can make the request not acceptable when no
 * supported JSON:API alternative remains.
 *
 * @example
 * ```ts
 * const negotiation = negotiateJsonApiAccept(
 * 	'application/vnd.api+json;ext="https://jsonapi.org/ext/version";q=0.8',
 * 	{ supportedExtensions: ["https://jsonapi.org/ext/version"] },
 * );
 * negotiation._tag; // "Acceptable"
 * ```
 */
export const negotiateJsonApiAccept = (
	accept: string | undefined,
	options: {
		readonly supportedExtensions?: ReadonlyArray<string>;
	} = {},
): AcceptNegotiation => {
	if (accept === undefined || accept.trim() === "") {
		return { _tag: "Acceptable", mediaTypes: [] };
	}

	const jsonApiMediaTypes = parseAcceptHeader(accept).filter(isJsonApiMediaType);
	if (jsonApiMediaTypes.length === 0) {
		if (accept.toLowerCase().includes(JSON_API_MEDIA_TYPE)) {
			return { _tag: "NotAcceptable", reason: "invalid-parameter", details: [] };
		}
		return { _tag: "Acceptable", mediaTypes: [] };
	}

	const invalidQuality = jsonApiMediaTypes.filter((mediaType) => mediaType.quality < 0);
	if (invalidQuality.length > 0) {
		return {
			_tag: "NotAcceptable",
			reason: "invalid-quality",
			details: invalidQuality.map((mediaType) => mediaType.essence),
		};
	}

	const allowedParameters = new Set([EXT_PARAMETER, PROFILE_PARAMETER]);
	const supportedParameters = jsonApiMediaTypes.filter(
		(mediaType) => unsupportedParameterNames(mediaType, allowedParameters).length === 0,
	);
	if (supportedParameters.length === 0) {
		return {
			_tag: "NotAcceptable",
			reason: "unsupported-parameter",
			details: jsonApiMediaTypes.flatMap((mediaType) =>
				unsupportedParameterNames(mediaType, allowedParameters),
			),
		};
	}

	const supportedUriParameters = supportedParameters.filter(
		(mediaType) => invalidUriParameters(mediaType).length === 0,
	);
	if (supportedUriParameters.length === 0) {
		return {
			_tag: "NotAcceptable",
			reason: "invalid-parameter",
			details: supportedParameters.flatMap(invalidUriParameters),
		};
	}

	const supportedExtensions = options.supportedExtensions ?? [];
	const acceptable = supportedUriParameters
		.filter((mediaType) => {
			const extensions = parseUriListParameter(mediaType, EXT_PARAMETER);
			return (
				extensions.length === 0 ||
				unsupportedExtensionUris(extensions, supportedExtensions).length === 0
			);
		})
		.filter((mediaType) => mediaType.quality > 0)
		.toSorted((left, right) => right.quality - left.quality);

	if (acceptable.length === 0) {
		if (supportedUriParameters.every((mediaType) => mediaType.quality === 0)) {
			return {
				_tag: "NotAcceptable",
				reason: "not-acceptable",
				details: [JSON_API_MEDIA_TYPE],
			};
		}
		return {
			_tag: "NotAcceptable",
			reason: "unsupported-extension",
			details: supportedUriParameters.flatMap((mediaType) =>
				unsupportedExtensionUris(
					parseUriListParameter(mediaType, EXT_PARAMETER),
					supportedExtensions,
				),
			),
		};
	}

	return { _tag: "Acceptable", mediaTypes: acceptable };
};

/**
 * Schema for JSON:API `ext` and `profile` media type URI-list values after parsing.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(MediaTypeParameterUriList)([
 * 	"https://jsonapi.org/ext/version",
 * ]);
 * ```
 */
export const MediaTypeParameterUriList = Schema.Array(Uri).annotate({
	identifier: "JsonApiMediaTypeParameterUriList",
	description: "A JSON:API media type ext or profile URI list.",
});

/**
 * Marks an Effect HttpApi response schema as JSON with a JSON:API content type.
 *
 * @example
 * ```ts
 * const JsonArticle = Article.pipe(asJsonApi());
 * ```
 */
export const asJsonApi = (parameters: JsonApiMediaTypeParameters = {}) =>
	HttpApiSchema.asJson({ contentType: formatJsonApiMediaType(parameters) });

/**
 * Adds an HTTP status code and JSON:API content type to an Effect HttpApi schema.
 *
 * @example
 * ```ts
 * const CreatedArticle = withJsonApiStatus(201)(ArticleDocument);
 * ```
 */
export const withJsonApiStatus =
	(code: number, parameters: JsonApiMediaTypeParameters = {}) =>
	<S extends Schema.Top>(schema: S) =>
		schema.pipe(HttpApiSchema.status(code), asJsonApi(parameters));
