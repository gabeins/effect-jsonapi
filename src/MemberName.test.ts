import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	AtMemberName,
	ExtensionMemberName,
	FieldName,
	IncludeParameter,
	MemberName,
	SortParameter,
	SparseFieldsetParameter,
	isMemberName,
} from "./MemberName.js";

describe("JSON:API member names", () => {
	it("accepts legal implementation member names", () => {
		expect(isMemberName("firstName")).toBe(true);
		expect(isMemberName("full name")).toBe(true);
		expect(isMemberName("café")).toBe(true);
		expect(Schema.decodeUnknownSync(MemberName)("football_club")).toBe("football_club");
	});

	it("rejects reserved characters and invalid boundaries", () => {
		expect(() => Schema.decodeUnknownSync(MemberName)("_hidden")).toThrow();
		expect(() => Schema.decodeUnknownSync(MemberName)("author.name")).toThrow();
		expect(() => Schema.decodeUnknownSync(MemberName)("bad+name")).toThrow();
		expect(() => Schema.decodeUnknownSync(MemberName)("name-")).toThrow();
	});

	it("supports @-members and extension member names", () => {
		expect(Schema.decodeUnknownSync(AtMemberName)("@context")).toBe("@context");
		expect(Schema.decodeUnknownSync(ExtensionMemberName)("version:id")).toBe("version:id");
	});

	it("keeps resource fields out of the type/id namespace", () => {
		expect(Schema.decodeUnknownSync(FieldName)("title")).toBe("title");
		expect(() => Schema.decodeUnknownSync(FieldName)("type")).toThrow();
		expect(() => Schema.decodeUnknownSync(FieldName)("id")).toThrow();
	});

	it("validates include, fields, and sort parameter values", () => {
		expect(Schema.decodeUnknownSync(IncludeParameter)("author,comments.author")).toBe(
			"author,comments.author",
		);
		expect(Schema.decodeUnknownSync(IncludeParameter)("")).toBe("");
		expect(Schema.decodeUnknownSync(SparseFieldsetParameter)("title,author")).toBe("title,author");
		expect(Schema.decodeUnknownSync(SparseFieldsetParameter)("")).toBe("");
		expect(Schema.decodeUnknownSync(SortParameter)("-created,title")).toBe("-created,title");
		expect(() => Schema.decodeUnknownSync(IncludeParameter)("comments..author")).toThrow();
		expect(() => Schema.decodeUnknownSync(SortParameter)("")).toThrow();
	});
});
