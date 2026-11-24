# Changelog

## 2.0.0 (2026-11-24)

Breaking: the client libraries now cover the data plane of the MNEMO API only. Configuration and governance live in Dorothy and are no longer reachable with an API key or an OAuth client-credentials token (the service answers 403), so the calls that exercised them were removed in Java, TypeScript and Python.

- **Removed `MnemoNetworkClient`** (knowledge sharing: private grants, public publishing, subscriptions, affiliations, tenant search) and its operations, builder parameters and tests. Knowledge sharing is managed in Dorothy.
- **Removed `MnemoSettingsClient`** and the `SettingsResponse` model (account settings and their options). Settings are managed in Dorothy.
- **Removed `MnemoChatClient.Operation.RENAME_SESSION`**. Renaming a session is a Dorothy feature; `sessionName` is still accepted by `INIT_SESSION`.
- The client libraries never had RAG configuration management, OCR or notifications helpers, so nothing was removed there: `MnemoRAGClient` keeps `QUERY` (create the configuration in Dorothy and pass its id).
- Kept: chat and chat streaming, sessions (init, list, history, close), subjects, plan, health, MnemoRAG queries, the embed helpers and `MnemoEmbedClient`, and `clientCredentials` (the OAuth client-credentials exchange at `/oauth/token`, now documented in the API reference).
- The bundled `mnemo-chat.js` is rebuilt without the removed operation (the same file in all three packages).
- Migration: delete the calls to `MnemoNetworkClient`, `MnemoSettingsClient` and `RENAME_SESSION`; use Dorothy for those tasks. Version 1.x clients keep working for the data plane; their Network and Settings calls start returning 403 once the service change is live.

## 1.2.0 (2026-11-14)

- **Embeddable chat.** `<mnemo-chat>`: one script tag and one element put a MNEMO chat in your own web page. The component is bundled in all three packages (`embed/mnemo-chat.js`; the npm package also serves it through jsDelivr).
- `MnemoEmbedClient` (`MINT_TOKEN`) mints a short-lived, origin-bound embed token on your server; `EmbedTokenEndpoint` and `EmbedSnippet` (Java, TypeScript, Python) are the two helpers every integration needs. Needs a MNEMO backend with embed tokens.
- `MnemoChatClient.Operation.CHAT_STREAM`: streaming chat (`POST mnemo/chat/stream`) as events arrive (Java callback, TypeScript async iterable, Python generator).
- `embedToken(...)` on every builder: a third credential, exclusive with `apiKey` and `clientCredentials`. TypeScript refuses an API key in a browser unless `allowApiKeyInBrowser(true)`.
- `RagQueryResponse.reason`: the optional reason a MnemoRAG answer was not found (`OUT_OF_SCOPE`, `NOT_IN_MEMORY`, ...), absent when found.
- Python parses service timestamps with nanoseconds on Python < 3.11.

## 1.1.0

OAuth client credentials as an alternative to an API key.

## 1.0.0

First stable release of the Java, TypeScript and Python clients.
