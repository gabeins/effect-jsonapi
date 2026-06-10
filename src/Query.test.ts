import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import * as Page from "./Page.js";
import * as Query from "./Query.js";
import * as Relationship from "./Relationship.js";
import * as Resource from "./Resource.js";

const PostResource = Resource.make("posts", {
	attributes: { title: Schema.String },
	relationships: {
		author: Relationship.toOne((): Resource.Any => UserResource),
	},
});

const UserResource = Resource.make("users", {
	attributes: { name: Schema.String, email: Schema.NullOr(Schema.String) },
	relationships: {
		posts: Relationship.toMany(() => PostResource),
	},
});

describe("query parameter name classification", () => {
	it("classifies names", () => {
		expect(Query.classifyQueryParameterName("include")).toBe("standard");
		expect(Query.classifyQueryParameterName("fields[articles]")).toBe("standard");
		expect(Query.classifyQueryParameterName("page[number]")).toBe("standard");
		expect(Query.classifyQueryParameterName("include[author]")).toBe("invalid");
		expect(Query.classifyQueryParameterName("version:id")).toBe("extension");
		expect(Query.classifyQueryParameterName("page-size")).toBe("implementation");
		// Member names may contain internal spaces, so this is a (discouraged but
		// legal) implementation-specific name.
		expect(Query.classifyQueryParameterName("page size")).toBe("implementation");
		expect(Query.classifyQueryParameterName(" page")).toBe("invalid");
		expect(Query.classifyQueryParameterName("sort")).toBe("standard");
		expect(Query.classifyQueryParameterName("sort[author]")).toBe("invalid");
	});

	it("extracts base names and family membership", () => {
		expect(Query.queryParameterBaseName("fields[articles]")).toBe("fields");
		expect(Query.isQueryParameterFamilyMember("fields", "fields[articles][author]")).toBe(true);
		expect(Query.isQueryParameterFamilyMember("fields", "fields[ar+ticles]")).toBe(false);
		expect(Query.isQueryParameterFamilyMember("fields", "fields[articles")).toBe(false);
	});
});

describe("Query.schema", () => {
	const decode = (schema: Schema.Codec<unknown, Query.QueryEncoded>, input: Query.QueryEncoded) =>
		Schema.decodeUnknownSync(schema)(input);

	it("decodes an empty query to defaults", () => {
		const schema = Query.schema(UserResource);
		expect(decode(schema, {})).toEqual({
			include: [],
			fields: {},
			sort: [],
			page: undefined,
			filter: {},
		});
	});

	it("decodes and validates include paths against the relationship graph", () => {
		const schema = Query.schema(UserResource);
		expect(decode(schema, { include: "posts,posts.author" })).toMatchObject({
			include: ["posts", "posts.author"],
		});
		expect(decode(schema, { include: "" })).toMatchObject({ include: [] });
		expect(() => decode(schema, { include: "unknown" })).toThrow();
		expect(() => decode(schema, { include: "posts.unknown" })).toThrow();
	});

	it("limits include depth", () => {
		const schema = Query.schema(UserResource, { maxIncludeDepth: 1 });
		expect(decode(schema, { include: "posts" })).toMatchObject({ include: ["posts"] });
		expect(() => decode(schema, { include: "posts.author" })).toThrow();
	});

	it("rejects include when the resource has no relationships", () => {
		const Bare = Resource.make("bare", { attributes: { name: Schema.String } });
		const schema = Query.schema(Bare);
		expect(() => decode(schema, { include: "" })).toThrow();
	});

	it("decodes sparse fieldsets for reachable types", () => {
		const schema = Query.schema(UserResource);
		expect(
			decode(schema, { "fields[users]": "name,posts", "fields[posts]": "title" }),
		).toMatchObject({
			fields: { users: ["name", "posts"], posts: ["title"] },
		});
		expect(decode(schema, { "fields[users]": "" })).toMatchObject({ fields: { users: [] } });
		expect(() => decode(schema, { "fields[unknown]": "name" })).toThrow();
		expect(() => decode(schema, { "fields[users]": "nope" })).toThrow();
		expect(() => decode(schema, { "fields[users]": "id" })).toThrow();
	});

	it("decodes sort fields against the allow-list", () => {
		const schema = Query.schema(UserResource, { sort: ["name", "email"] });
		expect(decode(schema, { sort: "-name,email" })).toMatchObject({
			sort: [
				{ field: "name", descending: true },
				{ field: "email", descending: false },
			],
		});
		expect(() => decode(schema, { sort: "name,unknown" })).toThrow();
	});

	it("rejects sort when not configured", () => {
		const schema = Query.schema(UserResource);
		expect(() => decode(schema, { sort: "name" })).toThrow();
	});

	it("decodes page parameters with the configured strategy", () => {
		const schema = Query.schema(UserResource, {
			page: Page.numberSize({ defaultSize: 10, maxSize: 50 }),
		});
		expect(decode(schema, {})).toMatchObject({ page: { number: 1, size: 10 } });
		expect(decode(schema, { "page[number]": "3", "page[size]": "20" })).toMatchObject({
			page: { number: 3, size: 20 },
		});
		expect(() => decode(schema, { "page[number]": "0" })).toThrow();
		expect(() => decode(schema, { "page[size]": "100" })).toThrow();
		expect(() => decode(schema, { "page[cursor]": "abc" })).toThrow();
	});

	it("rejects page when not configured", () => {
		const schema = Query.schema(UserResource);
		expect(() => decode(schema, { "page[number]": "1" })).toThrow();
	});

	it("passes filter parameters through when enabled", () => {
		const schema = Query.schema(UserResource, { filter: true });
		expect(decode(schema, { "filter[name]": "Ada", "filter[posts][title]": "x" })).toMatchObject({
			filter: { "name": "Ada", "posts.title": "x" },
		});
	});

	it("rejects filter when not configured", () => {
		const schema = Query.schema(UserResource);
		expect(() => decode(schema, { "filter[name]": "Ada" })).toThrow();
	});

	it("rejects unknown and invalid query parameters", () => {
		const schema = Query.schema(UserResource);
		expect(() => decode(schema, { foo: "bar" })).toThrow();
		expect(() => decode(schema, { "include[author]": "x" })).toThrow();
		expect(() => decode(schema, { "page size": "x" })).toThrow();
	});

	it("rejects repeated parameters", () => {
		const schema = Query.schema(UserResource);
		expect(() => decode(schema, { include: ["posts", "posts"] })).toThrow();
	});

	it("encodes a decoded query back to wire parameters", () => {
		const schema = Query.schema(UserResource, {
			page: Page.numberSize({ defaultSize: 10 }),
			sort: ["name"],
			filter: true,
		});
		const decoded = decode(schema, {
			"include": "posts",
			"fields[users]": "name",
			"sort": "-name",
			"page[number]": "2",
			"filter[name]": "Ada",
		});
		expect(Schema.encodeUnknownSync(schema)(decoded)).toEqual({
			"include": "posts",
			"fields[users]": "name",
			"sort": "-name",
			"page[number]": "2",
			"page[size]": "10",
			"filter[name]": "Ada",
		});
	});
});
