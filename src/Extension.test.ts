import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { AtMembers, ExtensionMembers, extensibleObject } from "./Extension.js";

describe("extension member schemas", () => {
	it("decodes extension members", () => {
		expect(Schema.decodeUnknownSync(ExtensionMembers)({ "version:id": "42" })).toEqual({
			"version:id": "42",
		});
		expect(() => Schema.decodeUnknownSync(ExtensionMembers)({ version: "42" })).toThrow();
	});

	it("decodes @-members", () => {
		expect(Schema.decodeUnknownSync(AtMembers)({ "@context": "ctx" })).toEqual({
			"@context": "ctx",
		});
		expect(() => Schema.decodeUnknownSync(AtMembers)({ context: "ctx" })).toThrow();
	});
});

describe("extensibleObject", () => {
	const schema = extensibleObject(Schema.Struct({ type: Schema.String }));

	it("keeps known fields and accepts extension and @-members", () => {
		expect(
			Schema.decodeUnknownSync(schema)({
				"type": "articles",
				"version:id": "42",
				"@context": "ctx",
			}),
		).toEqual({
			"type": "articles",
			"version:id": "42",
			"@context": "ctx",
		});
	});

	it("rejects unexpected member names", () => {
		expect(() => Schema.decodeUnknownSync(schema)({ type: "articles", extra: 1 })).toThrow();
	});
});
