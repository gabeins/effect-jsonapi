import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { Context } from "effect";
import { makeWebHandler } from "./app.ts";
import { BlogData, BlogDataService } from "./data.ts";

const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "127.0.0.1";
const { handler, dispose } = makeWebHandler();
const requestContext = Context.make(BlogData, BlogDataService);

const requestHeaders = (request: IncomingMessage) => {
	const headers = new Headers();
	for (const [name, value] of Object.entries(request.headers)) {
		if (value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(name, item);
			}
			continue;
		}
		headers.set(name, value);
	}
	return headers;
};

const toWebRequest = (request: IncomingMessage) => {
	const method = request.method ?? "GET";
	const headerHost = request.headers.host ?? `${host}:${port}`;
	const url = new URL(request.url ?? "/", `http://${headerHost}`);
	const hasBody = method !== "GET" && method !== "HEAD";

	return new Request(url, {
		method,
		headers: requestHeaders(request),
		...(hasBody
			? {
					body: Readable.toWeb(request) as ReadableStream<Uint8Array>,
					duplex: "half",
				}
			: {}),
	} as RequestInit & { readonly duplex?: "half" });
};

const writeResponse = async (response: Response, outgoing: ServerResponse) => {
	outgoing.statusCode = response.status;
	outgoing.statusMessage = response.statusText;
	response.headers.forEach((value, name) => {
		outgoing.setHeader(name, value);
	});
	outgoing.end(new Uint8Array(await response.arrayBuffer()));
};

const server = createServer((incoming, outgoing) => {
	void handler(toWebRequest(incoming), requestContext)
		.then((response) => writeResponse(response, outgoing))
		.catch((error: unknown) => {
			console.error(error);
			outgoing.statusCode = 500;
			outgoing.setHeader("content-type", "application/vnd.api+json");
			outgoing.end(
				JSON.stringify({
					errors: [
						{
							status: "500",
							title: "Internal Server Error",
						},
					],
				}),
			);
		});
});

server.listen(port, host, () => {
	console.log(`JSON:API blog example listening on http://${host}:${port}`);
});

const shutdown = () => {
	server.close(() => {
		void dispose().finally(() => {
			process.exit(0);
		});
	});
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
