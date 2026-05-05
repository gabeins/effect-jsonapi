import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { ErrorObject } from "./Error.js";
import {
	CreateResourceDocument,
	ToManyRelationshipDocument,
	ToOneRelationshipDocument,
} from "./Request.js";
import {
	ResponseDocument,
	TopLevelDocument,
	dataDocument,
	hasFullLinkage,
	metaDocument,
	successResponse,
	topLevelDocument,
} from "./Document.js";
import { ResourceObject } from "./Resource.js";

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
			attributes: {
				name: "Dan",
			},
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

describe("JSON:API documents", () => {
	it("validates top-level document rules", () => {
		expect(Schema.decodeUnknownSync(TopLevelDocument)(linkedArticleDocument)).toEqual(
			linkedArticleDocument,
		);
		expect(() =>
			Schema.decodeUnknownSync(TopLevelDocument)({
				data: null,
				errors: [{ title: "Bad request" }],
			}),
		).toThrow();
		expect(() =>
			Schema.decodeUnknownSync(TopLevelDocument)({
				included: [{ type: "people", id: "9" }],
				meta: {},
			}),
		).toThrow();
		expect(() =>
			Schema.decodeUnknownSync(TopLevelDocument)({ jsonapi: { version: "1.1" } }),
		).toThrow();
		expect(
			Schema.decodeUnknownSync(TopLevelDocument)({
				"version:id": "42",
			}),
		).toEqual({ "version:id": "42" });
	});

	it("rejects duplicate included resources", () => {
		expect(() =>
			Schema.decodeUnknownSync(TopLevelDocument)({
				data: [],
				included: [
					{ type: "people", id: "9" },
					{ type: "people", id: "9" },
				],
			}),
		).toThrow();
	});

	it("checks compound document full linkage separately from shape validation", () => {
		const linked = Schema.decodeUnknownSync(TopLevelDocument)(linkedArticleDocument);
		const unlinked = Schema.decodeUnknownSync(TopLevelDocument)({
			data: {
				type: "articles",
				id: "1",
			},
			included: [
				{
					type: "people",
					id: "9",
				},
			],
		});

		expect(hasFullLinkage(linked)).toBe(true);
		expect(hasFullLinkage(unlinked)).toBe(false);
		expect(() =>
			Schema.decodeUnknownSync(topLevelDocument({ requireFullLinkage: true }))(unlinked),
		).toThrow();
	});

	it("validates stricter response documents", () => {
		expect(
			Schema.decodeUnknownSync(ResponseDocument)({
				data: {
					type: "articles",
					id: "1",
					relationships: {
						author: {
							data: { type: "people", id: "9" },
						},
					},
				},
				included: [{ type: "people", id: "9" }],
			}),
		).toEqual({
			data: {
				type: "articles",
				id: "1",
				relationships: {
					author: {
						data: { type: "people", id: "9" },
					},
				},
			},
			included: [{ type: "people", id: "9" }],
		});
		expect(() =>
			Schema.decodeUnknownSync(ResponseDocument)({
				data: { type: "articles", id: "1" },
				included: [{ type: "people", lid: "local-9" }],
			}),
		).toThrow();
		expect(() =>
			Schema.decodeUnknownSync(TopLevelDocument)({
				data: {
					type: "articles",
					id: "1",
					relationships: {
						comment: {
							data: { type: "comments", id: "5", lid: "local-5" },
						},
					},
				},
				included: [{ type: "comments", id: "5", lid: "other-local-5" }],
			}),
		).toThrow();
	});

	it("provides reusable data, meta, and success response schemas", () => {
		const ArticleDocument = dataDocument(ResourceObject);
		const MetaDocument = metaDocument(Schema.Struct({ page: Schema.Number }));
		const CreatedArticle = successResponse(201)(ResourceObject);

		expect(
			Schema.decodeUnknownSync(ArticleDocument)({
				data: { type: "articles", id: "1" },
			}),
		).toEqual({
			data: { type: "articles", id: "1" },
		});
		expect(Schema.decodeUnknownSync(MetaDocument)({ meta: { page: 1 } })).toEqual({
			meta: { page: 1 },
		});
		expect(Schema.resolveAnnotations(CreatedArticle)?.httpApiStatus).toBe(201);
	});

	it("models error documents without duplicating app-specific error classes", () => {
		const schema = dataDocument(ResourceObject);
		const error = Schema.decodeUnknownSync(ErrorObject)({
			status: "404",
			title: "Not Found",
		});

		expect(schema.ast.annotations?.httpApiStatus).toBeUndefined();
		expect(error).toEqual({ status: "404", title: "Not Found" });
	});

	it("provides request document schemas for resource and relationship writes", () => {
		expect(
			Schema.decodeUnknownSync(CreateResourceDocument)({
				data: {
					type: "articles",
					attributes: { title: "JSON:API paints my bikeshed!" },
				},
			}),
		).toEqual({
			data: {
				type: "articles",
				attributes: { title: "JSON:API paints my bikeshed!" },
			},
		});
		expect(() =>
			Schema.decodeUnknownSync(CreateResourceDocument)({
				data: {
					type: "articles",
					id: "1",
				},
			}),
		).toThrow();
		expect(
			Schema.decodeUnknownSync(ToOneRelationshipDocument)({
				data: { type: "people", id: "9" },
			}),
		).toEqual({
			data: { type: "people", id: "9" },
		});
		expect(
			Schema.decodeUnknownSync(ToManyRelationshipDocument)({
				data: [{ type: "comments", id: "5" }],
			}),
		).toEqual({
			data: [{ type: "comments", id: "5" }],
		});
	});
});
