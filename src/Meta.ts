import { Schema } from "effect";
import { ObjectMemberName } from "./MemberName.js";

/**
 * Schema for a JSON:API meta object.
 *
 * Meta objects contain non-standard information and may use regular,
 * extension, or @-member names.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(MetaObject)({
 * 	total: 12,
 * 	"version:id": "42",
 * });
 * ```
 */
export const MetaObject = Schema.Record(ObjectMemberName, Schema.Json).annotate({
	identifier: "JsonApiMetaObject",
	description: "A JSON:API meta object containing non-standard meta-information.",
});

/**
 * Type of a JSON:API meta object decoded by {@link MetaObject}.
 */
export type MetaObject = typeof MetaObject.Type;
