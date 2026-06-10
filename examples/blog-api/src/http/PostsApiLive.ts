import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Document, JsonApiError, Page, type Query } from "effect-jsonapi";
import { BlogApi } from "./BlogApi.ts";
import { BlogData } from "../domain/BlogData.ts";
import type { Post } from "../domain/Post.ts";
import { postEntity, PostResource } from "./PostResource.ts";

const sortPosts = (
	posts: ReadonlyArray<Post>,
	sort: ReadonlyArray<Query.SortField>,
): ReadonlyArray<Post> =>
	sort.length === 0
		? posts
		: [...posts].sort((left, right) => {
				for (const { field, descending } of sort) {
					const compared = String(left[field as keyof Post] ?? "").localeCompare(
						String(right[field as keyof Post] ?? ""),
					);
					if (compared !== 0) {
						return descending ? -compared : compared;
					}
				}
				return 0;
			});

export const PostsApiLive = HttpApiBuilder.group(BlogApi, "posts", (handlers) =>
	handlers
		.handle("listPosts", ({ query, request }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const all = yield* data.listPosts;

				const sorted = sortPosts(all, query.sort);
				const { items, totalItems, totalPages } = Page.applyNumberSize(sorted, query.page);

				const entities = yield* Effect.forEach(items, (post) =>
					data.getUser(post.userId).pipe(Effect.map((author) => postEntity(post, author))),
				);

				return Document.fromCollection(PostResource, entities, {
					query,
					links: Page.numberSizeLinks({ url: request.url, page: query.page, totalPages }),
					meta: Page.numberSizeMeta({ page: query.page, totalItems }),
				});
			}),
		)
		.handle("getPost", ({ params, query }) =>
			Effect.gen(function* () {
				const data = yield* BlogData;
				const post = yield* data.getPost(params.id);
				if (post === undefined) {
					return yield* Effect.fail(
						JsonApiError.NotFound.of({ detail: `No post exists with id ${params.id}.` }),
					);
				}
				const author = yield* data.getUser(post.userId);
				return Document.fromResource(PostResource, postEntity(post, author), { query });
			}),
		),
);
