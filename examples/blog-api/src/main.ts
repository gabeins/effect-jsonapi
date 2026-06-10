import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { Middleware } from "effect-jsonapi";
import { createServer } from "node:http";
import { BlogApi } from "./http/BlogApi.ts";
import { BlogDataLive } from "./domain/BlogData.ts";
import { PostsApiLive } from "./http/PostsApiLive.ts";
import { UsersApiLive } from "./http/UsersApiLive.ts";

const ApiRoutes = HttpApiBuilder.layer(BlogApi, {
	openapiPath: "/openapi.json",
}).pipe(Layer.provide([UsersApiLive, PostsApiLive]));

const DocsRoute = HttpApiScalar.layerCdn(BlogApi, {
	path: "/docs",
});

const AllRoutes = Layer.mergeAll(ApiRoutes, DocsRoute);

export const HttpServerLayer = HttpRouter.serve(AllRoutes).pipe(
	Layer.provide([
		BlogDataLive,
		Middleware.layer(),
		NodeHttpServer.layer(createServer, { port: 3000 }),
	]),
);

Layer.launch(HttpServerLayer).pipe(NodeRuntime.runMain);
