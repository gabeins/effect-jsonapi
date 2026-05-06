# JSON:API Blog Example

This package shows a small Effect `HttpApi` application backed by static in-memory data.

It demonstrates:

- `GET /users` with `page[number]` and `page[size]` pagination.
- `GET /users/:id` with a `posts` relationship.
- `POST /users` with a JSON:API create-resource request document.
- `DELETE /users/:id` returning `204 No Content`.
- `GET /posts` with `page[number]`, `page[size]`, and `fields[posts]` query support.
- `GET /posts/:id?include=user` with an included author resource.

Run it locally:

```sh
pnpm --filter @effect-jsonapi/example-blog-api dev
```

The server listens on `http://127.0.0.1:3000` by default. Set `HOST` or `PORT` to use another address.
