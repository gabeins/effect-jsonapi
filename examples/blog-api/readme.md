# JSON:API Blog Example

A small Effect `HttpApi` application serving a spec-compliant JSON:API from in-memory data, built with `effect-jsonapi`.

It demonstrates:

- Resource definitions with `Resource.make` and a mutual `users` ↔ `posts` relationship (`Relationship.toMany` / `Relationship.toOne`).
- `GET /users` with `page[number]`/`page[size]` pagination (including `first`/`prev`/`next`/`last` links and page meta), `sort`, `filter[role]`, sparse fieldsets, and `include=posts` compound documents.
- `GET /users/:id` and `GET /posts/:id?include=author` with full-linkage `included` resources.
- `POST /users` decoding a JSON:API create-resource document (client-generated ids rejected with `400`).
- `PATCH /users/:id` with partial attributes and a `409 Conflict` on id mismatch.
- `DELETE /users/:id` returning `204 No Content`.
- JSON:API error documents for every failure, including request decoding failures with `source.parameter` / `source.pointer` (via `Middleware.SchemaErrors`).
- Content negotiation: `415 Unsupported Media Type` and `406 Not Acceptable` per the spec (via `Middleware.ContentNegotiation`).
- OpenAPI generation at `/openapi.json` and Scalar docs at `/docs`.

## Layout

- `src/domain/` — the blog's domain: `User` and `Post` models and the in-memory `BlogData` service.
- `src/http/` — the JSON:API layer: resource definitions (`UserResource`, `PostResource`), endpoint groups with query schemas (`UsersApi`, `PostsApi`), their handler layers (`UsersApiLive`, `PostsApiLive`), and the `BlogApi` definition with the JSON:API middleware applied.
- `src/main.ts` — server wiring: routes, docs, data, middleware, and the Node HTTP server.

## Running

Run it locally:

```sh
pnpm --filter @effect-jsonapi/example-blog-api dev
```

The server listens on `http://localhost:3000`. Things to try:

```sh
curl "localhost:3000/users?sort=-name&page[size]=1&page[number]=2"
curl "localhost:3000/users?include=posts&fields[posts]=title"
curl "localhost:3000/users?filter[role]=editor"
curl "localhost:3000/posts/10?include=author"
curl "localhost:3000/users?include=enemies"        # 400 with source.parameter
curl -X POST "localhost:3000/users" \
  -H "content-type: application/vnd.api+json" \
  -d '{"data":{"type":"users","attributes":{"name":"Margaret Hamilton","email":null,"role":"editor"}}}'
```
