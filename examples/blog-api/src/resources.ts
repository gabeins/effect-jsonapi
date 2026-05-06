import type { Post, User } from "./data.ts";

export type PostField = "title" | "summary" | "body" | "publishedAt" | "user";

const allPostFields = new Set<PostField>(["title", "summary", "body", "publishedAt", "user"]);

export const paginate = <A>(
	items: ReadonlyArray<A>,
	options: { readonly number?: number; readonly size?: number },
) => {
	const pageNumber = Math.max(1, Math.floor(options.number ?? 1));
	const pageSize = Math.min(10, Math.max(1, Math.floor(options.size ?? 2)));
	const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
	const current = Math.min(pageNumber, pageCount);
	const start = (current - 1) * pageSize;

	return {
		items: items.slice(start, start + pageSize),
		meta: {
			page: {
				number: current,
				size: pageSize,
				total: items.length,
				count: pageCount,
			},
		},
	};
};

export const userResource = (user: User, userPosts: ReadonlyArray<Post>) => ({
	type: "users" as const,
	id: user.id,
	attributes: {
		name: user.name,
		email: user.email,
		role: user.role,
	},
	relationships: {
		posts: {
			data: userPosts.map((post) => ({ type: "posts" as const, id: post.id })),
		},
	},
});

export const parsePostFieldset = (fieldset: string | undefined) => {
	if (fieldset === undefined) {
		return undefined;
	}
	const fields = new Set(fieldset === "" ? [] : fieldset.split(","));
	for (const field of fields) {
		if (!allPostFields.has(field as PostField)) {
			return {
				_tag: "InvalidFieldset" as const,
				field,
			};
		}
	}
	return {
		_tag: "ValidFieldset" as const,
		fields: fields as ReadonlySet<PostField>,
	};
};

const fieldIncluded = (fields: ReadonlySet<PostField> | undefined, field: PostField) =>
	fields === undefined || fields.has(field);

export const postResource = (post: Post, fields?: ReadonlySet<PostField>) => {
	const attributes: {
		title?: string;
		summary?: string;
		body?: string;
		publishedAt?: string;
	} = {};
	if (fieldIncluded(fields, "title")) {
		attributes.title = post.title;
	}
	if (fieldIncluded(fields, "summary")) {
		attributes.summary = post.summary;
	}
	if (fieldIncluded(fields, "body")) {
		attributes.body = post.body;
	}
	if (fieldIncluded(fields, "publishedAt")) {
		attributes.publishedAt = post.publishedAt;
	}

	return {
		type: "posts" as const,
		id: post.id,
		...(Object.keys(attributes).length > 0 ? { attributes } : {}),
		...(fieldIncluded(fields, "user")
			? {
					relationships: {
						user: {
							data: { type: "users" as const, id: post.userId },
						},
					},
				}
			: {}),
	};
};

export const errors = (
	status: "400" | "404",
	title: string,
	detail: string,
	source?: { readonly parameter?: string; readonly pointer?: string },
) => ({
	errors: [
		{
			status,
			title,
			detail,
			...(source === undefined ? {} : { source }),
		},
	],
});
