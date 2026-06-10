import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { JsonApiError, Page, Query } from "effect-jsonapi";
import { PostResource } from "./PostResource.ts";

/**
 * Query schema for `GET /posts`: pagination, sorting, sparse fieldsets, and
 * `include=author`.
 */
export const ListPostsQuery = Query.schema(PostResource, {
	page: Page.numberSize({ defaultSize: 2, maxSize: 10 }),
	sort: ["publishedAt", "title"],
});

/**
 * Query schema for `GET /posts/:id`: sparse fieldsets and `include=author`.
 */
export const GetPostQuery = Query.schema(PostResource);

export const PostsApi = HttpApiGroup.make("posts")
	.add(
		HttpApiEndpoint.get("listPosts", "/", {
			query: ListPostsQuery,
			success: PostResource.CollectionDocument,
		}).annotateMerge(
			OpenApi.annotations({
				summary: "List posts",
				description:
					"Lists posts with `page[number]`/`page[size]` pagination, `sort`, sparse fieldsets, and `include=author`.",
			}),
		),
		HttpApiEndpoint.get("getPost", "/:id", {
			params: { id: Schema.String },
			query: GetPostQuery,
			success: PostResource.Document,
			error: JsonApiError.NotFound,
		}).annotateMerge(
			OpenApi.annotations({
				summary: "Get a post",
				description: "Fetches a single post, optionally with `include=author`.",
			}),
		),
	)
	.prefix("/posts")
	.annotateMerge(OpenApi.annotations({ title: "Posts" }));
