# CLAUDE.md — mnemo-client

Public client libraries for the MNEMO REST API (backend lives in the separate `mnemo` repo,
module `mnemo-rest`). Apache 2.0, published to Maven Central as `ai.panaxon:mnemo-client`
(namespace `ai.panaxon`, verified in the Central Portal). The Java *packages* stay `com.panaxon.ai.*` — the
`groupId` and the package names are independent, and renaming packages would break every consumer's imports.
The TypeScript client is published to npm as `@panaxon/mnemo-client`. The Python client is built and tested but
**not published yet** (PyPI `mnemo-client`; its workflow is ready). The Release sections of `typescript/CLAUDE.md` and
`python/CLAUDE.md` describe each.

## Layout

- `java/` — the Java client (the reference implementation; published).
- `typescript/` — TypeScript client, Node 18+, ESM, zero runtime deps. Notes: `typescript/CLAUDE.md`.
- `python/` — Python client, 3.9+, stdlib only. Notes: `python/CLAUDE.md`.
- Put per-language notes in that language's folder; this file is for rules common to the repo, plus the Java
  client's commands and release process.
- `.github/workflows/<language>-publish.yml`: one manual (`workflow_dispatch`) release workflow per language, each
  with a `dry_run` input and a refusal to republish an existing version. Each language has a `smoke-test/` with a
  script that verifies a release from the real registry.
- The three clients must stay **in parity**: same clients, operations, paths, body-vs-query placement, defaults,
  validation and error codes. A backend change or a new operation lands in all three, each with its test, and the
  tests are ports of each other (same cases, same asserted paths and query strings).
- The three clients share **one version number**: a release of one language bumps `java/pom.xml`,
  `typescript/package.json` (with `npm version <v> --no-git-tag-version`, which updates the lock file too) and
  `__version__` in `python/src/mnemo_client/__init__.py` to the same value, even if the other two are not released.

Unit tests, one per language (none needs the network):

- Java: `cd java && mvn test` (read `Tests run: N`)
- TypeScript: `cd typescript && npm test && npm run typecheck`
- Python: `cd python && PYTHONPATH=src:tests python3 -m unittest discover -s tests`

## The pattern (follow it for any new client, in every language)

Described in Java terms (`switch`, package-private, records); `typescript/CLAUDE.md` and `python/CLAUDE.md` say how each point maps there.

1. `MnemoXxxClient` interface extends `MnemoClient`, with a nested `Builder extends MnemoClientBuilder<Builder>`.
2. The **builder only collects parameters**. `build()` passes `this` to `MnemoXxxClientImpl`; `execute()` takes no
   arguments and reads everything from the builder. Do not add parameters to `execute()`. The impl keeps a live
   reference to the builder, so one builder per client, and never mutate a builder after `build()`.
3. Each client interface declares a nested `Operation` enum, and the builder selects one with `operation(...)`.
   `MnemoXxxClientImpl` is package-private, extends `AbstractMnemoClient` (shared RESTEasy plumbing, error
   mapping), and its `execute()` is only a `switch` that dispatches to **one private method per operation**.
   Adding an API call = a new enum constant (documenting its parameters and return type), a new Impl method,
   a `switch` case, any new builder parameters, and a test. The client interface and `execute()` do not change.
4. Builder getters are package-private; setters are public and fluent. `MnemoClientBuilder` is self-typed
   (`<B extends MnemoClientBuilder<B>>`) so `.apiKey()` etc. chain into subclass setters — implement `self()`.
5. Response types: typed records in `com.panaxon.ai.model` for the core calls (chat, RAG, settings); other calls
   return `Map` / `List<Map>` / `Object` parsed JSON. Document the return type on each `Operation` constant.

## Conventions

- Every source file starts with the Apache 2.0 header — copy it from `MnemoClient.java` / `MnemoClient.ts` /
  `client.py` (the line after the license names the language).
- Failures are `MnemoClientException` carrying a `MnemoError.Code` and the HTTP status. Validate required
  parameters with `require(...)` *before* sending, so bad input never costs a request.
- Optional query params / body fields must be omitted when null (`query(...)`, `body(...)` helpers) — the server
  treats a sent null differently from an absent field (and in Java, RESTEasy throws on null query values).
- A chat session must be initialized (`INIT_SESSION`) before its first `CHAT`. The service now refuses a chat on an
  uninitialized session with HTTP 409 (mnemo PR #95, deployed 2026-10-29); until then it answered 200 with a "not
  been initialized" text and saved nothing, which is how an early integration test passed without ever getting a
  real reply. Still assert on the content of a chat reply, not just on success.
- Tolerate response fields the client does not know: a newer server must not break an older client.

## Backend facts that matter

- Base URL is `https://mnemo-api.panaxon.ai/api` — the `/api` prefix is required (the bare host 404s).
  `mnemo-rest.panaxon.ai` does not exist.
- Auth header is `X-Mnemo-Api-Token`. Errors are `{"error": "..."}`. Dates are ISO-8601 strings.
- OAuth client credentials are an alternative to the API key (set one, never both): `POST {baseUrl}/oauth/token`
  with `grant_type=client_credentials` and HTTP Basic `id:secret` returns `{access_token, expires_in}` (1 hour, no
  refresh token), sent as `Authorization: Bearer`. The token is cached on the builder (shared by every call of a
  client, guarded against concurrent fetches), replaced 60 seconds before it expires, and replaced once when the
  service answers 401. A wrong secret is 401 `invalid_client`; a locked client is 429.
- Tenant tokens may only act on their own `tenantId` (else 403). MnemoRAG needs a Pro/Enterprise tenant token;
  the master token cannot call it. Admin-only endpoints (RAG config CRUD, tokens, billing) are out of scope.
- When the backend changes a DTO, update the matching model in all three clients (`model/`, `model/index.ts`,
  `model.py`) and the `Operation` docs.
  Source of truth: `mnemo/mnemo-rest/src/main/java/com/panaxon/ai/mnemo/rest/` (`*Resource.java`, `record/`).

## Java client (`java/`)

Commands (run from `java/`):

- `mvn test` — unit tests, no network.
- `mvn -Dgpg.skip=true verify -DskipITs=false` — adds integration tests. They skip themselves unless
  `MNEMO_API_KEY` etc. are set (see `java/README.md`). **Always pass `-Dgpg.skip=true` unless actually releasing:**
  the GPG plugin is bound to `verify` and will prompt for a passphrase.
- Do not use `mvn -q test` to judge a change: it prints nothing either way. Read `Tests run: N` and check N > 0.

Java-specific conventions:

- Build a fresh JAX-RS `Client` per `execute()` (done in `withTarget`); do not cache one on the instance.
- `FAIL_ON_UNKNOWN_PROPERTIES` stays **off** (`MnemoObjectMapperProvider`): a newer server must not break an older client.
- Javadoc example code in `<pre>{@code ...}</pre>`: write a line-leading `@` as `&#64;`, and keep generics inside
  `{@code}`. The javadoc jar is built at `package`, which `mvn test` does not exercise — run
  `mvn -Dgpg.skip=true package` after editing javadoc.

### Release

Releases are published by hand from GitHub: Actions -> "Publish Java client" -> Run workflow (`dry_run` first).
`gpg.keyname` in `pom.xml` is the signing key fingerprint, and the workflow needs the secrets `CENTRAL_USERNAME`,
`CENTRAL_PASSWORD`, `GPG_PRIVATE_KEY`, `GPG_PASSPHRASE`. `central-publishing-maven-plugin` has `autoPublish` and
`waitUntil=published`, so a real run publishes to Central immediately and **irreversibly**; the workflow refuses a
`-SNAPSHOT` or a version already on Central. The public half of the signing key must be on a keyserver, and the
`ai.panaxon` namespace Verified in the Central Portal.

After every release, verify it from the real repository with `java/smoke-test/verify-central.sh <version> --wait`.
It downloads the release into an empty local repository (nothing local can mask a problem), checks the files,
checksums and GPG signatures, then compiles and runs `SmokeTest` against it. A new release can take from minutes to
a couple of hours to appear on repo.maven.apache.org, hence `--wait`. Do not `mvn install` the library into `~/.m2`
and forget it there: that hides a failed Central download.

`0.1.0`, `1.0.0` and `1.1.0` are published (0.1.0 first, verified with the script, then 1.0.0; 1.1.0 added OAuth client credentials and was verified with the script on 2026-10-30).

### Not supported (deliberately)

Token-by-token SSE chat (`chat/stream`), multipart ingest / OCR, and admin endpoints. (`init/stream` *is* used, by
`INIT_SESSION`, but read to completion rather than streamed to the caller.)
