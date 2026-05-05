This is the effect-jsonapi repository. Its goal is to provide a convenient and idiomatic effectful implementation of the JSON:API spec that can be used in effect API applications.

- The git base branch is `main`
- Use `pnpm` as the package manager
- Run tests with `pnpm run test`
- After making changes, format with `pnpm run fmt`

## Effect

- Use [Effect v4](https://raw.githubusercontent.com/Effect-TS/effect-smol/refs/heads/main/LLMS.md) instead of Effect v3.
  - When using Schema, refer to the v4 documentation at [SCHEMA.md](https://raw.githubusercontent.com/Effect-TS/effect-smol/refs/heads/main/packages/effect/SCHEMA.md)
  - When using HttpApi, refer to the v4 documentation at [HTTPAPI.md](https://raw.githubusercontent.com/Effect-TS/effect-smol/refs/heads/main/packages/effect/HTTPAPI.md)
- Design the package's API surface to target Effect's `HttpApi` module, not other HTTP abstractions or frameworks.

## JSON:API

- Focus implementation on the [JSON:API spec 1.1](https://raw.githubusercontent.com/json-api/json-api/refs/heads/gh-pages/_format/1.1/index.md) version.
