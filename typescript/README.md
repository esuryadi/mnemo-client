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

From [npm](https://www.npmjs.com/package/@panaxon/mnemo-client):

```sh
npm install @panaxon/mnemo-client
# or
yarn add @panaxon/mnemo-client
pnpm add @panaxon/mnemo-client
```

To pin a version: `npm install @panaxon/mnemo-client@1.2.0`. The package has no runtime dependencies.

```ts
import { MnemoChatClient, MnemoClientException } from "@panaxon/mnemo-client";
```

- **Node.js 18 or newer.** The client uses the built-in `fetch`.
- **ESM only.** Load it with `import`. A CommonJS project can `require()` it on Node 20.19+ / 22.12+, which can load
  ES modules, or use `await import("@panaxon/mnemo-client")` on any version. In a CommonJS TypeScript project, set
  `"module": "nodenext"`: under `node16`, TypeScript refuses a static import of an ES module.
- **TypeScript**: the type declarations are included, so no `@types` package is needed.

Releases are published from GitHub Actions with npm provenance. To confirm that what you installed was built from
this repository, run `npm audit signatures` in your project.

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

## Embed a chat in your web app

`<mnemo-chat>` puts a MNEMO chat in your own page with one script tag and one element, from this package (`embed/mnemo-chat.js`, 11 KB gzipped, no dependencies). The page never holds an API key: your Node server uses this library to mint a **short-lived embed token** (15 minutes, one allowed origin, chat only) and hands it to the component.

```
 visitor's browser                  your server (Node)                MNEMO
 ┌─────────────────┐  GET /embed-token ┌──────────────────┐  POST mnemo/embed/token  ┌──────┐
 │  <mnemo-chat>   │ ────────────────▶ │ EmbedTokenEndpoint│ ───────────────────────▶ │ API  │
 │                 │ ◀──────────────── │ (your API key)    │ ◀─────────────────────── │      │
 │                 │   embed token     └──────────────────┘      embed token         │      │
 │                 │ ───────── chat with the embed token, from your origin ─────────▶ │      │
 └─────────────────┘                                                                  └──────┘
```

**Server (Express).** The page and the token endpoint; the API key stays here. Put your own sign-in check where `currentUser` is used:

<!-- example: typescript/examples/express-server.ts -->
```ts
export function createApp(config: ExampleConfig): Express {
    // the template holds the credential and the fixed parameters; each request only adds the visitor's id
    const template = new MnemoEmbedClient.Builder()
        .apiKey(config.apiKey)
        .tenantId(config.tenantId)
        .allowedOrigin(config.allowedOrigin);
    if (config.baseUrl) {
        template.baseUrl(config.baseUrl);
    }

    const app = express();

    app.get("/", (_req, res) => {
        res.type("html").send(
            "<!doctype html><title>Support</title><h1>Ask us anything</h1>\n"
            + EmbedSnippet.render({ tokenUrl: "/mnemo/embed-token", width: "50%", height: 600 }));
    });

    app.get("/mnemo/embed-token", async (req, res) => {
        const userId = config.currentUser(req);
        if (userId === null) {
            res.status(401).json({ error: "sign in first" });
            return;
        }
        try {
            res.set("Cache-Control", "no-store").type("application/json")
                .send(await EmbedTokenEndpoint.handle(template, userId));
        } catch (e) {
            // do not pass MNEMO's message on to the browser
            res.status(e instanceof MnemoClientException && e.httpStatus === 429 ? 429 : 502)
                .json({ error: "the chat is not available right now" });
        }
    });

    return app;
}
```

**The page.** `EmbedSnippet.render` produces the two lines; written by hand (or served from the CDN) it is:

<!-- example: typescript/examples/plain-html/index.html -->
```html
  <script src="https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@1.2.0/embed/mnemo-chat.js" async></script>
  <mnemo-chat token-url="/mnemo/embed-token" width="50%" height="600"></mnemo-chat>
```

`<mnemo-chat>` works unchanged in React, Vue and Angular (it is a standard custom element; in React 19 and Vue pass `token-url` as an attribute, in Angular add `CUSTOM_ELEMENTS_SCHEMA`). The browser-side code needs no build step. Serve `node_modules/@panaxon/mnemo-client/embed/mnemo-chat.js` yourself if you prefer not to use the CDN.

Calling MNEMO yourself: a streaming chat is `MnemoChatClient.Operation.CHAT_STREAM` (an async iterable of `{event, data}`), and `.embedToken("...")` on a builder authenticates with an embed token (exclusive with `apiKey` and `clientCredentials`). In a browser the builder refuses an API key unless you call `.allowApiKeyInBrowser(true)`: do not.

### `<mnemo-chat>` attributes, events and methods

| Attribute | Meaning |
|---|---|
| `token-url` (required) | Your own endpoint that returns `{"token", "expiresAt", "tenantId", "sessionPrefix"}` (what `EmbedTokenEndpoint` produces). The component calls it with the visitor's cookies, again when the token is within 60 seconds of expiring, and once after a failed call. |
| `base-url` | The MNEMO API base URL when it is not `https://mnemo-api.panaxon.ai/api`. |
| `width`, `height` | A bare number is pixels (`600`); any CSS length also works (`50%`, `40vh`). |
| `theme` | `light`, `dark` or `auto` (follows the visitor's system setting). |
| `placeholder` | Text of the empty message box. |
| `session-id` | Names the conversation; the component adds the token's `sessionPrefix`. Without it a random id is kept in `sessionStorage`, so a reload continues the same conversation. |
| `tenant-id` | Only if your token endpoint does not return `tenantId` (`EmbedTokenEndpoint` always does). |
| `locale` | Language of the built-in labels: `en`, `es`, `fr` or `de`. |

Events (all bubble and are composed, so they cross the Shadow DOM): `mnemo-ready` (the chat is connected), `mnemo-message` (`detail.role`, `detail.text`) and `mnemo-error` (`detail.message`). Methods: `open()` focuses the message box, `reset()` starts a new conversation. Press Escape to stop waiting for an answer.

Answers are untrusted text: the component renders a small, safe subset of Markdown (no HTML pass-through, links open in a new tab with `rel="noopener noreferrer"`, only `http`, `https` and `mailto` links).

### Security checklist

- **Never put an API key, client secret or master token in the page.** The page only ever holds an embed token: it lives at most 15 minutes, works only from the one origin you named, can only chat (no ingest, no delete, no settings, no tokens) and cannot mint another token.
- **Put the token endpoint behind your own sign-in.** Anyone who can call it gets a chat session billed to your MNEMO tenant. Pass your signed-in user's id as `endUserId`: each visitor then has their own sessions and history. Without it all anonymous visitors of the tenant share one session namespace.
- **Name exactly one `allowedOrigin`** (`https://app.example.com`, no path, no wildcard; `http://localhost:3000` is accepted for development). A copy of the token lifted from another site is refused.
- **CSP:** allow the script host in `script-src` (`https://cdn.jsdelivr.net`, or your own host if you serve `mnemo-chat.js` yourself) and the API in `connect-src` (`https://mnemo-api.panaxon.ai`).
- **Quota:** every message counts against your tenant's plan like any other chat call, and each token is limited to 20 messages per minute.

### Troubleshooting

- *CORS error in the console*: the page's origin is not the `allowedOrigin` the token was minted with (check scheme, host and port), or the token expired (the component refreshes it and retries once).
- *"This token cannot be used from this origin" (403)*: same cause. A server-side call that sends no `Origin` header is refused too.
- *Token endpoint 401/403*: your own sign-in check failed, or the API key behind `EmbedTokenEndpoint` is not an ADMIN key of that tenant.
- *The chat box never appears*: the browser blocked the script (CSP), or the element was written self-closing; custom elements need `<mnemo-chat></mnemo-chat>`.
- *Needs client 1.2.0 and a MNEMO backend with embed tokens (live since 2026-11-14).*

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
