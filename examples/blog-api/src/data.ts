import { Context, Effect, Layer } from "effect";

export type User = {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly role: "admin" | "editor" | "reader";
};

export type Post = {
	readonly id: string;
	readonly userId: string;
	readonly title: string;
	readonly summary: string;
	readonly body: string;
	readonly publishedAt: string;
};

const users: ReadonlyArray<User> = [
	{
		id: "1",
		name: "Ada Lovelace",
		email: "ada@example.test",
		role: "admin",
	},
	{
		id: "2",
		name: "Grace Hopper",
		email: "grace@example.test",
		role: "editor",
	},
	{
		id: "3",
		name: "Katherine Johnson",
		email: "katherine@example.test",
		role: "reader",
	},
];

const posts: ReadonlyArray<Post> = [
	{
		id: "101",
		userId: "1",
		title: "Effectful JSON:API resources",
		summary: "Modeling JSON:API documents with Effect Schema.",
		body: "The package exposes composable schemas for resource objects, request documents, and response documents.",
		publishedAt: "2026-01-10T12:00:00.000Z",
	},
	{
		id: "102",
		userId: "1",
		title: "Relationship linkage",
		summary: "Representing relationships with resource identifiers.",
		body: "Relationship linkage keeps compound documents explicit while preserving a stable resource identity.",
		publishedAt: "2026-01-13T09:30:00.000Z",
	},
	{
		id: "103",
		userId: "2",
		title: "Sparse fieldsets in practice",
		summary: "Returning only the requested resource fields.",
		body: "Sparse fieldsets are useful when clients need compact collection responses.",
		publishedAt: "2026-02-02T15:45:00.000Z",
	},
	{
		id: "104",
		userId: "2",
		title: "Validating request documents",
		summary: "Checking create-resource payloads before they reach handlers.",
		body: "Effect Schema keeps request validation close to the JSON:API document shape.",
		publishedAt: "2026-02-08T10:15:00.000Z",
	},
	{
		id: "105",
		userId: "3",
		title: "Error objects that clients can act on",
		summary: "Returning status, detail, and source information for failed requests.",
		body: "Structured error objects let clients present clear validation and lookup failures.",
		publishedAt: "2026-02-16T08:00:00.000Z",
	},
	{
		id: "106",
		userId: "1",
		title: "Compound documents without surprises",
		summary: "Including related resources only when a client asks for them.",
		body: "Explicit include parameters make compound documents predictable and cache friendly.",
		publishedAt: "2026-02-24T13:20:00.000Z",
	},
	{
		id: "107",
		userId: "3",
		title: "Pagination metadata",
		summary: "Helping clients understand page size, totals, and current position.",
		body: "Collection responses can carry page metadata alongside resource arrays.",
		publishedAt: "2026-03-03T11:05:00.000Z",
	},
	{
		id: "108",
		userId: "2",
		title: "Resource identifiers",
		summary: "Using stable type and id pairs throughout relationships.",
		body: "Resource identifiers are small, stable references that keep linkage consistent.",
		publishedAt: "2026-03-11T14:40:00.000Z",
	},
	{
		id: "109",
		userId: "1",
		title: "Schema-first response contracts",
		summary: "Describing JSON:API responses as reusable Effect schemas.",
		body: "A schema-first contract makes handlers straightforward and documents the API surface.",
		publishedAt: "2026-03-19T16:10:00.000Z",
	},
	{
		id: "110",
		userId: "3",
		title: "Designing small example APIs",
		summary: "Keeping examples focused while still showing realistic client flows.",
		body: "Examples should have enough data to exercise collection behavior without becoming noisy.",
		publishedAt: "2026-03-27T09:50:00.000Z",
	},
	{
		id: "111",
		userId: "2",
		title: "HTTP API groups",
		summary: "Organizing related endpoints behind a shared Effect HttpApi group.",
		body: "Groups keep endpoint definitions and handlers aligned around a domain boundary.",
		publishedAt: "2026-04-04T12:25:00.000Z",
	},
	{
		id: "112",
		userId: "1",
		title: "Client-driven collection views",
		summary: "Combining pagination and sparse fieldsets for lightweight indexes.",
		body: "Clients can request compact pages while preserving access to full detail endpoints.",
		publishedAt: "2026-04-12T07:35:00.000Z",
	},
];

export class BlogData extends Context.Service<
	BlogData,
	{
		readonly listUsers: Effect.Effect<ReadonlyArray<User>>;
		readonly getUser: (id: string) => Effect.Effect<User | undefined>;
		readonly createUser: (input: {
			readonly name: string;
			readonly email: string;
			readonly role?: "admin" | "editor" | "reader";
		}) => Effect.Effect<User>;
		readonly deleteUser: (id: string) => Effect.Effect<boolean>;
		readonly listPosts: Effect.Effect<ReadonlyArray<Post>>;
		readonly getPost: (id: string) => Effect.Effect<Post | undefined>;
		readonly postsByUser: (userId: string) => Effect.Effect<ReadonlyArray<Post>>;
		readonly getPostAuthor: (post: Post) => Effect.Effect<User | undefined>;
	}
>()("examples/blog-api/BlogData") {}

export const BlogDataService = {
	listUsers: Effect.succeed(users),
	getUser: (id) => Effect.succeed(users.find((user) => user.id === id)),
	createUser: (input) =>
		Effect.succeed({
			id: "4",
			name: input.name,
			email: input.email,
			role: input.role ?? "reader",
		}),
	deleteUser: (id) => Effect.succeed(users.some((user) => user.id === id)),
	listPosts: Effect.succeed(posts),
	getPost: (id) => Effect.succeed(posts.find((post) => post.id === id)),
	postsByUser: (userId) => Effect.succeed(posts.filter((post) => post.userId === userId)),
	getPostAuthor: (post) => Effect.succeed(users.find((user) => user.id === post.userId)),
} satisfies BlogData["Service"];

export const BlogDataLive = Layer.succeed(BlogData)(BlogDataService);
