import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { BlogApi } from "./api.ts";
import { BlogData } from "./data.ts";
import { errors, paginate, parsePostFieldset, postResource, userResource } from "./resources.ts";
import { PostFieldsetQueryName } from "./schemas.ts";

export const BlogApiHandlers = HttpApiBuilder.group(BlogApi, "blog", (handlers) =>
	handlers
		.handle("listUsers", ({ query }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const allUsers = yield* data.listUsers;
				const pagination: { number?: number; size?: number } = {};
				if (query["page[number]"] !== undefined) {
					pagination.number = query["page[number]"];
				}
				if (query["page[size]"] !== undefined) {
					pagination.size = query["page[size]"];
				}
				const page = paginate(allUsers, pagination);

				return {
					data: yield* Effect.forEach(page.items, (user) =>
						Effect.gen(function* () {
							const userPosts = yield* data.postsByUser(user.id);
							return userResource(user, userPosts);
						}),
					),
					meta: page.meta,
				};
			}),
		)
		.handle("getUser", ({ params }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const user = yield* data.getUser(params.id);
				if (user === undefined) {
					return yield* Effect.fail(
						errors("404", "User not found", `No user exists with id ${params.id}.`),
					);
				}
				const userPosts = yield* data.postsByUser(user.id);

				return {
					data: userResource(user, userPosts),
				};
			}),
		)
		.handle("createUser", ({ payload }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const attributes = payload.data.attributes;
				if (attributes === undefined) {
					return yield* Effect.fail(
						errors("400", "Missing attributes", "A user create request requires attributes.", {
							pointer: "/data/attributes",
						}),
					);
				}
				const user = yield* data.createUser(attributes);

				return {
					data: userResource(user, []),
				};
			}),
		)
		.handle("deleteUser", ({ params }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const deleted = yield* data.deleteUser(params.id);
				if (!deleted) {
					return yield* Effect.fail(
						errors("404", "User not found", `No user exists with id ${params.id}.`),
					);
				}
				return undefined;
			}),
		)
		.handle("listPosts", ({ query }) =>
			Effect.gen(function* () {
				const fieldset = parsePostFieldset(query[PostFieldsetQueryName]);
				if (fieldset?._tag === "InvalidFieldset") {
					return yield* Effect.fail(
						errors("400", "Invalid sparse fieldset", `Unsupported post field: ${fieldset.field}.`, {
							parameter: PostFieldsetQueryName,
						}),
					);
				}
				const data = yield* BlogData;
				const allPosts = yield* data.listPosts;
				const pagination: { number?: number; size?: number } = {};
				if (query["page[number]"] !== undefined) {
					pagination.number = query["page[number]"];
				}
				if (query["page[size]"] !== undefined) {
					pagination.size = query["page[size]"];
				}
				const page = paginate(allPosts, pagination);

				return {
					data: page.items.map((post) =>
						postResource(post, fieldset?._tag === "ValidFieldset" ? fieldset.fields : undefined),
					),
					meta: page.meta,
				};
			}),
		)
		.handle("getPost", ({ params, query }) =>
			Effect.gen(function* () {
				const include = new Set((query.include ?? "").split(",").filter((value) => value !== ""));
				if (include.size > 0 && !include.has("user")) {
					return yield* Effect.fail(
						errors("400", "Invalid include", "Only the user relationship can be included.", {
							parameter: "include",
						}),
					);
				}

				const data = yield* BlogData;
				const post = yield* data.getPost(params.id);
				if (post === undefined) {
					return yield* Effect.fail(
						errors("404", "Post not found", `No post exists with id ${params.id}.`),
					);
				}
				const author = include.has("user") ? yield* data.getPostAuthor(post) : undefined;

				return {
					data: postResource(post),
					...(author === undefined
						? {}
						: {
								included: [userResource(author, [])],
							}),
				};
			}),
		),
);
