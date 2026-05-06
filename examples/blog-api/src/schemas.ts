import { Schema } from "effect";
import * as JsonApi from "effect-jsonapi";

const PageNumber = Schema.NumberFromString;
const PageSize = Schema.NumberFromString;
export const PostFieldsetQueryName = JsonApi.makeSparseFieldsetQueryName(
	"posts",
) as "fields[posts]";

export const PaginationQuery = Schema.Struct({
	"page[number]": Schema.optionalKey(PageNumber),
	"page[size]": Schema.optionalKey(PageSize),
});

export const PostIndexQuery = Schema.Struct({
	"page[number]": Schema.optionalKey(PageNumber),
	"page[size]": Schema.optionalKey(PageSize),
	[PostFieldsetQueryName]: Schema.optionalKey(JsonApi.FieldsetQueryValue),
});

export const PostDetailQuery = Schema.Struct({
	include: Schema.optionalKey(JsonApi.IncludeParameter),
});

export const UserId = Schema.String;
export const PostId = Schema.String;

const UserAttributes = Schema.Struct({
	name: Schema.optionalKey(Schema.String),
	email: Schema.optionalKey(Schema.String),
	role: Schema.optionalKey(Schema.Literals(["admin", "editor", "reader"])),
});

const NewUserAttributes = Schema.Struct({
	name: Schema.String,
	email: Schema.String,
	role: Schema.optionalKey(Schema.Literals(["admin", "editor", "reader"])),
});

const PostAttributes = Schema.Struct({
	title: Schema.optionalKey(Schema.String),
	summary: Schema.optionalKey(Schema.String),
	body: Schema.optionalKey(Schema.String),
	publishedAt: Schema.optionalKey(Schema.String),
});

export const UserResource = JsonApi.resourceObject({
	type: "users",
	id: UserId,
	attributes: UserAttributes,
	relationships: Schema.Struct({
		posts: JsonApi.RelationshipObject,
	}),
});

const NewUserResource = JsonApi.resourceObject({
	type: "users",
	id: Schema.Never,
	attributes: NewUserAttributes,
	relationships: Schema.Struct({}),
});

export const PostResource = JsonApi.resourceObject({
	type: "posts",
	id: PostId,
	attributes: PostAttributes,
	relationships: Schema.Struct({
		user: JsonApi.RelationshipObject,
	}),
});

const PageMeta = Schema.Struct({
	page: Schema.Struct({
		number: Schema.Number,
		size: Schema.Number,
		total: Schema.Number,
		count: Schema.Number,
	}),
});

export const UsersDocument = Schema.Struct({
	data: Schema.Array(UserResource),
	meta: PageMeta,
}).pipe(JsonApi.withJsonApiStatus(200));
export const UserDocument = JsonApi.successResponse(200)(UserResource);
export const CreateUserDocument = JsonApi.createResourceDocument(NewUserResource).pipe(
	JsonApi.asJsonApi(),
);
export const CreatedUserDocument = JsonApi.successResponse(201)(UserResource);
export const PostsDocument = Schema.Struct({
	data: Schema.Array(PostResource),
	meta: PageMeta,
}).pipe(JsonApi.withJsonApiStatus(200));
export const PostDocument = JsonApi.successResponse(200)(PostResource);
export const BadRequestDocument = JsonApi.errorResponse(400)(JsonApi.ErrorObject);
export const NotFoundDocument = JsonApi.errorResponse(404)(JsonApi.ErrorObject);
