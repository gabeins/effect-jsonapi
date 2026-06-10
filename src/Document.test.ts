import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import * as Document from "./Document.js";
import * as Relationship from "./Relationship.js";
import * as Resource from "./Resource.js";

const linkedArticleDocument = {
	data: {
		type: "articles",
		id: "1",
		attributes: {
			title: "JSON:API paints my bikeshed!",
		},
		relationships: {
			author: {
				data: { type: "people", id: "9" },
			},
			comments: {
				data: [{ type: "comments", id: "5" }],
			},
		},
	},
	included: [
		{
			type: "people",
			id: "9",
			attributes: { name: "Dan" },
		},
		{
			type: "comments",
			id: "5",
			relationships: {
				author: {
					data: { type: "people", id: "9" },
				},
			},
		},
	],
};

describe("top-level document rules", () => {
	it("decodes a compound document", () => {
		expect(Schema.decodeUnknownSync(Document.TopLevelDocument)(linkedArticleDocument)).toEqual(
			linkedArticleDocument,
		);
	});

	it("requires data, errors, meta, or an extension member", () => {
		expect(() => Schema.decodeUnknownSync(Document.TopLevelDocument)({})).toThrow();
		expect(Schema.decodeUnknownSync(Document.TopLevelDocument)({ meta: {} })).toEqual({
			meta: {},
		});
		expect(Schema.decodeUnknownSync(Document.TopLevelDocument)({ "version:id": "42" })).toEqual({
			"version:id": "42",
		});
	});

	it("rejects data together with errors", () => {
		expect(() =>
			Schema.decodeUnknownSync(Document.TopLevelDocument)({
				data: null,
				errors: [{ status: "400" }],
			}),
		).toThrow();
	});

	it("rejects included without data", () => {
		expect(() =>
			Schema.decodeUnknownSync(Document.TopLevelDocument)({
				meta: {},
				included: [{ type: "people", id: "9" }],
			}),
		).toThrow();
	});

	it("rejects duplicate included resources", () => {
		expect(() =>
			Schema.decodeUnknownSync(Document.TopLevelDocument)({
				data: null,
				included: [
					{ type: "people", id: "9" },
					{ type: "people", id: "9" },
				],
			}),
		).toThrow();
	});

	it("rejects inconsistent id/lid pairings", () => {
		expect(() =>
			Schema.decodeUnknownSync(Document.TopLevelDocument)({
				data: [
					{ type: "articles", id: "1", lid: "a" },
					{ type: "articles", id: "1", lid: "b" },
				],
			}),
		).toThrow();
	});
});

describe("full linkage", () => {
	it("accepts compound documents with full linkage", () => {
		expect(
			Document.hasFullLinkage(
				Schema.decodeUnknownSync(Document.TopLevelDocument)(linkedArticleDocument),
			),
		).toBe(true);
	});

	it("rejects unreachable included resources", () => {
		const document = Schema.decodeUnknownSync(Document.TopLevelDocument)({
			data: { type: "articles", id: "1" },
			included: [{ type: "people", id: "9" }],
		});
		expect(Document.hasFullLinkage(document)).toBe(false);
		expect(() =>
			Schema.decodeUnknownSync(Document.ResponseDocument)({
				data: { type: "articles", id: "1" },
				included: [{ type: "people", id: "9" }],
			}),
		).toThrow();
	});
});

describe("resource wire schemas", () => {
	it("rejects resource identifiers without id or lid", () => {
		expect(() =>
			Schema.decodeUnknownSync(Document.ResourceIdentifierObject)({ type: "articles" }),
		).toThrow();
		expect(
			Schema.decodeUnknownSync(Document.ResourceIdentifierObject)({
				type: "articles",
				lid: "tmp",
			}),
		).toEqual({ type: "articles", lid: "tmp" });
	});

	it("rejects field collisions on resource objects", () => {
		expect(() =>
			Schema.decodeUnknownSync(Document.ResourceObject)({
				type: "articles",
				id: "1",
				attributes: { author: "x" },
				relationships: { author: { data: null } },
			}),
		).toThrow();
	});

	it("rejects relationship objects without members", () => {
		expect(() => Schema.decodeUnknownSync(Document.RelationshipObject)({})).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Document builders
// ---------------------------------------------------------------------------

const CommentResource = Resource.make("comments", {
	attributes: { body: Schema.String },
	relationships: {
		author: Relationship.toOne((): Resource.Any => PersonResource),
	},
});

const PersonResource = Resource.make("people", {
	attributes: { name: Schema.String },
	relationships: {
		comments: Relationship.toMany(() => CommentResource),
	},
});

const ArticleResource = Resource.make("articles", {
	attributes: { title: Schema.String, body: Schema.String },
	relationships: {
		author: Relationship.toOne(() => PersonResource, { nullable: false }),
		comments: Relationship.toMany(() => CommentResource),
	},
});

const dan: Resource.Entity<typeof PersonResource> = {
	id: "9",
	attributes: { name: "Dan" },
};

const comment: Resource.Entity<typeof CommentResource> = {
	id: "5",
	attributes: { body: "First!" },
	relationships: { author: dan },
};

const article: Resource.Entity<typeof ArticleResource> = {
	id: "1",
	attributes: { title: "JSON:API paints my bikeshed!", body: "..." },
	relationships: {
		author: dan,
		comments: [comment],
	},
	links: { self: "/articles/1" },
};

describe("Document.fromResource", () => {
	it("serializes an entity without includes", () => {
		const document = Document.fromResource(ArticleResource, article);
		expect(document).toEqual({
			data: {
				type: "articles",
				id: "1",
				attributes: { title: "JSON:API paints my bikeshed!", body: "..." },
				relationships: {
					author: { data: { type: "people", id: "9" } },
					comments: { data: [{ type: "comments", id: "5" }] },
				},
				links: { self: "/articles/1" },
			},
		});
	});

	it("builds compound documents along requested include paths", () => {
		const document = Document.fromResource(ArticleResource, article, {
			query: { include: ["author", "comments.author"] },
		});
		expect(document.included).toEqual([
			{ type: "people", id: "9", attributes: { name: "Dan" } },
			{
				type: "comments",
				id: "5",
				attributes: { body: "First!" },
				relationships: { author: { data: { type: "people", id: "9" } } },
			},
		]);
		expect(Document.hasFullLinkage(document as Document.TopLevelDocument)).toBe(true);
	});

	it("deduplicates included resources", () => {
		const document = Document.fromResource(ArticleResource, article, {
			query: { include: ["author", "comments", "comments.author"] },
		});
		const people = (document.included ?? []).filter((resource) => resource.type === "people");
		expect(people).toHaveLength(1);
	});

	it("applies sparse fieldsets to attributes and relationships", () => {
		const document = Document.fromResource(ArticleResource, article, {
			query: {
				include: ["author"],
				fields: { articles: ["title", "author"], people: [] },
			},
		});
		expect(document.data.attributes).toEqual({ title: "JSON:API paints my bikeshed!" });
		expect(document.data.relationships).toEqual({
			author: { data: { type: "people", id: "9" } },
		});
		// Included resources are still present, with their fieldsets applied.
		expect(document.included).toEqual([{ type: "people", id: "9" }]);
	});

	it("keeps building included resources for relationships hidden by fieldsets", () => {
		const document = Document.fromResource(ArticleResource, article, {
			query: {
				include: ["comments"],
				fields: { articles: ["title"] },
			},
		});
		expect(document.data.relationships).toBeUndefined();
		expect(document.included).toEqual([
			{
				type: "comments",
				id: "5",
				attributes: { body: "First!" },
				relationships: { author: { data: { type: "people", id: "9" } } },
			},
		]);
	});

	it("encodes through the derived document schema", () => {
		const document = Document.fromResource(ArticleResource, article, {
			query: { include: ["author", "comments.author"] },
			meta: { copyright: "2026" },
			jsonapi: { version: "1.1" },
		});
		expect(Schema.encodeUnknownSync(ArticleResource.Document)(document)).toEqual(document);
	});
});

describe("Document.fromNullableResource", () => {
	it("builds null documents", () => {
		const document = Document.fromNullableResource(PersonResource, null);
		expect(document).toEqual({ data: null });
		expect(Schema.encodeUnknownSync(PersonResource.NullableDocument)(document)).toEqual(document);
	});
});

describe("Document.fromCollection", () => {
	it("serializes entities and document-level members", () => {
		const document = Document.fromCollection(ArticleResource, [article], {
			links: { self: "/articles" },
			meta: { total: 1 },
		});
		expect(document.data).toHaveLength(1);
		expect(document.links).toEqual({ self: "/articles" });
		expect(document.meta).toEqual({ total: 1 });
		expect(Schema.encodeUnknownSync(ArticleResource.CollectionDocument)(document)).toEqual(
			document,
		);
	});

	it("does not duplicate primary resources in included", () => {
		const selfReferential: Resource.Entity<typeof PersonResource> = {
			id: "9",
			attributes: { name: "Dan" },
			relationships: { comments: [comment] },
		};
		const document = Document.fromCollection(PersonResource, [selfReferential], {
			query: { include: ["comments.author"] },
		});
		// "Dan" is primary data, so only the comment lands in included even though
		// it links back to him.
		expect(document.included).toEqual([
			{
				type: "comments",
				id: "5",
				attributes: { body: "First!" },
				relationships: { author: { data: { type: "people", id: "9" } } },
			},
		]);
		expect(Document.hasFullLinkage(document as Document.TopLevelDocument)).toBe(true);
	});

	it("supports plain id references and identifier references with meta", () => {
		const document = Document.fromCollection(ArticleResource, [
			{
				id: "2",
				attributes: { title: "Second", body: "..." },
				relationships: {
					author: { id: "9", meta: { verified: true } },
					comments: ["5", "6"],
				},
			},
		]);
		expect(document.data[0]?.relationships).toEqual({
			author: { data: { type: "people", id: "9", meta: { verified: true } } },
			comments: {
				data: [
					{ type: "comments", id: "5" },
					{ type: "comments", id: "6" },
				],
			},
		});
	});
});
