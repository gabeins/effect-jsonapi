import { Schema, Struct } from "effect";
import { Relationship, Resource } from "effect-jsonapi";
import type { Post } from "../domain/Post.ts";
import { postEntity, PostResource } from "./PostResource.ts";
import { User } from "../domain/User.ts";

/**
 * The JSON:API resource definition for users.
 *
 * The attributes are the user model without its `id`, which JSON:API carries
 * as the resource object's `id` member.
 */
export const UserResource = Resource.make("users", {
	attributes: Schema.Struct(User.fields).mapFields(Struct.omit(["id"])),
	relationships: {
		posts: Relationship.toMany(() => PostResource),
	},
});

/**
 * Maps a user model (and its posts) to a serialization entity.
 *
 * The posts are embedded as full entities, so they are available for compound
 * documents when a client requests `include=posts`. When the posts are not
 * provided the relationship member is omitted instead of asserting an empty
 * to-many relationship.
 */
export const userEntity = (
	user: User,
	posts?: ReadonlyArray<Post>,
): Resource.Entity<typeof UserResource> => ({
	id: user.id,
	attributes: user,
	...(posts === undefined
		? {}
		: {
				relationships: {
					posts: posts.map((post) => postEntity(post)),
				},
			}),
	links: { self: `/users/${user.id}` },
});
