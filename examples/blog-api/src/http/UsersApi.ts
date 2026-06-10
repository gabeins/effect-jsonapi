import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi";
import { Document, JsonApiError, Page, Query } from "effect-jsonapi";
import { UserResource } from "./UserResource.ts";

/**
 * Query schema for `GET /users`: pagination, sorting, sparse fieldsets,
 * `include=posts`, and a `filter[role]` passthrough.
 */
export const ListUsersQuery = Query.schema(UserResource, {
	page: Page.numberSize({ defaultSize: 2, maxSize: 10 }),
	sort: ["name", "email"],
	filter: true,
});

/**
 * Query schema for `GET /users/:id`: sparse fieldsets and `include=posts`.
 */
export const GetUserQuery = Query.schema(UserResource);

export const UsersApi = HttpApiGroup.make("users")
	.add(
		HttpApiEndpoint.get("listUsers", "/", {
			query: ListUsersQuery,
			success: UserResource.CollectionDocument,
		}).annotateMerge(
			OpenApi.annotations({
				summary: "List users",
				description:
					"Lists users with `page[number]`/`page[size]` pagination, `sort`, `filter[role]`, sparse fieldsets, and `include=posts`.",
			}),
		),
		HttpApiEndpoint.get("getUser", "/:id", {
			params: { id: Schema.String },
			query: GetUserQuery,
			success: UserResource.Document,
			error: JsonApiError.NotFound,
		}).annotateMerge(
			OpenApi.annotations({
				summary: "Get a user",
				description: "Fetches a single user, optionally with `include=posts`.",
			}),
		),
		HttpApiEndpoint.post("createUser", "/", {
			payload: UserResource.CreateDocument,
			success: Document.successResponse(201)(UserResource.Document),
		}).annotateMerge(
			OpenApi.annotations({
				summary: "Create a user",
				description: "Creates a user from a JSON:API create-resource document.",
			}),
		),
		HttpApiEndpoint.patch("updateUser", "/:id", {
			params: { id: Schema.String },
			payload: UserResource.UpdateDocument,
			success: UserResource.Document,
			error: [JsonApiError.NotFound, JsonApiError.Conflict],
		}).annotateMerge(
			OpenApi.annotations({
				summary: "Update a user",
				description:
					"Updates a user from a JSON:API update-resource document with partial attributes.",
			}),
		),
		HttpApiEndpoint.make("DELETE")("deleteUser", "/:id", {
			params: { id: Schema.String },
			success: HttpApiSchema.NoContent,
			error: JsonApiError.NotFound,
		}).annotateMerge(
			OpenApi.annotations({
				summary: "Delete a user",
				description: "Deletes a user and their posts, returning `204 No Content`.",
			}),
		),
	)
	.prefix("/users")
	.annotateMerge(OpenApi.annotations({ title: "Users" }));
