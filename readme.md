# effect-jsonapi

[![npm version](https://img.shields.io/npm/v/effect-jsonapi.svg)](https://www.npmjs.com/package/effect-jsonapi)
[![ci](https://github.com/gabeins/effect-jsonapi/actions/workflows/ci.yml/badge.svg)](https://github.com/gabeins/effect-jsonapi/actions/workflows/ci.yml)

An Effect-native, type-safe implementation of the [JSON:API 1.1 specification](https://jsonapi.org/format/1.1/) for Effect's `HttpApi`.

Define each resource once; the library derives every request and response document schema, parses and validates JSON:API fetch queries, serializes your domain values into spec-compliant documents (compound documents, sparse fieldsets, pagination links), and enforces JSON:API content negotiation and error documents at the HTTP boundary.

## Install

```sh
pnpm add effect-jsonapi effect@beta
```

`effect` is a peer dependency. While Effect v4 (effect-smol) is in beta, each release of this package supports a verified range of beta versions (currently `>=4.0.0-beta.52 <4.0.0`) — check the [changelog](./CHANGELOG.md) for the range a given release pairs with. Newer betas may introduce breaking changes in Effect's unstable modules before they are verified here. Once v4 stabilizes, the peer range will widen to `^4.0.0`.

The package is ESM-only and requires Node.js 24 or later.

## Quick start

### 1. Define resources

```ts
import { Schema } from "effect";
import { Relationship, Resource } from "effect-jsonapi";

export const UserResource = Resource.make("users", {
	attributes: {
		name: Schema.String,
		email: Schema.NullOr(Schema.String),
	},
	relationships: {
		posts: Relationship.toMany(() => PostResource),
	},
});

export const PostResource = Resource.make("posts", {
	attributes: {
		title: Schema.String,
		body: Schema.String,
	},
	relationships: {
		// Annotate one side of a cycle to break type-level circularity.
		author: Relationship.toOne((): Resource.Any => UserResource, { nullable: false }),
	},
});
```

Every resource definition derives fully typed schemas:

| Schema               | Use                                                  |
| -------------------- | ---------------------------------------------------- |
| `Identifier`         | `{ type, id, meta? }` resource identifier objects    |
| `ResourceObject`     | response resource objects (sparse-fieldset tolerant) |
| `Document`           | `GET /users/:id` success schema                      |
| `CollectionDocument` | `GET /users` success schema                          |
| `NullableDocument`   | nullable to-one related-resource endpoints           |
| `CreateDocument`     | `POST` payload (rejects client-generated `id`)       |
| `UpdateDocument`     | `PATCH` payload (partial attributes)                 |

### 2. Declare endpoints

```ts
import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Document, JsonApiError, Middleware, Page, Query } from "effect-jsonapi";

const ListUsersQuery = Query.schema(UserResource, {
	page: Page.numberSize({ defaultSize: 10, maxSize: 100 }),
	sort: ["name", "email"],
	filter: true,
});

const UsersApiGroup = HttpApiGroup.make("users")
	.add(
		HttpApiEndpoint.get("listUsers", "/", {
			query: ListUsersQuery,
			success: UserResource.CollectionDocument,
		}),
		HttpApiEndpoint.get("getUser", "/:id", {
			params: { id: Schema.String },
			query: Query.schema(UserResource),
			success: UserResource.Document,
			error: JsonApiError.NotFound,
		}),
		HttpApiEndpoint.post("createUser", "/", {
			payload: UserResource.CreateDocument,
			success: Document.successResponse(201)(UserResource.Document),
		}),
	)
	.prefix("/users");

export class Api extends HttpApi.make("api")
	.add(UsersApiGroup)
	.middleware(Middleware.ContentNegotiation)
	.middleware(Middleware.SchemaErrors) {}
```

The query schema validates the entire query string: `include` paths against the relationship graph, `fields[TYPE]` names against each reachable resource, `sort` against an allow-list, and `page[...]` with the configured pagination strategy. Anything else fails decoding — and `Middleware.SchemaErrors` turns that into a `400` JSON:API errors document with `source.parameter`.

### 3. Build documents in handlers

```ts
import { Document, JsonApiError, Page } from "effect-jsonapi";
import { HttpApiBuilder } from "effect/unstable/httpapi";

const UsersApiHandlers = HttpApiBuilder.group(Api, "users", (handlers) =>
	handlers
		.handle("listUsers", ({ query, request }) =>
			Effect.gen(function* () {
				const users = yield* UsersRepo.page(query.page, query.sort, query.filter);
				return Document.fromCollection(
					UserResource,
					users.items.map((user) => ({
						id: user.id,
						attributes: user,
						relationships: { posts: user.postIds },
					})),
					{
						query,
						links: Page.numberSizeLinks({
							url: request.url,
							page: query.page,
							totalPages: users.totalPages,
						}),
						meta: Page.numberSizeMeta({ page: query.page, totalItems: users.totalItems }),
					},
				);
			}),
		)
		.handle("getUser", ({ params, query }) =>
			Effect.gen(function* () {
				const user = yield* UsersRepo.find(params.id);
				if (user === undefined) {
					return yield* Effect.fail(
						JsonApiError.NotFound.of({ detail: `No user exists with id ${params.id}.` }),
					);
				}
				return Document.fromResource(
					UserResource,
					{
						id: user.id,
						attributes: user,
						// Embedded entities become compound `included` resources when the
						// client requests their path via `include`.
						relationships: {
							posts: user.posts.map((post) => ({
								id: post.id,
								attributes: post,
							})),
						},
					},
					{ query },
				);
			}),
		),
);
```

`Document.fromResource` / `Document.fromCollection` apply sparse fieldsets from the decoded query, build the `included` member from embedded related entities along the requested `include` paths (deduplicated, full linkage by construction), and attach links and meta.

### 4. Provide the middleware

```ts
const ApiLayer = HttpApiBuilder.layer(Api).pipe(Layer.provide([UsersApiHandlers]));

const ServerLayer = HttpRouter.serve(ApiLayer).pipe(
	Layer.provide([
		Middleware.layer(), // content negotiation + schema-error mapping
		NodeHttpServer.layer(createServer, { port: 3000 }),
	]),
);
```

`Middleware.ContentNegotiation` rejects JSON:API media types with unsupported parameters (`415 Unsupported Media Type`) and unacceptable `Accept` headers (`406 Not Acceptable`). `Middleware.SchemaErrors` maps every request decoding failure to a `400` JSON:API errors document with `source.parameter` / `source.pointer` / `source.header`.

## Errors

`JsonApiError` ships per-status error classes (`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `NotAcceptable`, `Conflict`, `UnsupportedMediaType`, `UnprocessableContent`, `InternalServerError`). Declaring one as an endpoint error encodes failures as a JSON:API errors document with the `application/vnd.api+json` content type and the matching status:

```ts
Effect.fail(
	JsonApiError.UnprocessableContent.of({
		detail: "Title must not be empty.",
		source: { pointer: "/data/attributes/title" },
	}),
);
```

## Modules

| Module         | Contents                                                                          |
| -------------- | --------------------------------------------------------------------------------- |
| `Resource`     | resource definitions and derived document schemas                                 |
| `Relationship` | `toOne` / `toMany` relationship definitions                                       |
| `Document`     | document builders, top-level document wire schemas, full-linkage validation       |
| `Query`        | typed fetch-query schemas, query parameter name classification                    |
| `Page`         | pagination strategies (`numberSize`, `offsetLimit`, `cursor`), link/meta builders |
| `JsonApiError` | error objects, errors documents, per-status error classes                         |
| `Middleware`   | content negotiation and schema-error HttpApi middleware                           |
| `MediaType`    | JSON:API media type parsing, validation, and `Accept` negotiation                 |
| `MemberName`   | member/field name and path predicates and schemas                                 |
| `Link`         | links, link objects, pagination links                                             |
| `Meta`         | meta object schema                                                                |
| `Extension`    | extension members, @-members, extensible object schemas                           |
| `Uri`          | URI and URI-reference schemas                                                     |

## Examples

| Example    | Description                                                                                   |                                         |
| ---------- | --------------------------------------------------------------------------------------------- | --------------------------------------- |
| `blog-api` | A complete `HttpApi` JSON:API with pagination, sorting, filtering, includes, sparse fieldsets | [README](./examples/blog-api/readme.md) |

## License

[MIT](./license)
