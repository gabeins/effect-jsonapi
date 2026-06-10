import { Schema } from "effect";
import { User } from "./User.ts";

/**
 * The blog's post domain model, as stored in the data layer.
 */
export class Post extends Schema.Class<Post>("Post")({
	id: Schema.String,
	userId: User.fields.id,
	title: Schema.String,
	summary: Schema.String,
	body: Schema.String,
	publishedAt: Schema.String,
}) {}
