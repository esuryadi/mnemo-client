# CLAUDE.md — TypeScript client (`typescript/`)

The repo-wide rules (the client pattern, conventions, backend facts) are in `../CLAUDE.md`. This file is only what
differs for TypeScript.

## Commands (run from `typescript/`)

- `npm test` — vitest unit tests, no network. Read the `Tests  N passed` line and check that N > 0.
- `npm run typecheck` — type-checks `src` and `test` (`tsconfig.test.json`). vitest strips types without checking
  them, so a passing `npm test` says nothing about type errors.
- `npm run build` — `tsc` to `dist/` with `.d.ts`. Run it after touching exports: vitest runs `src` through its own
  transform, so a circular import that breaks in plain Node only shows up against `dist/`.

## How the Java pattern maps

- Interface + nested types become **declaration merging**: `export interface MnemoChatClient extends MnemoClient {}`
  plus `export namespace MnemoChatClient { export enum Operation …; export class Builder … }`, so call sites read
  `new MnemoChatClient.Builder()` / `MnemoChatClient.Operation.CHAT`, exactly as in Java.
- Self-typed builder: setters return the polymorphic `this` type instead of `self()`. `MnemoClientBuilder` is not
  generic.
- "Package-private getters": builder state lives in `_camelCase` fields marked `/** @internal */`; `stripInternal`
  removes them from the published `.d.ts`. The `*Impl` classes read these fields directly. Keep each new field
  `@internal`.
- `execute<T>()` returns a `Promise<T>`; the `switch` in each Impl ends with a `default` that rejects with
  `INVALID_REQUEST` (an enum value cast in from plain JavaScript).
- String enums (`CHAT = "CHAT"`), so `Object.values(Operation)` is the list of operations; the validation test
  depends on that. `MnemoError.Code` values are the `MNERR-xxxx` identifiers.
- Models are interfaces over the parsed JSON (camelCase, dates as ISO strings). Nothing is validated at runtime.

## Gotchas

- `fetch` only normalizes the case of some HTTP methods, and `PATCH` is not one of them. Always pass methods in
  upper case (the `request` helper already does).
- Path segments go through `path(base, template, values)`, which applies `encodeURIComponent`, so a `/` in a
  subject name becomes `%2F`. Query strings go through `query()`, which keeps insertion order and drops
  `null`/`undefined`. The tests assert exact query strings.
- Node 18 is the floor (`fetch`, `AbortSignal.timeout`). The package is ESM only.
- `src` must not use Node-only globals (`Buffer`, `process`, `node:*` imports): use web-standard APIs (`btoa`,
  `TextEncoder`, `URLSearchParams`). `tsconfig.json` (the build) loads no `@types/node` (TypeScript 7 no longer
  includes `@types/*` by default), so a `Buffer` fails `npm run build` only. vitest and `npm run typecheck` (which
  does load node types, for the tests) both miss it, so run `npm run build` before pushing.
- `LICENSE` here is a copy of the repo root's, because npm only packs files inside `typescript/`. `files` in
  `package.json` limits the tarball to `dist/` and `LICENSE` (plus `package.json` and the README, always included);
  the publish workflow fails if anything else gets in.
- The README is the package page on npmjs.com, where relative links outside `typescript/` break: link the rest of
  the repo with absolute GitHub URLs.

## Release (npm, `@panaxon/mnemo-client`)

Not published yet. Released by hand from GitHub: Actions -> "Publish TypeScript client" -> Run workflow
(`dry_run` first). `.github/workflows/typescript-publish.yml` has the details. It refuses a pre-release version or one
already on npm, and npm never accepts a version twice (not even after an unpublish), so a real run is
**irreversible**: bump `version` in `package.json` first.

One-time setup, done by a maintainer on npmjs.com:

1. An account with two-factor authentication, and the organization `panaxon` (owns the `@panaxon` scope).
2. The first publish: npm only offers trusted publishing on a package that already exists, so either store an npm
   granular access token as the repo secret `NPM_TOKEN`, or run `npm publish --access public` once from a
   maintainer's machine (that release then has no provenance).
3. Then package settings -> Trusted publisher -> GitHub Actions: repository `esuryadi/mnemo-client`, workflow
   `typescript-publish.yml`, environment `npm`, and delete the `NPM_TOKEN` secret.

After every release, run `smoke-test/verify-npm.sh <version> --wait`. It installs the release from the real registry
into an empty project with an empty npm cache, checks the files, the registry signature and the provenance
attestation, then type-checks `SmokeTest.ts` with `skipLibCheck` off and runs it (a health check and a bad-key 401,
neither of which costs LLM budget). After the first release, change the README's Install section to
`npm install @panaxon/mnemo-client`, and the status in the root README and in Dorothy's Help (`HelpModal.tsx`).
