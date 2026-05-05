import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Link } from "./Link.js";
import {
	AttributesObject,
	RelationshipObject,
	ResourceIdentifierObject,
	ResourceObject,
	ResponseResourceObject,
	UpdateResourceObject,
	resourceIdentifier,
	resourceIdentityKey,
	resourceObject,
} from "./Resource.js";

describe("JSON:API resources", () => {
	it("validates resource identifier objects", () => {
		expect(Schema.decodeUnknownSync(ResourceIdentifierObject)({ type: "people", id: "9" })).toEqual(
			{
				type: "people",
				id: "9",
			},
		);
		expect(
			Schema.decodeUnknownSync(ResourceIdentifierObject)({ type: "people", lid: "local-1" }),
		).toEqual({
			type: "people",
			lid: "local-1",
		});
		expect(() => Schema.decodeUnknownSync(ResourceIdentifierObject)({ type: "people" })).toThrow();
	});

	it("validates relationship object minimum members", () => {
		expect(
			Schema.decodeUnknownSync(RelationshipObject)({
				data: { type: "people", id: "9" },
			}),
		).toEqual({
			data: { type: "people", id: "9" },
		});
		expect(() => Schema.decodeUnknownSync(RelationshipObject)({})).toThrow();
	});

	it("validates resource field namespaces", () => {
		const resource = {
			type: "articles",
			id: "1",
			attributes: {
				title: "JSON:API paints my bikeshed!",
			},
			relationships: {
				author: {
					data: { type: "people", id: "9" },
				},
			},
		};

		expect(Schema.decodeUnknownSync(ResourceObject)(resource)).toEqual(resource);
		expect(() =>
			Schema.decodeUnknownSync(ResourceObject)({
				type: "articles",
				id: "1",
				attributes: { author: "9" },
				relationships: {
					author: {
						data: { type: "people", id: "9" },
					},
				},
			}),
		).toThrow();
		expect(
			Schema.decodeUnknownSync(ResourceObject)({
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
	});

	it("provides stricter response and update resource schemas", () => {
		expect(Schema.decodeUnknownSync(ResponseResourceObject)({ type: "articles", id: "1" })).toEqual(
			{
				type: "articles",
				id: "1",
			},
		);
		expect(() =>
			Schema.decodeUnknownSync(ResponseResourceObject)({ type: "articles", lid: "local-1" }),
		).toThrow();
		expect(() => Schema.decodeUnknownSync(UpdateResourceObject)({ type: "articles" })).toThrow();
	});

	it("uses Effect JSON for attribute values", () => {
		expect(
			Schema.decodeUnknownSync(AttributesObject)({
				title: "Rails is Omakase",
				stats: { reads: 10, featured: true, tags: ["football"] },
			}),
		).toEqual({
			title: "Rails is Omakase",
			stats: { reads: 10, featured: true, tags: ["football"] },
		});
	});

	it("validates recursive link objects", () => {
		expect(
			Schema.decodeUnknownSync(Link)({
				href: "/articles",
				describedby: {
					href: "/openapi.json",
				},
			}),
		).toEqual({
			href: "/articles",
			describedby: {
				href: "/openapi.json",
			},
		});
	});

	it("provides typed resource helper schemas", () => {
		const ArticleIdentifier = resourceIdentifier("articles", Schema.String);
		const ArticleResource = resourceObject({
			type: "articles",
			id: Schema.String,
			attributes: Schema.Struct({
				title: Schema.String,
			}),
			relationships: Schema.Struct({
				author: RelationshipObject,
			}),
		});
		const ArticleResourceWithCollidingFields = resourceObject({
			type: "articles",
			id: Schema.String,
			attributes: Schema.Struct({
				title: Schema.String,
			}),
			relationships: Schema.Struct({
				title: RelationshipObject,
			}),
		});

		expect(Schema.decodeUnknownSync(ArticleIdentifier)({ type: "articles", id: "1" })).toEqual({
			type: "articles",
			id: "1",
		});
		expect(
			Schema.decodeUnknownSync(ArticleResource)({
				type: "articles",
				id: "1",
				attributes: { title: "JSON:API paints my bikeshed!" },
				relationships: { author: { data: { type: "people", id: "9" } } },
			}),
		).toEqual({
			type: "articles",
			id: "1",
			attributes: { title: "JSON:API paints my bikeshed!" },
			relationships: { author: { data: { type: "people", id: "9" } } },
		});
		expect(() =>
			Schema.decodeUnknownSync(ArticleResourceWithCollidingFields)({
				type: "articles",
				id: "1",
				attributes: { title: "JSON:API paints my bikeshed!" },
				relationships: {
					title: { data: { type: "translations", id: "en" } },
				},
			}),
		).toThrow();
	});

	it("builds stable resource identity keys", () => {
		expect(resourceIdentityKey({ type: "people", id: "9" })).toBe("people:id:9");
		expect(resourceIdentityKey({ type: "people", lid: "local-9" })).toBe("people:lid:local-9");
		expect(resourceIdentityKey({ type: "people" })).toBeUndefined();
	});
});
