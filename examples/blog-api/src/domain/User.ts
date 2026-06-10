import { Schema } from "effect";

/**
 * The blog's user domain model, as stored in the data layer.
 */
export class User extends Schema.Class<User>("User")({
	id: Schema.String,
	name: Schema.String,
	email: Schema.NullOr(Schema.String),
	role: Schema.Literals(["admin", "editor", "reader"]),
}) {}
