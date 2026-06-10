import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";
import { NotAcceptable, UnsupportedMediaType } from "./JsonApiError.js";
import * as Middleware from "./Middleware.js";
import * as Query from "./Query.js";
import * as Resource from "./Resource.js";

const fakeRequest = (headers: Record<string, string>) =>
	({ headers }) as unknown as HttpServerRequest.HttpServerRequest;

const okResponse = HttpServerResponse.empty();

const fakeMetadata = {} as never;

const runNegotiation = (headers: Record<string, string>) =>
	Effect.gen(function* () {
		const context = yield* Layer.build(Middleware.contentNegotiation());
		const middleware = Context.get(context, Middleware.ContentNegotiation);
		return yield* middleware(Effect.succeed(okResponse), fakeMetadata).pipe(
			Effect.provideService(HttpServerRequest.HttpServerRequest, fakeRequest(headers)),
		);
	});

describe("content negotiation middleware", () => {
	it.effect("passes requests without negotiation headers through", () =>
		Effect.gen(function* () {
			const response = yield* runNegotiation({});
			expect(response.status).toBe(204);
		}),
	);

	it.effect("passes valid JSON:API content types and accept headers", () =>
		Effect.gen(function* () {
			const response = yield* runNegotiation({
				"content-type": "application/vnd.api+json",
				"accept": "application/vnd.api+json",
			});
			expect(response.status).toBe(204);
		}),
	);

	it.effect("ignores non-JSON:API content types", () =>
		Effect.gen(function* () {
			// Payload media type mismatches are reported by payload decoding, not by
			// JSON:API content negotiation.
			const response = yield* runNegotiation({ "content-type": "application/json" });
			expect(response.status).toBe(204);
		}),
	);

	it.effect("rejects JSON:API content types with unknown parameters", () =>
		Effect.gen(function* () {
			const error = yield* runNegotiation({
				"content-type": "application/vnd.api+json;charset=utf-8",
			}).pipe(Effect.flip);
			expect(error).toBeInstanceOf(UnsupportedMediaType);
			expect((error as UnsupportedMediaType).errors[0]).toMatchObject({
				status: "415",
				source: { header: "content-type" },
			});
		}),
	);

	it.effect("rejects unsupported extensions in the content type", () =>
		Effect.gen(function* () {
			const error = yield* runNegotiation({
				"content-type": 'application/vnd.api+json;ext="https://example.com/ext/unknown"',
			}).pipe(Effect.flip);
			expect(error).toBeInstanceOf(UnsupportedMediaType);
		}),
	);

	it.effect("rejects accept headers with only unsupported JSON:API parameters", () =>
		Effect.gen(function* () {
			const error = yield* runNegotiation({
				accept: "application/vnd.api+json;charset=utf-8",
			}).pipe(Effect.flip);
			expect(error).toBeInstanceOf(NotAcceptable);
			expect((error as NotAcceptable).errors[0]).toMatchObject({
				status: "406",
				source: { header: "accept" },
			});
		}),
	);

	it.effect("accepts mixed accept headers with a supported JSON:API media range", () =>
		Effect.gen(function* () {
			const response = yield* runNegotiation({
				accept: "application/vnd.api+json;charset=utf-8, application/vnd.api+json",
			});
			expect(response.status).toBe(204);
		}),
	);
});

describe("schema error mapping", () => {
	const UserResource = Resource.make("users", {
		attributes: { name: Schema.String },
	});

	it.effect("maps query decoding failures to source.parameter", () =>
		Effect.gen(function* () {
			const schemaError = yield* Schema.decodeUnknownEffect(Query.schema(UserResource))({
				"fields[users]": "nope",
			}).pipe(Effect.flip);
			const apiError = new HttpApiError.HttpApiSchemaError({
				kind: "Query",
				cause: schemaError,
			});
			const errors = Middleware.errorObjectsFromSchemaError(apiError);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toMatchObject({
				status: "400",
				title: "Bad Request",
				source: { parameter: "fields[users]" },
			});
		}),
	);

	it.effect("maps payload decoding failures to source.pointer", () =>
		Effect.gen(function* () {
			const schemaError = yield* Schema.decodeUnknownEffect(UserResource.CreateDocument)({
				data: { type: "users", attributes: {} },
			}).pipe(Effect.flip);
			const apiError = new HttpApiError.HttpApiSchemaError({
				kind: "Payload",
				cause: schemaError,
			});
			const errors = Middleware.errorObjectsFromSchemaError(apiError);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]?.source).toEqual({ pointer: "/data/attributes/name" });
		}),
	);
});
