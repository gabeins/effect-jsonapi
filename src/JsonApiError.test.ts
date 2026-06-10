import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
	BadRequest,
	ErrorObject,
	ErrorsDocument,
	HttpStatusCodeString,
	NotFound,
	UnprocessableContent,
} from "./JsonApiError.js";

describe("error object schemas", () => {
	it("validates HTTP status code strings", () => {
		expect(Schema.decodeUnknownSync(HttpStatusCodeString)("404")).toBe("404");
		expect(() => Schema.decodeUnknownSync(HttpStatusCodeString)("9000")).toThrow();
		expect(() => Schema.decodeUnknownSync(HttpStatusCodeString)(404)).toThrow();
	});

	it("requires at least one error member", () => {
		expect(
			Schema.decodeUnknownSync(ErrorObject)({
				status: "404",
				title: "Not Found",
			}),
		).toEqual({ status: "404", title: "Not Found" });
		expect(() => Schema.decodeUnknownSync(ErrorObject)({})).toThrow();
	});

	it("decodes errors documents", () => {
		const document = {
			errors: [
				{
					status: "422",
					detail: "Title must not be empty.",
					source: { pointer: "/data/attributes/title" },
				},
			],
		};
		expect(Schema.decodeUnknownSync(ErrorsDocument)(document)).toEqual(document);
	});
});

describe("status error classes", () => {
	it("builds errors with default status and title", () => {
		const error = NotFound.of({ detail: "User 1 does not exist." });
		expect(error.errors).toEqual([
			{ status: "404", title: "Not Found", detail: "User 1 does not exist." },
		]);
	});

	it("builds a default error object when called without arguments", () => {
		const error = BadRequest.of();
		expect(error.errors).toEqual([{ status: "400", title: "Bad Request" }]);
	});

	it("encodes to a JSON:API errors document without a tag member", () => {
		const error = UnprocessableContent.of({
			detail: "Title must not be empty.",
			source: { pointer: "/data/attributes/title" },
		});
		const encoded = Schema.encodeUnknownSync(UnprocessableContent)(error);
		expect(encoded).toEqual({
			errors: [
				{
					status: "422",
					title: "Unprocessable Content",
					detail: "Title must not be empty.",
					source: { pointer: "/data/attributes/title" },
				},
			],
		});
		expect(Object.keys(encoded)).not.toContain("_tag");
		expect(Schema.decodeUnknownSync(ErrorsDocument)(encoded)).toEqual(encoded);
	});

	it("decodes wire documents back into error instances", () => {
		const decoded = Schema.decodeUnknownSync(NotFound)({
			errors: [{ status: "404", title: "Not Found" }],
		});
		expect(decoded).toBeInstanceOf(NotFound);
	});
});
