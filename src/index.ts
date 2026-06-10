/**
 * An Effect-native implementation of the JSON:API 1.1 specification.
 *
 * Define resources once with `Resource.make`, derive request/response document
 * schemas for Effect `HttpApi` endpoints, parse JSON:API fetch queries with
 * `Query.schema`, build spec-compliant documents with `Document.fromResource`
 * and `Document.fromCollection`, and enforce content negotiation with the
 * `Middleware` module.
 */
export * as Document from "./Document.js";
export * as Extension from "./Extension.js";
export * as JsonApiError from "./JsonApiError.js";
export * as Link from "./Link.js";
export * as MediaType from "./MediaType.js";
export * as MemberName from "./MemberName.js";
export * as Meta from "./Meta.js";
export * as Middleware from "./Middleware.js";
export * as Page from "./Page.js";
export * as Query from "./Query.js";
export * as Relationship from "./Relationship.js";
export * as Resource from "./Resource.js";
export * as Uri from "./Uri.js";
