import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Document, JsonApiError, Page, type Query } from "effect-jsonapi";
import { BlogApi } from "./BlogApi.ts";
import { BlogData } from "../domain/BlogData.ts";
import type { User } from "../domain/User.ts";
import { userEntity, UserResource } from "./UserResource.ts";

const sortUsers = (
	users: ReadonlyArray<User>,
	sort: ReadonlyArray<Query.SortField>,
): ReadonlyArray<User> =>
	sort.length === 0
		? users
		: [...users].sort((left, right) => {
				for (const { field, descending } of sort) {
					const compared = String(left[field as keyof User] ?? "").localeCompare(
						String(right[field as keyof User] ?? ""),
					);
					if (compared !== 0) {
						return descending ? -compared : compared;
					}
				}
				return 0;
			});

export const UsersApiLive = HttpApiBuilder.group(BlogApi, "users", (handlers) =>
	handlers
		.handle("listUsers", ({ query, request }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const all = yield* data.listUsers;

				const role = query.filter["role"];
				const filtered = role === undefined ? all : all.filter((user) => user.role === role);
				const sorted = sortUsers(filtered, query.sort);
				const { items, totalItems, totalPages } = Page.applyNumberSize(sorted, query.page);

				const entities = yield* Effect.forEach(items, (user) =>
					data.postsByUser(user.id).pipe(Effect.map((posts) => userEntity(user, posts))),
				);

				return Document.fromCollection(UserResource, entities, {
					query,
					links: Page.numberSizeLinks({ url: request.url, page: query.page, totalPages }),
					meta: Page.numberSizeMeta({ page: query.page, totalItems }),
				});
			}),
		)
		.handle("getUser", ({ params, query }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const user = yield* data.getUser(params.id);
				if (user === undefined) {
					return yield* Effect.fail(
						JsonApiError.NotFound.of({ detail: `No user exists with id ${params.id}.` }),
					);
				}
				const posts = yield* data.postsByUser(user.id);
				return Document.fromResource(UserResource, userEntity(user, posts), { query });
			}),
		)
		.handle("createUser", ({ payload }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const user = yield* data.createUser(payload.data.attributes);
				return Document.fromResource(UserResource, userEntity(user));
			}),
		)
		.handle("updateUser", ({ params, payload }) =>
			Effect.gen(function* () {
				if (payload.data.id !== params.id) {
					return yield* Effect.fail(
						JsonApiError.Conflict.of({
							detail: `The document id ${payload.data.id} does not match the endpoint id ${params.id}.`,
							source: { pointer: "/data/id" },
						}),
					);
				}
				const data = yield* BlogData;
				const user = yield* data.updateUser(params.id, payload.data.attributes ?? {});
				if (user === undefined) {
					return yield* Effect.fail(
						JsonApiError.NotFound.of({ detail: `No user exists with id ${params.id}.` }),
					);
				}
				const posts = yield* data.postsByUser(user.id);
				return Document.fromResource(UserResource, userEntity(user, posts));
			}),
		)
		.handle("deleteUser", ({ params }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const deleted = yield* data.deleteUser(params.id);
				if (!deleted) {
					return yield* Effect.fail(
						JsonApiError.NotFound.of({ detail: `No user exists with id ${params.id}.` }),
					);
				}
			}),
		),
);
