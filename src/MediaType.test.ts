import { describe, expect, it } from "@effect/vitest";
import {
	formatJsonApiMediaType,
	JSON_API_MEDIA_TYPE,
	negotiateJsonApiAccept,
	parseAcceptHeader,
	parseMediaType,
	validateJsonApiContentType,
} from "./MediaType.js";

describe("media type parsing", () => {
	it("parses an essence and parameters", () => {
		const parsed = parseMediaType('application/vnd.api+json;ext="https://jsonapi.org/ext/version"');
		expect(parsed?.essence).toBe(JSON_API_MEDIA_TYPE);
		expect(parsed?.parameters.get("ext")).toBe("https://jsonapi.org/ext/version");
	});

	it("normalizes the essence and parameter names to lowercase", () => {
		const parsed = parseMediaType("Application/VND.API+JSON;Profile=x");
		expect(parsed?.essence).toBe(JSON_API_MEDIA_TYPE);
		expect(parsed?.parameters.has("profile")).toBe(true);
	});

	it("parses accept headers with quality values", () => {
		const parsed = parseAcceptHeader("application/vnd.api+json;q=0.5, text/html");
		expect(parsed).toHaveLength(2);
		expect(parsed[0]?.quality).toBe(0.5);
		expect(parsed[0]?.parameters.has("q")).toBe(false);
		expect(parsed[1]?.quality).toBe(1);
	});

	it("formats the JSON:API media type with parameters", () => {
		expect(formatJsonApiMediaType()).toBe(JSON_API_MEDIA_TYPE);
		expect(
			formatJsonApiMediaType({
				ext: ["https://jsonapi.org/ext/version"],
				profile: ["https://example.com/profiles/timestamps"],
			}),
		).toBe(
			'application/vnd.api+json;ext="https://jsonapi.org/ext/version";profile="https://example.com/profiles/timestamps"',
		);
	});
});

describe("content type validation", () => {
	it("accepts the plain JSON:API media type", () => {
		const validation = validateJsonApiContentType(JSON_API_MEDIA_TYPE);
		expect(validation._tag).toBe("ValidContentType");
	});

	it("accepts supported extensions and any profiles", () => {
		const validation = validateJsonApiContentType(
			'application/vnd.api+json;ext="https://jsonapi.org/ext/version";profile="https://example.com/p"',
			{ supportedExtensions: ["https://jsonapi.org/ext/version"] },
		);
		expect(validation._tag).toBe("ValidContentType");
		if (validation._tag === "ValidContentType") {
			expect(validation.extensions).toEqual(["https://jsonapi.org/ext/version"]);
			expect(validation.profiles).toEqual(["https://example.com/p"]);
		}
	});

	it("rejects unsupported media type parameters", () => {
		const validation = validateJsonApiContentType("application/vnd.api+json;charset=utf-8");
		expect(validation).toMatchObject({
			_tag: "UnsupportedMediaType",
			reason: "unsupported-parameter",
			details: ["charset"],
		});
	});

	it("rejects unsupported extensions", () => {
		const validation = validateJsonApiContentType(
			'application/vnd.api+json;ext="https://example.com/ext/unknown"',
		);
		expect(validation).toMatchObject({
			_tag: "UnsupportedMediaType",
			reason: "unsupported-extension",
		});
	});

	it("rejects missing and non-JSON:API media types", () => {
		expect(validateJsonApiContentType(undefined)._tag).toBe("UnsupportedMediaType");
		expect(validateJsonApiContentType("application/json")).toMatchObject({
			_tag: "UnsupportedMediaType",
			reason: "not-jsonapi",
		});
	});
});

describe("accept negotiation", () => {
	it("accepts absent and unrelated accept headers", () => {
		expect(negotiateJsonApiAccept(undefined)._tag).toBe("Acceptable");
		expect(negotiateJsonApiAccept("text/html")._tag).toBe("Acceptable");
	});

	it("accepts the plain JSON:API media type", () => {
		expect(negotiateJsonApiAccept(JSON_API_MEDIA_TYPE)._tag).toBe("Acceptable");
	});

	it("rejects when all JSON:API media ranges carry unsupported parameters", () => {
		const negotiation = negotiateJsonApiAccept("application/vnd.api+json;charset=utf-8");
		expect(negotiation).toMatchObject({
			_tag: "NotAcceptable",
			reason: "unsupported-parameter",
		});
	});

	it("accepts when at least one JSON:API media range is supported", () => {
		const negotiation = negotiateJsonApiAccept(
			"application/vnd.api+json;charset=utf-8, application/vnd.api+json",
		);
		expect(negotiation._tag).toBe("Acceptable");
	});

	it("rejects unsupported extensions", () => {
		const negotiation = negotiateJsonApiAccept(
			'application/vnd.api+json;ext="https://example.com/ext/unknown"',
		);
		expect(negotiation).toMatchObject({
			_tag: "NotAcceptable",
			reason: "unsupported-extension",
		});
	});

	it("sorts acceptable media types by quality", () => {
		const negotiation = negotiateJsonApiAccept(
			'application/vnd.api+json;ext="https://jsonapi.org/ext/version";q=0.9, application/vnd.api+json',
			{ supportedExtensions: ["https://jsonapi.org/ext/version"] },
		);
		expect(negotiation._tag).toBe("Acceptable");
		if (negotiation._tag === "Acceptable") {
			expect(negotiation.mediaTypes[0]?.quality).toBe(1);
		}
	});
});
