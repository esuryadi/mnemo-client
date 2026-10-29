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
    <version>1.0.0</version>
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
