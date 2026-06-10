import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
	AtMemberName,
	ExtensionMemberName,
	FieldName,
	IncludeParameter,
	isAtMemberName,
	isExtensionMemberName,
	isFieldName,
	isMemberName,
	isRelationshipPath,
	isSortField,
	MemberName,
	RelationshipPath,
	SortParameter,
	SparseFieldsetParameter,
} from "./MemberName.js";

describe("member name predicates", () => {
	it("accepts legal member names", () => {
		expect(isMemberName("title")).toBe(true);
		expect(isMemberName("published-at")).toBe(true);
		expect(isMemberName("published_at")).toBe(true);
		expect(isMemberName("a b")).toBe(true);
		expect(isMemberName("naïve")).toBe(true);
		expect(isMemberName("a")).toBe(true);
	});

	it("rejects illegal member names", () => {
		expect(isMemberName("")).toBe(false);
		expect(isMemberName(" title")).toBe(false);
		expect(isMemberName("title ")).toBe(false);
		expect(isMemberName("-title")).toBe(false);
		expect(isMemberName("title_")).toBe(false);
		expect(isMemberName("ti+tle")).toBe(false);
		expect(isMemberName("ti:tle")).toBe(false);
	});

	it("classifies @-members", () => {
		expect(isAtMemberName("@context")).toBe(true);
		expect(isAtMemberName("context")).toBe(false);
		expect(isAtMemberName("@")).toBe(false);
	});

	it("classifies extension member names", () => {
		expect(isExtensionMemberName("version:id")).toBe(true);
		expect(isExtensionMemberName("version:id:extra")).toBe(false);
		expect(isExtensionMemberName(":id")).toBe(false);
		expect(isExtensionMemberName("version:")).toBe(false);
		expect(isExtensionMemberName("ver-sion:id")).toBe(false);
	});

	it("rejects reserved field names", () => {
		expect(isFieldName("title")).toBe(true);
		expect(isFieldName("type")).toBe(false);
		expect(isFieldName("id")).toBe(false);
	});

	it("validates relationship paths", () => {
		expect(isRelationshipPath("author")).toBe(true);
		expect(isRelationshipPath("author.organization")).toBe(true);
		expect(isRelationshipPath("author..organization")).toBe(false);
		expect(isRelationshipPath("")).toBe(false);
	});

	it("validates sort fields", () => {
		expect(isSortField("publishedAt")).toBe(true);
		expect(isSortField("-publishedAt")).toBe(true);
		expect(isSortField("--publishedAt")).toBe(false);
	});
});

describe("member name schemas", () => {
	it("decodes legal values", () => {
		expect(Schema.decodeUnknownSync(MemberName)("published-at")).toBe("published-at");
		expect(Schema.decodeUnknownSync(AtMemberName)("@context")).toBe("@context");
		expect(Schema.decodeUnknownSync(ExtensionMemberName)("version:id")).toBe("version:id");
		expect(Schema.decodeUnknownSync(FieldName)("title")).toBe("title");
		expect(Schema.decodeUnknownSync(RelationshipPath)("comments.author")).toBe("comments.author");
		expect(Schema.decodeUnknownSync(IncludeParameter)("author,comments.author")).toBe(
			"author,comments.author",
		);
		expect(Schema.decodeUnknownSync(IncludeParameter)("")).toBe("");
		expect(Schema.decodeUnknownSync(SparseFieldsetParameter)("title,body")).toBe("title,body");
		expect(Schema.decodeUnknownSync(SparseFieldsetParameter)("")).toBe("");
		expect(Schema.decodeUnknownSync(SortParameter)("-publishedAt,title")).toBe(
			"-publishedAt,title",
		);
	});

	it("rejects illegal values", () => {
		expect(() => Schema.decodeUnknownSync(MemberName)(" title")).toThrow();
		expect(() => Schema.decodeUnknownSync(AtMemberName)("context")).toThrow();
		expect(() => Schema.decodeUnknownSync(ExtensionMemberName)("version")).toThrow();
		expect(() => Schema.decodeUnknownSync(FieldName)("type")).toThrow();
		expect(() => Schema.decodeUnknownSync(RelationshipPath)("a..b")).toThrow();
		expect(() => Schema.decodeUnknownSync(SparseFieldsetParameter)("title,id")).toThrow();
		expect(() => Schema.decodeUnknownSync(SortParameter)("")).toThrow();
	});
});
