import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { extensibleObject } from "./Extension.js";

describe("JSON:API extension members", () => {
	it("can extend closed base schemas with extension and @-members", () => {
		const ResourceWithExtensionMembers = extensibleObject(
			Schema.Struct({
				type: Schema.String,
				id: Schema.String,
			}),
		);

		expect(
			Schema.decodeUnknownSync(ResourceWithExtensionMembers)({
				"type": "articles",
				"id": "1",
				"version:id": "42",
				"@context": "https://example.com/context",
			}),
		).toEqual({
			"type": "articles",
			"id": "1",
			"version:id": "42",
			"@context": "https://example.com/context",
		});
		expect(() =>
			Schema.decodeUnknownSync(ResourceWithExtensionMembers)({
				"type": "articles",
				"id": "1",
				"bad.extension": true,
			}),
		).toThrow();
	});
});
