# mnemo-client (Python)

Python client for the [MNEMO](https://panaxon.ai) API, the multi-tenant AI memory service from Panaxon AI. It lets
a Python application chat with MNEMO, query MnemoRAG, manage memory subjects and sessions, change account settings
and use memory sharing, without writing any HTTP code.

- Python 3.9+
- No runtime dependencies (HTTP through the standard library's `urllib`)
- Typed (`py.typed`)
- Apache License 2.0

It follows the same design as the [Java client](https://github.com/esuryadi/mnemo-client/tree/main/java): same clients, same operations, same error
codes. Method and attribute names are snake_case.

## Install

The package is not on PyPI yet. Install it from source:

```sh
pip install /path/to/mnemo-client/python
```

## Quick start

Every client works the same way: a **builder** collects the parameters, `build()` gives you a client, and
`execute()` makes the call and returns the result. The builder holds all the arguments, which is why `execute()`
takes none.

A new chat session has to be initialized once before its first message. Initialization loads the tenant's
memory, so it can take ten seconds or more. After that, chat as often as you like in the same session.

```python
import os
from mnemo_client import MnemoChatClient

(MnemoChatClient.Builder()
    .api_key(os.environ["MNEMO_API_KEY"])
    .tenant_id("acme")
    .session_id("session-1")
    .operation(MnemoChatClient.Operation.INIT_SESSION)
    .build()
    .execute())

client = (MnemoChatClient.Builder()
    .api_key(os.environ["MNEMO_API_KEY"])
    .tenant_id("acme")
    .session_id("session-1")
    .message("What did I eat on Monday?")
    .build())

reply = client.execute()  # ChatMessageResponse
print(reply.message)
```

If you skip initialization, the chat fails. The service refuses it with HTTP 409 and the message "This session has
not been initialized yet. Please call /init/stream first.", which the client raises as a `MnemoClientException`
(`http_status` is 409, and the error code is `INVALID_REQUEST`). Nothing is saved.

A client can be built once and executed more than once. It reads its parameters from the builder it was built
from, so use a new builder for each client and do not change a builder after `build()`. Under that condition, a
client is safe to share between threads.

## Authentication

Create an API token in Dorothy and pass it with `.api_key(...)`. It is sent in the `X-Mnemo-Api-Token` header.
Keep it out of source code: read it from an environment variable or a secret store.

**Or use an OAuth client.** In Dorothy, open Security, then OAuth Clients, and create a client. Pass its ID and
secret instead of an API key:

```python
builder = MnemoChatClient.Builder() \
    .client_credentials(os.environ["MNEMO_CLIENT_ID"], os.environ["MNEMO_CLIENT_SECRET"])
```

The client exchanges them at `{base_url}/oauth/token` for a one-hour bearer token, reuses it, and gets a new one
shortly before it expires or if the service rejects it. Use either `.api_key(...)` or `.client_credentials(...)`,
not both. A client has a fixed role (USER or ADMIN) and its secret can be rotated in Dorothy without downtime.

The service endpoint defaults to `https://mnemo-api.panaxon.ai/api`. To point at a self-hosted or test
deployment, override it with `.base_url(...)`. The timeout is 120 seconds by default; change it with
`.timeout(seconds)`, where `0` means no timeout.

## Clients

| Client | What it does | Returns |
|---|---|---|
| `MnemoChatClient` | Chat, sessions, history, subjects, plan, health | `ChatMessageResponse`, or `dict` / `list` |
| `MnemoRAGClient` | Ask a question against a MnemoRAG configuration (Pro / Enterprise) | `RagQueryResponse` |
| `MnemoSettingsClient` | Read and update account settings | `SettingsResponse` |
| `MnemoNetworkClient` | Private grants, public publishing and subscriptions, affiliations | parsed JSON (`dict` / `list`) |

Every client takes an `operation(...)` from its own `Operation` enum. The defaults are `CHAT` for chat, `QUERY`
for RAG and `GET_SETTINGS` for settings. Network has no default, so you must set one. The docstring of each
`Operation` member lists the builder parameters it needs and the type it returns. A missing required parameter
fails before any request is made.

The typed models (`ChatMessageResponse`, `RagQueryResponse`, `SettingsResponse`, ...) are frozen dataclasses. Their
attributes are the snake_case form of the JSON fields (`total_ms`, `last_updated`), and their timestamps are
`datetime` objects. Calls without a typed model return the parsed JSON, whose keys stay camelCase as the service
sends them.

### Chat

```python
# list the tenant's memory subjects
subjects = (MnemoChatClient.Builder()
    .api_key(key).tenant_id("acme")
    .operation(MnemoChatClient.Operation.LIST_SUBJECTS)
    .build().execute())

# delete a session for good
(MnemoChatClient.Builder()
    .api_key(key).tenant_id("acme").session_id("session-1")
    .operation(MnemoChatClient.Operation.CLOSE_SESSION).permanent(True)
    .build().execute())
```

### MnemoRAG

```python
answer = (MnemoRAGClient.Builder()
    .api_key(key)
    .rag_id("support-kb")
    .query("What is the refund window for annual plans?")
    .build().execute())

if answer.found:
    print(f"{answer.answer} (confidence {answer.confidence})")
```

The tenant comes from your API key, so the master key cannot be used here.

### Settings

```python
updated = (MnemoSettingsClient.Builder()
    .api_key(key).account_id("acct-123")
    .operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
    .lookback_days(30)
    .build().execute())
```

Only the settings you set are changed. `provider_api_key(...)` is your own LLM provider key. It is not the same as
`api_key(...)`, which authenticates you to MNEMO.

### Network

```python
(MnemoNetworkClient.Builder()
    .api_key(key).tenant_id("acme")
    .operation(MnemoNetworkClient.Operation.SUBSCRIBE)
    .counterpart_tenant_id("globex").subject("Roadmap")
    .build().execute())
```

`tenant_id` is always the tenant making the call; `counterpart_tenant_id` is the other party.

## Error handling

All failures are raised as `MnemoClientException`.

```python
from mnemo_client import MnemoClientException, MnemoError

try:
    reply = client.execute()
except MnemoClientException as e:
    if e.error.code is MnemoError.Code.UNAUTHORIZED:     # HTTP 401
        refresh_key()
    elif e.error.code is MnemoError.Code.RATE_LIMITED:   # HTTP 429, quota or rate limit
        back_off()
    elif e.error.code is MnemoError.Code.FORBIDDEN:      # HTTP 403
        upgrade_plan_or_fix_tenant()
    else:
        log.error("MNEMO call failed (%s): %s", e.http_status, e)
```

`http_status` is the HTTP status, or `0` when no response arrived. `str(e)` carries the service's own explanation
when it sent one. `e.error.code.code` is the stable `MNERR-xxxx` identifier.

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
PYTHONPATH=src:tests python3 -m unittest discover -s tests   # unit tests, no network needed
```

The unit tests use only the standard library. They run the real client against an in-process HTTP server.

## License

Apache License 2.0. See [LICENSE](LICENSE).
