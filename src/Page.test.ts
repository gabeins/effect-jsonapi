import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import * as Page from "./Page.js";

describe("pagination strategies", () => {
	it("decodes number/size pages with defaults", () => {
		const strategy = Page.numberSize({ defaultSize: 10, maxSize: 50 });
		const decode = Schema.decodeUnknownSync(strategy.schema);
		expect(decode({})).toEqual({ number: 1, size: 10 });
		expect(decode({ number: "3", size: "25" })).toEqual({ number: 3, size: 25 });
		expect(() => decode({ number: "0" })).toThrow();
		expect(() => decode({ number: "1.5" })).toThrow();
		expect(() => decode({ size: "100" })).toThrow();
	});

	it("decodes offset/limit pages with defaults", () => {
		const strategy = Page.offsetLimit({ defaultLimit: 20 });
		const decode = Schema.decodeUnknownSync(strategy.schema);
		expect(decode({})).toEqual({ offset: 0, limit: 20 });
		expect(decode({ offset: "40", limit: "10" })).toEqual({ offset: 40, limit: 10 });
		expect(() => decode({ offset: "-1" })).toThrow();
	});

	it("decodes cursor pages", () => {
		const strategy = Page.cursor({ defaultSize: 15 });
		const decode = Schema.decodeUnknownSync(strategy.schema);
		expect(decode({})).toEqual({ size: 15 });
		expect(decode({ after: "abc", size: "5" })).toEqual({ after: "abc", size: 5 });
	});
});

describe("pagination links", () => {
	it("builds number/size links preserving other query parameters", () => {
		const links = Page.numberSizeLinks({
			url: "/users?include=posts&page[number]=2&page[size]=10",
			page: { number: 2, size: 10 },
			totalPages: 4,
		});
		expect(links.first).toBe("/users?include=posts&page%5Bnumber%5D=1&page%5Bsize%5D=10");
		expect(links.prev).toBe("/users?include=posts&page%5Bnumber%5D=1&page%5Bsize%5D=10");
		expect(links.next).toBe("/users?include=posts&page%5Bnumber%5D=3&page%5Bsize%5D=10");
		expect(links.last).toBe("/users?include=posts&page%5Bnumber%5D=4&page%5Bsize%5D=10");
	});

	it("omits prev on the first page and next on the last page", () => {
		const links = Page.numberSizeLinks({
			url: "/users",
			page: { number: 1, size: 10 },
			totalPages: 1,
		});
		expect(links.prev).toBeUndefined();
		expect(links.next).toBeUndefined();
		expect(links.first).toBeDefined();
		expect(links.last).toBeDefined();
	});

	it("supports hasMore when totals are unknown", () => {
		const links = Page.numberSizeLinks({
			url: "/users",
			page: { number: 2, size: 10 },
			hasMore: true,
		});
		expect(links.next).toBe("/users?page%5Bnumber%5D=3&page%5Bsize%5D=10");
		expect(links.last).toBeUndefined();
	});

	it("preserves absolute URLs", () => {
		const links = Page.numberSizeLinks({
			url: "https://api.example.com/users?sort=name",
			page: { number: 1, size: 10 },
		});
		expect(links.first).toBe(
			"https://api.example.com/users?sort=name&page%5Bnumber%5D=1&page%5Bsize%5D=10",
		);
	});

	it("builds offset/limit links", () => {
		const links = Page.offsetLimitLinks({
			url: "/users",
			page: { offset: 10, limit: 10 },
			totalItems: 45,
		});
		expect(links.first).toBe("/users?page%5Boffset%5D=0&page%5Blimit%5D=10");
		expect(links.prev).toBe("/users?page%5Boffset%5D=0&page%5Blimit%5D=10");
		expect(links.next).toBe("/users?page%5Boffset%5D=20&page%5Blimit%5D=10");
		expect(links.last).toBe("/users?page%5Boffset%5D=40&page%5Blimit%5D=10");
	});
});

describe("pagination helpers", () => {
	it("builds page meta", () => {
		expect(Page.numberSizeMeta({ page: { number: 2, size: 10 }, totalItems: 45 })).toEqual({
			page: { number: 2, size: 10, total: 45, pages: 5 },
		});
	});

	it("slices collections", () => {
		const result = Page.applyNumberSize([1, 2, 3, 4, 5], { number: 2, size: 2 });
		expect(result).toEqual({ items: [3, 4], totalItems: 5, totalPages: 3 });
	});
});
