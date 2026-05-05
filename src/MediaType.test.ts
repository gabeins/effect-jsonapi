import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	JSON_API_MEDIA_TYPE,
	formatJsonApiMediaType,
	negotiateJsonApiAccept,
	parseAcceptHeader,
	parseMediaType,
	validateJsonApiContentType,
	withJsonApiStatus,
} from "./MediaType.js";

describe("JSON:API media type", () => {
	it("formats and parses ext/profile parameters", () => {
		const contentType = formatJsonApiMediaType({
			ext: ["https://jsonapi.org/ext/atomic"],
			profile: ["https://example.com/profiles/timestamps"],
		});
		const parsed = parseMediaType(contentType);

		expect(contentType).toBe(
			'application/vnd.api+json;ext="https://jsonapi.org/ext/atomic";profile="https://example.com/profiles/timestamps"',
		);
		expect(parsed?.essence).toBe(JSON_API_MEDIA_TYPE);
		expect(parsed?.parameters.get("ext")).toBe("https://jsonapi.org/ext/atomic");
		expect(parsed?.parameters.get("profile")).toBe("https://example.com/profiles/timestamps");
	});

	it("validates content type parameters and supported extensions", () => {
		expect(validateJsonApiContentType(JSON_API_MEDIA_TYPE)._tag).toBe("ValidContentType");
		expect(validateJsonApiContentType("application/vnd.api+json;charset=utf-8")).toEqual({
			_tag: "UnsupportedMediaType",
			reason: "unsupported-parameter",
			details: ["charset"],
		});
		expect(validateJsonApiContentType("application/vnd.api+json;ext")).toEqual({
			_tag: "UnsupportedMediaType",
			reason: "invalid-parameter",
			details: [],
		});
		expect(validateJsonApiContentType('application/vnd.api+json;profile="not-a-uri"')).toEqual({
			_tag: "UnsupportedMediaType",
			reason: "invalid-uri",
			details: ["not-a-uri"],
		});
		expect(
			validateJsonApiContentType('application/vnd.api+json;ext="https://jsonapi.org/ext/atomic"', {
				supportedExtensions: [],
			}),
		).toEqual({
			_tag: "UnsupportedMediaType",
			reason: "unsupported-extension",
			details: ["https://jsonapi.org/ext/atomic"],
		});
	});

	it("parses Accept quality values without treating q as a JSON:API parameter", () => {
		const parsed = parseAcceptHeader(
			'application/vnd.api+json;profile="https://example.com/profile";q=0.5',
		);

		expect(parsed[0]?.quality).toBe(0.5);
		expect(parsed[0]?.parameters.has("q")).toBe(false);
		expect(parseAcceptHeader("application/vnd.api+json;q=2")[0]?.quality).toBe(-1);
	});

	it("negotiates Accept according to JSON:API 1.1 server rules", () => {
		expect(negotiateJsonApiAccept("application/vnd.api+json;charset=utf-8")).toEqual({
			_tag: "NotAcceptable",
			reason: "unsupported-parameter",
			details: ["charset"],
		});
		expect(
			negotiateJsonApiAccept('application/vnd.api+json;ext="https://jsonapi.org/ext/atomic"', {
				supportedExtensions: [],
			}),
		).toEqual({
			_tag: "NotAcceptable",
			reason: "unsupported-extension",
			details: ["https://jsonapi.org/ext/atomic"],
		});
		expect(negotiateJsonApiAccept("application/vnd.api+json;q=0")).toEqual({
			_tag: "NotAcceptable",
			reason: "not-acceptable",
			details: ["application/vnd.api+json"],
		});
		expect(negotiateJsonApiAccept("application/vnd.api+json;q=2")).toEqual({
			_tag: "NotAcceptable",
			reason: "invalid-quality",
			details: ["application/vnd.api+json"],
		});
		expect(negotiateJsonApiAccept('application/vnd.api+json;ext="not-a-uri"')).toEqual({
			_tag: "NotAcceptable",
			reason: "invalid-parameter",
			details: ["not-a-uri"],
		});
		expect(
			negotiateJsonApiAccept(
				'application/vnd.api+json;charset=utf-8, application/vnd.api+json;profile="https://example.com/profile"',
			)._tag,
		).toBe("Acceptable");
	});

	it("annotates schemas for future HttpApi JSON:API responses", () => {
		const schema = Schema.Struct({ data: Schema.String }).pipe(withJsonApiStatus(201));

		expect(schema.ast.annotations?.httpApiStatus).toBe(201);
	});
});
