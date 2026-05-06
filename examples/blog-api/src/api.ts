import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import {
	BadRequestDocument,
	CreatedUserDocument,
	CreateUserDocument,
	NotFoundDocument,
	PaginationQuery,
	PostDetailQuery,
	PostDocument,
	PostId,
	PostIndexQuery,
	PostsDocument,
	UserDocument,
	UserId,
	UsersDocument,
} from "./schemas.ts";

export const BlogApi = HttpApi.make("BlogApi").add(
	HttpApiGroup.make("blog", { topLevel: true }).add(
		HttpApiEndpoint.get("listUsers", "/users", {
			query: PaginationQuery,
			success: UsersDocument,
			error: BadRequestDocument,
		}),
		HttpApiEndpoint.get("getUser", "/users/:id", {
			params: { id: UserId },
			success: UserDocument,
			error: NotFoundDocument,
		}),
		HttpApiEndpoint.post("createUser", "/users", {
			payload: CreateUserDocument,
			success: CreatedUserDocument,
			error: BadRequestDocument,
		}),
		HttpApiEndpoint.delete("deleteUser", "/users/:id", {
			params: { id: UserId },
			success: HttpApiSchema.NoContent,
			error: NotFoundDocument,
		}),
		HttpApiEndpoint.get("listPosts", "/posts", {
			query: PostIndexQuery,
			success: PostsDocument,
			error: BadRequestDocument,
		}),
		HttpApiEndpoint.get("getPost", "/posts/:id", {
			params: { id: PostId },
			query: PostDetailQuery,
			success: PostDocument,
			error: [BadRequestDocument, NotFoundDocument],
		}),
	),
);
