# mnemo-client (Java)

Java client for the [MNEMO](https://panaxon.ai) API — the multi-tenant AI memory service from Panaxon AI.
It lets a Java application chat with MNEMO, query MnemoRAG, manage memory subjects and sessions, change
account settings and use memory sharing, without writing any HTTP code.

- Java 17+
- Apache License 2.0
- HTTP through the [RESTEasy](https://resteasy.dev) JAX-RS client, JSON through Jackson

## Install

```xml
<dependency>
    <groupId>ai.panaxon</groupId>
    <artifactId>mnemo-client</artifactId>
    <version>1.2.0</version>
</dependency>
```

## Quick start

Every client works the same way: a **builder** collects the parameters, `build()` gives you a client, and
`execute()` makes the call and returns the result. The builder holds all the arguments, which is why
`execute()` takes none.

A new chat session has to be initialized once before its first message. Initialization loads the tenant's
memory, so it can take ten seconds or more; after that, chat as often as you like in the same session.

```java
MnemoClient init = new MnemoChatClient.Builder()
        .apiKey(System.getenv("MNEMO_API_KEY"))
        .tenantId("acme")
        .sessionId("session-1")
        .operation(MnemoChatClient.Operation.INIT_SESSION)
        .build();
init.execute();

MnemoClient client = new MnemoChatClient.Builder()
        .apiKey(System.getenv("MNEMO_API_KEY"))
        .tenantId("acme")
        .sessionId("session-1")
        .message("What did I eat on Monday?")
        .build();

ChatMessageResponse reply = client.execute();
System.out.println(reply.message());
```

Skipping the initialization step fails: the service refuses the chat with HTTP 409 and the message "This session
has not been initialized yet. Please call /init/stream first.", which the client raises as a `MnemoClientException`
(`getHttpStatus()` is 409, and the error code is `INVALID_REQUEST`). Nothing is saved.

Declare the client as the `MnemoClient` interface: every builder's `build()` returns a `MnemoClient`, so your
code does not depend on a specific implementation. `execute()` is generic, so the result type is inferred from
the variable you assign it to. Each client can be
built once and executed more than once. The client reads its parameters from the builder it was built from,
so use a new builder for each client and do not change a builder after `build()`. Under that condition a
client is safe to share between threads.

## Authentication

Create an API token in Dorothy and pass it with `.apiKey(...)`. It is sent in the `X-Mnemo-Api-Token`
header. Keep it out of source code — read it from an environment variable or a secret store.

**Or use an OAuth client.** In Dorothy, open Security, then OAuth Clients, and create a client. Pass its ID and
secret instead of an API key:

```java
new MnemoChatClient.Builder()
        .clientCredentials(System.getenv("MNEMO_CLIENT_ID"), System.getenv("MNEMO_CLIENT_SECRET"))
```

The client exchanges them at `{baseUrl}/oauth/token` for a one-hour bearer token, reuses it, and gets a new one
shortly before it expires or if the service rejects it. Use either `.apiKey(...)` or `.clientCredentials(...)`,
not both. A client has a fixed role (USER or ADMIN) and its secret can be rotated in Dorothy without downtime.

The service endpoint defaults to `https://mnemo-api.panaxon.ai/api`. Override it with `.baseUrl(...)` for a
self-hosted or test deployment, and change the 120 second timeout with `.timeout(Duration)`.

## Clients

| Client | What it does | Returns |
|---|---|---|
| `MnemoChatClient` | Chat, sessions, history, subjects, plan, health | `ChatMessageResponse`, or `Map` / `List<Map>` |
| `MnemoRAGClient` | Ask a question against a MnemoRAG configuration (Pro / Enterprise) | `RagQueryResponse` |
| `MnemoSettingsClient` | Read and update account settings | `SettingsResponse` |
| `MnemoNetworkClient` | Private grants, public publishing and subscriptions, affiliations | parsed JSON (`Map` / `List`) |

Every client takes an `operation(...)` from its own `Operation` enum; chat defaults to `CHAT`, RAG to `QUERY`
and settings to `GET_SETTINGS`, while network requires one. The javadoc of each `Operation` constant lists the builder parameters it needs and the type it
returns. A missing required parameter fails before any request is made.

### Chat

```java
// list the tenant's memory subjects
List<Map<String, Object>> subjects = new MnemoChatClient.Builder()
        .apiKey(key).tenantId("acme")
        .operation(MnemoChatClient.Operation.LIST_SUBJECTS)
        .build().execute();

// delete a session for good
new MnemoChatClient.Builder()
        .apiKey(key).tenantId("acme").sessionId("session-1")
        .operation(MnemoChatClient.Operation.CLOSE_SESSION).permanent(true)
        .build().execute();
```

### MnemoRAG

```java
RagQueryResponse answer = new MnemoRAGClient.Builder()
        .apiKey(key)
        .ragId("support-kb")
        .query("What is the refund window for annual plans?")
        .build().execute();

if (answer.found()) {
    System.out.println(answer.answer() + " (confidence " + answer.confidence() + ")");
}
```

The tenant comes from your API key, so the master key cannot be used here.

### Settings

```java
SettingsResponse updated = new MnemoSettingsClient.Builder()
        .apiKey(key).accountId("acct-123")
        .operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
        .lookbackDays(30)
        .build().execute();
```

Only the settings you set are changed. `providerApiKey(...)` is your own LLM provider key; it is different
from `apiKey(...)`, which authenticates you to MNEMO.

### Network

```java
new MnemoNetworkClient.Builder()
        .apiKey(key).tenantId("acme")
        .operation(MnemoNetworkClient.Operation.SUBSCRIBE)
        .counterpartTenantId("globex").subject("Roadmap")
        .build().execute();
```

`tenantId` is always the tenant making the call; `counterpartTenantId` is the other party.

## Embed a chat in your web app

`<mnemo-chat>` puts a MNEMO chat in your own page with one script tag and one element. The page never holds an API key: your server uses this library to mint a **short-lived embed token** (15 minutes, one allowed origin, chat only) and hands it to the component.

```
 visitor's browser                  your server (Java)                MNEMO
 ┌─────────────────┐  GET /embed-token ┌──────────────────┐  POST mnemo/embed/token  ┌──────┐
 │  <mnemo-chat>   │ ────────────────▶ │ EmbedTokenEndpoint│ ───────────────────────▶ │ API  │
 │                 │ ◀──────────────── │ (your API key)    │ ◀─────────────────────── │      │
 │                 │   embed token     └──────────────────┘      embed token         │      │
 │                 │ ───────── chat with the embed token, from your origin ─────────▶ │      │
 └─────────────────┘                                                                  └──────┘
```

**1. Mint the token (server side).** This is the `GET /mnemo/embed-token` handler of a Spring MVC controller, written here as a plain class so the library needs no Spring dependency. Put your sign-in check in front of it, and pass your signed-in user's id:

<!-- example: java/src/test/java/com/panaxon/ai/examples/SpringStyleEmbedController.java -->
```java
public String embedToken(String signedInUserId) throws MnemoClientException {
    return EmbedTokenEndpoint.handle(() -> new MnemoEmbedClient.Builder()
            .apiKey(apiKey).baseUrl(baseUrl).tenantId(tenantId).allowedOrigin(allowedOrigin), signedInUserId);
}
```

**2. Render the page.** `EmbedSnippet.render` escapes every attribute and gives you the two lines to put in your HTML:

<!-- example: java/src/test/java/com/panaxon/ai/examples/SpringStyleEmbedController.java -->
```java
public String chat() throws MnemoClientException {
    return "<!doctype html><title>Chat</title>"
            + EmbedSnippet.render(new EmbedSnippet.Options("/mnemo/embed-token").width("50%").height("600"));
}
```

That produces:

```html
<script src="https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@1.2.0/embed/mnemo-chat.js" async></script>
<mnemo-chat token-url="/mnemo/embed-token" width="50%" height="600"></mnemo-chat>
```

To serve the script yourself instead of from the CDN, return `EmbedAsset.bundledScript()` (the same file, bundled in this jar) with content type `text/javascript` and pass its URL as `new EmbedSnippet.Options(...).scriptUrl("/assets/mnemo-chat.js")`. The `examples` folder of the tests also has a plain `HttpServer` example. In Spring Boot, Jakarta or any other framework, call the same two methods from your handlers.

If you want to call MNEMO yourself, a streaming chat is `MnemoChatClient.Operation.CHAT_STREAM` with `onEvent(...)`, and `embedToken("...")` on a builder authenticates with an embed token (it is exclusive with `apiKey` and `clientCredentials`).

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

All failures are thrown as `MnemoClientException`.

```java
try {
    reply = client.execute();
} catch (MnemoClientException e) {
    switch (e.getError().code()) {
        case UNAUTHORIZED -> refreshKey();            // HTTP 401
        case RATE_LIMITED -> backOff();               // HTTP 429, quota or rate limit
        case FORBIDDEN    -> upgradePlanOrFixTenant(); // HTTP 403
        default           -> log.error("MNEMO call failed ({}): {}", e.getHttpStatus(), e.getMessage());
    }
}
```

`getHttpStatus()` is the HTTP status, or `0` when no response arrived. `getMessage()` carries the service's
own explanation when it sent one. Other codes: `MISSING_API_KEY` and `INVALID_REQUEST` (caught locally before
any request), `NOT_FOUND`, `SERVER_ERROR`, `IO_ERROR` (service unreachable) and `SERIALIZATION_ERROR`.

## Not supported

Token-by-token streaming chat (`chat/stream`; `INIT_SESSION` does use the init event stream, but reads it to the
end and returns the result), file ingest and OCR uploads, and the administrative endpoints (account and
user management, API token management, billing, RAG configuration CRUD) are not part of this client.

Within the network API, these calls are not covered yet: grant-removal notices, subscriber counts, changing a
published subject's visibility, revoking an affiliation, removing a follower and affiliate removal notices.

## Building and testing

```
mvn test                                         # unit tests, no network needed
mvn verify -DskipITs=false -Dgpg.skip=true       # also runs the integration tests
```

Unit tests run the real client against an in-process HTTP server. Integration tests call a real MNEMO
deployment and skip themselves unless configured through environment variables:

| Variable | Purpose |
|---|---|
| `MNEMO_API_KEY` | tenant API token; switches the integration tests on |
| `MNEMO_BASE_URL` | optional, defaults to the public service |
| `MNEMO_TENANT_ID` | tenant that owns the token |
| `MNEMO_IT_CHAT=true` | opt in to the chat test, which spends LLM quota |
| `MNEMO_RAG_ID` | a RAG configuration (Pro / Enterprise) |
| `MNEMO_ACCOUNT_ID` | an account whose settings may be read |

`mvn verify` signs the artifacts with GPG, so pass `-Dgpg.skip=true` when you only want to run the tests.

## License

Apache License 2.0 — see [LICENSE](../LICENSE).
