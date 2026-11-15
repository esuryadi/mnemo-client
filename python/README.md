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

From [PyPI](https://pypi.org/project/mnemo-client/):

```sh
pip install mnemo-client
# or
uv add mnemo-client
poetry add mnemo-client
```

To pin a version, put `mnemo-client==1.2.0` in `requirements.txt` (or `mnemo-client>=1.2,<2` to take compatible
updates). The package has no dependencies outside the standard library.

The package you install is `mnemo-client`, with a dash; the module you import is `mnemo_client`, with an underscore:

```python
from mnemo_client import MnemoChatClient, MnemoClientException
```

- **Python 3.9 or newer.**
- **Typed**: the package ships `py.typed`, so mypy and Pyright check your calls against it with no stub package.
- To check the installed version: `python -c "import mnemo_client; print(mnemo_client.__version__)"`.

Releases are uploaded from GitHub Actions through PyPI trusted publishing. Each file carries a provenance
attestation, shown on its page on pypi.org, that ties it to this repository.

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

## Embed a chat in your web app

`<mnemo-chat>` puts a MNEMO chat in your own page with one script tag and one element. The page never holds an API key: your server uses this library to mint a **short-lived embed token** (15 minutes, one allowed origin, chat only) and hands it to the component.

```
 visitor's browser                  your server (Python)              MNEMO
 ┌─────────────────┐  GET /embed-token ┌──────────────────┐  POST mnemo/embed/token  ┌──────┐
 │  <mnemo-chat>   │ ────────────────▶ │ EmbedTokenEndpoint│ ───────────────────────▶ │ API  │
 │                 │ ◀──────────────── │ (your API key)    │ ◀─────────────────────── │      │
 │                 │   embed token     └──────────────────┘      embed token         │      │
 │                 │ ───────── chat with the embed token, from your origin ─────────▶ │      │
 └─────────────────┘                                                                  └──────┘
```

**1. Mint the token (server side).** The view behind the `token-url` (Flask shown; Django and the standard library are in `examples/`). Put your sign-in check in front of it and pass your signed-in user's id:

<!-- example: python/examples/flask_example.py -->
```python
def _template() -> MnemoEmbedClient.Builder:
    """A fresh builder per request, so concurrent requests never share one."""
    builder = MnemoEmbedClient.Builder() \
        .api_key(os.environ["MNEMO_API_KEY"]) \
        .tenant_id(os.environ["MNEMO_TENANT_ID"]) \
        .allowed_origin(os.environ["MNEMO_ALLOWED_ORIGIN"])
    if os.environ.get("MNEMO_BASE_URL"):
        builder.base_url(os.environ["MNEMO_BASE_URL"])
    return builder
```

<!-- example: python/examples/flask_example.py -->
```python
def embed_token(signed_in_user_id: Optional[str]) -> Tuple[str, int, Dict[str, str]]:
    """The view behind ``token-url``. ``signed_in_user_id`` is ``None`` when the visitor is not signed in, which is
    refused: this endpoint hands out a credential, so it must sit behind your own login."""
    if signed_in_user_id is None:
        return json.dumps({"error": "sign in first"}), 401, JSON_HEADERS
    try:
        return EmbedTokenEndpoint.handle(_template, signed_in_user_id), 200, JSON_HEADERS
    except MnemoClientException:
        return json.dumps({"error": "could not get a chat token"}), 502, JSON_HEADERS
```

**2. Render the page.** `EmbedSnippet.render` escapes every attribute and gives you the two lines to put in your HTML:

<!-- example: python/examples/flask_example.py -->
```python
def chat_page() -> str:
    """A page that embeds the component."""
    return "<!doctype html><title>Chat</title>" + EmbedSnippet.render(
        EmbedSnippet.Options(token_url="/mnemo/embed-token", width="50%", height="600"))
```

That produces:

```html
<script src="https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@1.2.0/embed/mnemo-chat.js" async></script>
<mnemo-chat token-url="/mnemo/embed-token" width="50%" height="600"></mnemo-chat>
```

To serve the script yourself instead of from the CDN, return `bundled_script()` (from `mnemo_client.embed_helpers`; the same file, shipped in this package) with content type `text/javascript` and pass its URL as `EmbedSnippet.Options(token_url=..., script_url="/assets/mnemo-chat.js")`. Flask, Django and `http.server` versions of the whole integration are in `examples/`, and a test imports and runs each one.

If you want to call MNEMO yourself, a streaming chat is `MnemoChatClient.Operation.CHAT_STREAM` (a generator of events), and `.embed_token("...")` on a builder authenticates with an embed token (exclusive with `api_key` and `client_credentials`).

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
