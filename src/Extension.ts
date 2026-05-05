import { Schema } from "effect";
import { AtMemberName, ExtensionMemberName } from "./MemberName.js";

/**
 * Schema for members defined by applied JSON:API extensions.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ExtensionMembers)({
 * 	"version:id": "42",
 * });
 * ```
 */
export const ExtensionMembers = Schema.Record(ExtensionMemberName, Schema.Json).annotate({
	identifier: "JsonApiExtensionMembers",
	description: "JSON:API members defined by an applied extension.",
});

/**
 * Schema for JSON:API @-members.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(AtMembers)({
 * 	"@context": "https://example.com/context",
 * });
 * ```
 */
export const AtMembers = Schema.Record(AtMemberName, Schema.Json).annotate({
	identifier: "JsonApiAtMembers",
	description: "JSON:API @-members.",
});

/**
 * Schema for extension members and @-members.
 *
 * @example
 * ```ts
 * Schema.decodeUnknownSync(ExtensionOrAtMembers)({
 * 	"@context": "https://example.com/context",
 * 	"version:id": "42",
 * });
 * ```
 */
export const ExtensionOrAtMembers = Schema.Record(
	Schema.Union([ExtensionMemberName, AtMemberName]),
	Schema.Json,
).annotate({
	identifier: "JsonApiExtensionOrAtMembers",
	description: "JSON:API extension members and @-members.",
});

/**
 * Schema for a JSON:API extension member or @-member name.
 */
export const ExtensionOrAtMemberName = Schema.Union([ExtensionMemberName, AtMemberName]).annotate({
	identifier: "JsonApiExtensionOrAtMemberName",
	description: "A JSON:API extension member or @-member name.",
});

/**
 * Adds JSON:API extension and @-member support to a struct schema.
 *
 * Known struct fields keep their original schema. Additional object members are
 * accepted only when they are legal extension or @-member names.
 *
 * @example
 * ```ts
 * const ResourceWithExtensions = extensibleObject(
 * 	Schema.Struct({ type: Schema.String }),
 * );
 *
 * Schema.decodeUnknownSync(ResourceWithExtensions)({
 * 	type: "articles",
 * 	"version:id": "42",
 * });
 * ```
 */
export const extensibleObject = <S extends Schema.Struct<Schema.Struct.Fields>>(schema: S) => {
	const knownKeys = new Set(Object.keys(schema.fields));
	return Schema.StructWithRest(schema, [Schema.Record(Schema.String, Schema.Json)]).check(
		Schema.makeFilter((value) => {
			for (const key of Object.keys(value)) {
				if (knownKeys.has(key)) {
					continue;
				}
				if (Schema.decodeUnknownOption(ExtensionOrAtMemberName)(key)._tag === "None") {
					return `Unexpected JSON:API member name: ${key}`;
				}
			}
			return undefined;
		}),
	);
};
