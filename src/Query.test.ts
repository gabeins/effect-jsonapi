import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	QueryParameterName,
	classifyQueryParameterName,
	isQueryParameterFamilyMember,
	makeQueryFamilyName,
	makeSparseFieldsetQueryName,
	parseQueryParameters,
	validateQueryParameters,
} from "./Query.js";

describe("JSON:API query parameters", () => {
	it("classifies standard query parameters and families", () => {
		expect(classifyQueryParameterName("include")).toBe("standard");
		expect(classifyQueryParameterName("sort")).toBe("standard");
		expect(classifyQueryParameterName("fields[articles]")).toBe("standard");
		expect(classifyQueryParameterName("page[offset]")).toBe("standard");
		expect(classifyQueryParameterName("filter[author.status]")).toBe("standard");
		expect(classifyQueryParameterName("filter[_]")).toBe("invalid");
	});

	it("classifies extension and implementation-specific query parameters", () => {
		expect(classifyQueryParameterName("version:id")).toBe("extension");
		expect(classifyQueryParameterName("version:id[article.author]")).toBe("extension");
		expect(classifyQueryParameterName("pageLimit")).toBe("implementation");
		expect(classifyQueryParameterName("filterBy[author.status]")).toBe("implementation");
		expect(classifyQueryParameterName("unknown")).toBe("invalid");
	});

	it("validates query parameter names as schemas", () => {
		expect(Schema.decodeUnknownSync(QueryParameterName)("fields[articles]")).toBe(
			"fields[articles]",
		);
		expect(() => Schema.decodeUnknownSync(QueryParameterName)("filter[_]")).toThrow();
	});

	it("checks query parameter family segment rules", () => {
		expect(isQueryParameterFamilyMember("filter", "filter[author.status][]")).toBe(true);
		expect(isQueryParameterFamilyMember("filter", "filter[author..status]")).toBe(false);
	});

	it("builds query family and sparse fieldset names", () => {
		expect(makeSparseFieldsetQueryName("articles")).toBe("fields[articles]");
		expect(makeQueryFamilyName("filter", ["author.status", ""])).toBe("filter[author.status][]");
		expect(() => makeSparseFieldsetQueryName("_articles")).toThrow();
		expect(() => makeQueryFamilyName("filter", ["author..status"])).toThrow();
	});

	it("parses query strings with URLSearchParams semantics", () => {
		expect(parseQueryParameters("/articles?include=comments.author&page%5Blimit%5D=10")).toEqual([
			{ name: "include", value: "comments.author" },
			{ name: "page[limit]", value: "10" },
		]);
		expect(parseQueryParameters(new URLSearchParams("filterBy=home+team"))).toEqual([
			{ name: "filterBy", value: "home team" },
		]);
	});

	it("validates query parameters as JSON:API error objects", () => {
		expect(validateQueryParameters("/articles?include=author&page%5Blimit%5D=10")).toEqual({
			_tag: "ValidQueryParameters",
			parameters: [
				{ name: "include", value: "author" },
				{ name: "page[limit]", value: "10" },
			],
		});
		expect(validateQueryParameters("/articles?unknown=value")).toEqual({
			_tag: "InvalidQueryParameters",
			errors: [
				{
					status: "400",
					title: "Invalid query parameter",
					detail:
						"Query parameter names must be standard, extension-specific, or implementation-specific JSON:API names",
					source: { parameter: "unknown" },
				},
			],
		});
		expect(
			validateQueryParameters("/articles?include=author&page%5Blimit%5D=10", {
				allowedParameterNames: ["include"],
			}),
		).toEqual({
			_tag: "InvalidQueryParameters",
			errors: [
				{
					status: "400",
					title: "Invalid query parameter",
					detail: "Unsupported query parameter: page[limit]",
					source: { parameter: "page[limit]" },
				},
			],
		});
		expect(
			validateQueryParameters("/articles?include=author&page%5Blimit%5D=10", {
				allowedParameterNames: ["include"],
				allowedParameterFamilies: ["page"],
			})._tag,
		).toBe("ValidQueryParameters");
	});
});
