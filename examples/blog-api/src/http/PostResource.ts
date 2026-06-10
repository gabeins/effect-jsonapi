import { Schema, Struct } from "effect";
import { Relationship, Resource } from "effect-jsonapi";
import { Post } from "../domain/Post.ts";
import type { User } from "../domain/User.ts";
import { userEntity, UserResource } from "./UserResource.ts";

/**
 * The JSON:API resource definition for posts.
 *
 * The `author` relationship thunk is annotated with `Resource.Any` to break the
 * type-level circularity between mutually related resource definitions; the
 * users side keeps its fully inferred type.
 */
export const PostResource = Resource.make("posts", {
	attributes: Schema.Struct(Post.fields).mapFields(Struct.omit(["id", "userId"])),
	relationships: {
		author: Relationship.toOne((): Resource.Any => UserResource, { nullable: false }),
	},
});

/**
 * Maps a post model to a serialization entity.
 *
 * When the author model is provided it is embedded as a full entity, making it
 * available for compound documents when a client requests `include=author`;
 * otherwise only the linkage to the author is serialized.
 */
export const postEntity = (post: Post, author?: User): Resource.Entity<typeof PostResource> => ({
	id: post.id,
	attributes: post,
	relationships: {
		author: author === undefined ? post.userId : userEntity(author),
	},
	links: { self: `/posts/${post.id}` },
});
