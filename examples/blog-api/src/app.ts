import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { BlogApi } from "./api.ts";
import { BlogDataLive } from "./data.ts";
import { BlogApiHandlers } from "./handlers.ts";

export const BlogApp = HttpApiBuilder.layer(BlogApi, {
	openapiPath: "/openapi.json",
}).pipe(
	Layer.provide(BlogApiHandlers),
	Layer.provide(BlogDataLive),
	Layer.provide(HttpServer.layerServices),
);

export const makeWebHandler = () =>
	HttpRouter.toWebHandler(BlogApp, {
		disableLogger: true,
	});
