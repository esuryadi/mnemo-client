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
- Not published to npm yet. `@panaxon/mnemo-client` is a placeholder name: check that the scope is available
  before the first publish.
