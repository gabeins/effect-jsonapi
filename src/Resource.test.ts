import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import * as Relationship from "./Relationship.js";
import * as Resource from "./Resource.js";

const PostResource = Resource.make("posts", {
	attributes: {
		title: Schema.String,
		body: Schema.String,
	},
	relationships: {
		author: Relationship.toOne((): Resource.Any => UserResource, { nullable: false }),
	},
});

const UserResource = Resource.make("users", {
	attributes: {
		name: Schema.String,
		email: Schema.NullOr(Schema.String),
	},
	relationships: {
		posts: Relationship.toMany(() => PostResource),
	},
});

describe("Resource.make", () => {
	it("validates definition-time member names", () => {
		expect(() => Resource.make(" bad", { attributes: { a: Schema.String } })).toThrow();
		expect(() => Resource.make("ok", { attributes: { type: Schema.String } })).toThrow();
		expect(() => Resource.make("ok", { attributes: { id: Schema.String } })).toThrow();
		expect(() =>
			Resource.make("ok", {
				attributes: { author: Schema.String },
				relationships: { author: Relationship.toOne(() => UserResource) },
			}),
		).toThrow();
	});

	it("accepts an attributes struct or attribute fields", () => {
		const fromFields = Resource.make("a", { attributes: { name: Schema.String } });
		const fromStruct = Resource.make("b", {
			attributes: Schema.Struct({ name: Schema.String }),
		});
		expect(Object.keys(fromFields.attributes.fields)).toEqual(["name"]);
		expect(Object.keys(fromStruct.attributes.fields)).toEqual(["name"]);
	});

	it("derives identifier schemas", () => {
		expect(Schema.decodeUnknownSync(UserResource.Identifier)({ type: "users", id: "1" })).toEqual({
			type: "users",
			id: "1",
		});
		expect(() =>
			Schema.decodeUnknownSync(UserResource.Identifier)({ type: "posts", id: "1" }),
		).toThrow();
	});

	it("derives resource object schemas with optional attributes for sparse fieldsets", () => {
		const full = {
			type: "users",
			id: "1",
			attributes: { name: "Ada", email: null },
			relationships: {
				posts: { data: [{ type: "posts", id: "10" }] },
			},
		};
		expect(Schema.decodeUnknownSync(UserResource.ResourceObject)(full)).toEqual(full);

		const sparse = { type: "users", id: "1", attributes: { name: "Ada" } };
		expect(Schema.decodeUnknownSync(UserResource.ResourceObject)(sparse)).toEqual(sparse);

		expect(() =>
			Schema.decodeUnknownSync(UserResource.ResourceObject)({
				type: "users",
				id: "1",
				attributes: { name: 42 },
			}),
		).toThrow();
	});

	it("validates relationship linkage against the target resource", () => {
		expect(() =>
			Schema.decodeUnknownSync(UserResource.ResourceObject)({
				type: "users",
				id: "1",
				relationships: { posts: { data: [{ type: "users", id: "2" }] } },
			}),
		).toThrow();

		// Non-nullable to-one linkage rejects null.
		expect(() =>
			Schema.decodeUnknownSync(PostResource.ResourceObject)({
				type: "posts",
				id: "10",
				relationships: { author: { data: null } },
			}),
		).toThrow();
	});

	it("derives document schemas", () => {
		const document = {
			data: {
				type: "posts",
				id: "10",
				attributes: { title: "Hello", body: "World" },
				relationships: { author: { data: { type: "users", id: "1" } } },
			},
			included: [
				{
					type: "users",
					id: "1",
					attributes: { name: "Ada", email: null },
				},
			],
		};
		expect(Schema.decodeUnknownSync(PostResource.Document)(document)).toEqual(document);

		const collection = { data: [document.data], links: { self: "/posts" } };
		expect(Schema.decodeUnknownSync(PostResource.CollectionDocument)(collection)).toEqual(
			collection,
		);

		expect(Schema.decodeUnknownSync(PostResource.NullableDocument)({ data: null })).toEqual({
			data: null,
		});
	});

	it("derives create document schemas that reject client-generated ids", () => {
		const create = {
			data: {
				type: "posts",
				lid: "tmp-1",
				attributes: { title: "Hello", body: "World" },
				relationships: { author: { data: { type: "users", id: "1" } } },
			},
		};
		expect(Schema.decodeUnknownSync(PostResource.CreateDocument)(create)).toEqual(create);

		expect(() =>
			Schema.decodeUnknownSync(PostResource.CreateDocument)({
				data: { type: "posts", id: "10", attributes: { title: "a", body: "b" } },
			}),
		).toThrow();

		expect(() =>
			Schema.decodeUnknownSync(PostResource.CreateDocument)({
				data: { type: "posts", attributes: { title: "a" } },
			}),
		).toThrow();
	});

	it("derives update document schemas with partial attributes", () => {
		const update = {
			data: {
				type: "posts",
				id: "10",
				attributes: { title: "Renamed" },
			},
		};
		expect(Schema.decodeUnknownSync(PostResource.UpdateDocument)(update)).toEqual(update);

		expect(() =>
			Schema.decodeUnknownSync(PostResource.UpdateDocument)({
				data: { type: "posts", attributes: { title: "Renamed" } },
			}),
		).toThrow();
	});

	it("derives relationship request document schemas", () => {
		const toOne = Resource.toOneRelationshipDocument(UserResource);
		expect(Schema.decodeUnknownSync(toOne)({ data: { type: "users", id: "1" } })).toEqual({
			data: { type: "users", id: "1" },
		});
		expect(Schema.decodeUnknownSync(toOne)({ data: null })).toEqual({ data: null });

		const toMany = Resource.toManyRelationshipDocument(PostResource);
		expect(Schema.decodeUnknownSync(toMany)({ data: [{ type: "posts", id: "10" }] })).toEqual({
			data: [{ type: "posts", id: "10" }],
		});
		expect(() => Schema.decodeUnknownSync(toMany)({ data: null })).toThrow();
	});
});
