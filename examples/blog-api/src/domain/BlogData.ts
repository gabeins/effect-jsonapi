import { Context, Effect, Layer, Ref } from "effect";
import { Post } from "./Post.ts";
import { User } from "./User.ts";

interface BlogDataRepository {
	readonly listUsers: Effect.Effect<ReadonlyArray<User>>;
	readonly getUser: (id: string) => Effect.Effect<User | undefined>;
	readonly createUser: (input: Omit<User, "id">) => Effect.Effect<User>;
	readonly updateUser: (
		id: string,
		input: Partial<Omit<User, "id">>,
	) => Effect.Effect<User | undefined>;
	readonly deleteUser: (id: string) => Effect.Effect<boolean>;
	readonly listPosts: Effect.Effect<ReadonlyArray<Post>>;
	readonly getPost: (id: string) => Effect.Effect<Post | undefined>;
	readonly postsByUser: (userId: string) => Effect.Effect<ReadonlyArray<Post>>;
}

/**
 * The blog's in-memory data service.
 */
export class BlogData extends Context.Service<BlogData, BlogDataRepository>()(
	"blog-api/BlogData",
) {}

const seedUsers: ReadonlyArray<User> = [
	new User({ id: "1", name: "Ada Lovelace", email: "ada@example.test", role: "admin" }),
	new User({ id: "2", name: "Grace Hopper", email: "grace@example.test", role: "editor" }),
	new User({ id: "3", name: "Katherine Johnson", email: null, role: "reader" }),
];

const seedPosts: ReadonlyArray<Post> = [
	new Post({
		id: "10",
		userId: "1",
		title: "Notes on the Analytical Engine",
		summary: "On computing numbers beyond arithmetic.",
		body: "The Analytical Engine weaves algebraic patterns…",
		publishedAt: "1843-09-01T00:00:00Z",
	}),
	new Post({
		id: "11",
		userId: "1",
		title: "Sketch of a program",
		summary: "The first published algorithm.",
		body: "Diagram for the computation of Bernoulli numbers…",
		publishedAt: "1843-10-18T00:00:00Z",
	}),
	new Post({
		id: "12",
		userId: "2",
		title: "Compilers, explained",
		summary: "Why programming should be closer to English.",
		body: "It's much easier for most people to write an English statement…",
		publishedAt: "1952-05-02T00:00:00Z",
	}),
];

export const BlogDataLive = Layer.effect(
	BlogData,
	Effect.gen(function* () {
		const users = yield* Ref.make(seedUsers);
		const posts = yield* Ref.make(seedPosts);
		const nextId = yield* Ref.make(100);

		return BlogData.of({
			listUsers: Ref.get(users),
			getUser: (id) => Ref.get(users).pipe(Effect.map((all) => all.find((user) => user.id === id))),
			createUser: (input) =>
				Effect.gen(function* () {
					const id = yield* Ref.getAndUpdate(nextId, (current) => current + 1);
					const user = new User({ ...input, id: `${id}` });
					yield* Ref.update(users, (all) => [...all, user]);
					return user;
				}),
			updateUser: (id, input) =>
				Effect.gen(function* () {
					const existing = (yield* Ref.get(users)).find((user) => user.id === id);
					if (existing === undefined) {
						return undefined;
					}
					const updated = new User({
						id: existing.id,
						name: input.name ?? existing.name,
						email: input.email !== undefined ? input.email : existing.email,
						role: input.role ?? existing.role,
					});
					yield* Ref.update(users, (all) => all.map((user) => (user.id === id ? updated : user)));
					return updated;
				}),
			deleteUser: (id) =>
				Effect.gen(function* () {
					const existing = (yield* Ref.get(users)).some((user) => user.id === id);
					if (existing) {
						yield* Ref.update(users, (all) => all.filter((user) => user.id !== id));
						yield* Ref.update(posts, (all) => all.filter((post) => post.userId !== id));
					}
					return existing;
				}),
			listPosts: Ref.get(posts),
			getPost: (id) => Ref.get(posts).pipe(Effect.map((all) => all.find((post) => post.id === id))),
			postsByUser: (userId) =>
				Ref.get(posts).pipe(Effect.map((all) => all.filter((post) => post.userId === userId))),
		});
	}),
);
