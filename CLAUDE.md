# CLAUDE.md — mnemo-client

Public client libraries for the MNEMO REST API (backend lives in the separate `mnemo` repo,
module `mnemo-rest`). Apache 2.0, published to Maven Central as `ai.panaxon:mnemo-client`
(namespace `ai.panaxon`, verified in the Central Portal). The Java *packages* stay `com.panaxon.ai.*` — the
`groupId` and the package names are independent, and renaming packages would break every consumer's imports.

## Layout

- `java/` — the Java client (done). `python/`, `typescript/` — planned, empty.
- Put per-language notes in that language's folder; this file is for rules common to the repo.

## Java client (`java/`)

Commands (run from `java/`):

- `mvn test` — unit tests, no network.
- `mvn -Dgpg.skip=true verify -DskipITs=false` — adds integration tests. They skip themselves unless
  `MNEMO_API_KEY` etc. are set (see `java/README.md`). **Always pass `-Dgpg.skip=true` unless actually releasing:**
  the GPG plugin is bound to `verify` and will prompt for a passphrase.
- Do not use `mvn -q test` to judge a change: it prints nothing either way. Read `Tests run: N` and check N > 0.

### The pattern (follow it for any new client)

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

### Conventions

- Every `.java` file starts with the Apache 2.0 header — copy it from `MnemoClient.java`.
- Failures are `MnemoClientException` carrying a `MnemoError.Code` and the HTTP status. Validate required
  parameters with `require(...)` *before* sending, so bad input never costs a request.
- Optional query params / body fields must be omitted when null (`query(...)`, `body(...)` helpers) — RESTEasy
  throws on null query values, and the server treats a sent null differently from an absent field.
- Build a fresh JAX-RS `Client` per `execute()` (done in `withTarget`); do not cache one on the instance.
- `FAIL_ON_UNKNOWN_PROPERTIES` stays **off** (`MnemoObjectMapperProvider`): a newer server must not break an older client.
- Javadoc example code in `<pre>{@code ...}</pre>`: write a line-leading `@` as `&#64;`, and keep generics inside
  `{@code}`. The javadoc jar is built at `package`, which `mvn test` does not exercise — run
  `mvn -Dgpg.skip=true package` after editing javadoc.

### Backend facts that matter

- Base URL is `https://mnemo-api.panaxon.ai/api` — the `/api` prefix is required (the bare host 404s).
  `mnemo-rest.panaxon.ai` does not exist.
- Auth header is `X-Mnemo-Api-Token`. Errors are `{"error": "..."}`. Dates are ISO-8601 strings.
- Tenant tokens may only act on their own `tenantId` (else 403). MnemoRAG needs a Pro/Enterprise tenant token;
  the master token cannot call it. Admin-only endpoints (RAG config CRUD, tokens, billing) are out of scope.
- When the backend changes a DTO, update the matching record in `model/` and the `Operation` javadoc.
  Source of truth: `mnemo/mnemo-rest/src/main/java/com/panaxon/ai/mnemo/rest/` (`*Resource.java`, `record/`).

### Release

`gpg.keyname` in `pom.xml` is the signing key fingerprint. `central-publishing-maven-plugin` has `autoPublish`
and `waitUntil=published`, so `mvn deploy` publishes to Central immediately and irreversibly. The signing key's
public half must be on a keyserver first.

### Not supported (deliberately)

SSE streaming (`init/stream`, `chat/stream`), multipart ingest / OCR, and admin endpoints.
