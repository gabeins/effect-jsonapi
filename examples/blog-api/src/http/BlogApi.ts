import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { Middleware } from "effect-jsonapi";
import { PostsApi } from "./PostsApi.ts";
import { UsersApi } from "./UsersApi.ts";

export class BlogApi extends HttpApi.make("blog")
	.add(UsersApi)
	.add(PostsApi)
	.middleware(Middleware.ContentNegotiation)
	.middleware(Middleware.SchemaErrors)
	.annotateMerge(
		OpenApi.annotations({
			title: "Blog API",
			description: "An example JSON:API built with effect-jsonapi.",
		}),
	) {}
