# mnemo-client (TypeScript)

TypeScript / JavaScript client for the [MNEMO](https://panaxon.ai) API, the multi-tenant AI memory service from
Panaxon AI. It lets a Node.js application chat with MNEMO, query MnemoRAG, manage memory subjects and sessions,
change account settings and use memory sharing, without writing any HTTP code.

- Node.js 18+ (uses the built-in `fetch`), ESM
- No runtime dependencies
- Ships its own type declarations
- Apache License 2.0

It follows the same design as the [Java client](https://github.com/esuryadi/mnemo-client/tree/main/java): same clients, same operations, same error
codes.

## Install

```sh
npm install @panaxon/mnemo-client
```

Releases are published from GitHub Actions with npm provenance, so `npm audit signatures` can confirm that a release
was built from this repository.

## Quick start

Every client works the same way: a **builder** collects the parameters, `build()` gives you a client, and
`execute()` makes the call and returns a `Promise` of the result. The builder holds all the arguments, which is why
`execute()` takes none.

A new chat session has to be initialized once before its first message. Initialization loads the tenant's
memory, so it can take ten seconds or more. After that, chat as often as you like in the same session.

```ts
import { type ChatMessageResponse, type MnemoClient, MnemoChatClient } from "@panaxon/mnemo-client";

await new MnemoChatClient.Builder()
    .apiKey(process.env.MNEMO_API_KEY!)
    .tenantId("acme")
    .sessionId("session-1")
    .operation(MnemoChatClient.Operation.INIT_SESSION)
    .build()
    .execute();

const client: MnemoClient = new MnemoChatClient.Builder()
    .apiKey(process.env.MNEMO_API_KEY!)
    .tenantId("acme")
    .sessionId("session-1")
    .message("What did I eat on Monday?")
    .build();

const reply = await client.execute<ChatMessageResponse>();
console.log(reply.message);
```

If you skip initialization, the chat fails. The service refuses it with HTTP 409 and the message "This session has
not been initialized yet. Please call /init/stream first.", which the client rejects with as a
`MnemoClientException` (`httpStatus` is 409, and the error code is `INVALID_REQUEST`). Nothing is saved.

`execute()` is generic. Pass the type the operation returns, as in `execute<ChatMessageResponse>()`. The type is
not checked at runtime. A client can be built once and executed more than once. It reads its parameters from the
builder it was built from, so use a new builder for each client and do not change a builder after `build()`.

## Authentication

Create an API token in Dorothy and pass it with `.apiKey(...)`. It is sent in the `X-Mnemo-Api-Token` header.
Keep it out of source code: read it from an environment variable or a secret store.

**Or use an OAuth client.** In Dorothy, open Security, then OAuth Clients, and create a client. Pass its ID and
secret instead of an API key:

```ts
const builder = new MnemoChatClient.Builder()
    .clientCredentials(process.env.MNEMO_CLIENT_ID!, process.env.MNEMO_CLIENT_SECRET!);
```

The client exchanges them at `{baseUrl}/oauth/token` for a one-hour bearer token, reuses it, and gets a new one
shortly before it expires or if the service rejects it. Use either `.apiKey(...)` or `.clientCredentials(...)`,
not both. A client has a fixed role (USER or ADMIN) and its secret can be rotated in Dorothy without downtime.

The service endpoint defaults to `https://mnemo-api.panaxon.ai/api`. To point at a self-hosted or test
deployment, override it with `.baseUrl(...)`. The timeout is 120 seconds by default; change it with
`.timeout(milliseconds)`, where `0` means no timeout.

## Clients

| Client | What it does | Resolves with |
|---|---|---|
| `MnemoChatClient` | Chat, sessions, history, subjects, plan, health | `ChatMessageResponse`, or `JsonObject` / `JsonObject[]` |
| `MnemoRAGClient` | Ask a question against a MnemoRAG configuration (Pro / Enterprise) | `RagQueryResponse` |
| `MnemoSettingsClient` | Read and update account settings | `SettingsResponse` |
| `MnemoNetworkClient` | Private grants, public publishing and subscriptions, affiliations | parsed JSON |

Every client takes an `operation(...)` from its own `Operation` enum. The defaults are `CHAT` for chat, `QUERY`
for RAG and `GET_SETTINGS` for settings. Network has no default, so you must set one. The doc comment of each
`Operation` member lists the builder parameters it needs and the type it resolves with. A missing required
parameter fails before any request is made.

Response models (`ChatMessageResponse`, `RagQueryResponse`, `SettingsResponse`, ...) are the service's JSON as
parsed, so field names match the wire format and timestamps are ISO-8601 strings.

### Chat

```ts
// list the tenant's memory subjects
const subjects = await new MnemoChatClient.Builder()
    .apiKey(key).tenantId("acme")
    .operation(MnemoChatClient.Operation.LIST_SUBJECTS)
    .build().execute<JsonObject[]>();

// delete a session for good
await new MnemoChatClient.Builder()
    .apiKey(key).tenantId("acme").sessionId("session-1")
    .operation(MnemoChatClient.Operation.CLOSE_SESSION).permanent(true)
    .build().execute();
```

### MnemoRAG

```ts
const answer = await new MnemoRAGClient.Builder()
    .apiKey(key)
    .ragId("support-kb")
    .query("What is the refund window for annual plans?")
    .build().execute<RagQueryResponse>();

if (answer.found) {
    console.log(`${answer.answer} (confidence ${answer.confidence})`);
}
```

The tenant comes from your API key, so the master key cannot be used here.

### Settings

```ts
const updated = await new MnemoSettingsClient.Builder()
    .apiKey(key).accountId("acct-123")
    .operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
    .lookbackDays(30)
    .build().execute<SettingsResponse>();
```

Only the settings you set are changed. `providerApiKey(...)` is your own LLM provider key. It is not the same as
`apiKey(...)`, which authenticates you to MNEMO.

### Network

```ts
await new MnemoNetworkClient.Builder()
    .apiKey(key).tenantId("acme")
    .operation(MnemoNetworkClient.Operation.SUBSCRIBE)
    .counterpartTenantId("globex").subject("Roadmap")
    .build().execute();
```

`tenantId` is always the tenant making the call; `counterpartTenantId` is the other party.

## Error handling

Every failure is a rejection with a `MnemoClientException`.

```ts
import { MnemoClientException, MnemoError } from "@panaxon/mnemo-client";

try {
    reply = await client.execute<ChatMessageResponse>();
} catch (e) {
    if (!(e instanceof MnemoClientException)) throw e;
    switch (e.error.code) {
        case MnemoError.Code.UNAUTHORIZED: refreshKey(); break;            // HTTP 401
        case MnemoError.Code.RATE_LIMITED: backOff(); break;               // HTTP 429, quota or rate limit
        case MnemoError.Code.FORBIDDEN: upgradePlanOrFixTenant(); break;   // HTTP 403
        default: console.error(`MNEMO call failed (${e.httpStatus}): ${e.message}`);
    }
}
```

`httpStatus` is the HTTP status, or `0` when no response arrived. `message` carries the service's own explanation
when it sent one. Each `MnemoError.Code` value is its stable `MNERR-xxxx` identifier.

The other codes are:

- `MISSING_API_KEY` and `INVALID_REQUEST`: caught locally, before any request is sent.
- `NOT_FOUND` and `SERVER_ERROR`.
- `IO_ERROR`: the service could not be reached, or the request timed out.
- `SERIALIZATION_ERROR`: the response could not be parsed.
- `INIT_FAILED`: session initialization failed.

## Not supported

This client does not cover:

- Token-by-token streaming chat (`chat/stream`). `INIT_SESSION` does use the init event stream, but reads it to the
  end and returns the result.
- File ingest and OCR uploads.
- The administrative endpoints: account and user management, API token management, billing, and RAG configuration
  CRUD.

The same network calls as in the Java client are not covered yet.

## Building and testing

```sh
npm install
npm test            # unit tests (vitest), no network needed
npm run typecheck   # type-checks src and test
npm run build       # compiles to dist/ with .d.ts files
```

The unit tests run the real client against an in-process HTTP server.

## License

Apache License 2.0. See [LICENSE](LICENSE).
