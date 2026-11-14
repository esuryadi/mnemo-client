# Changelog

## 1.2.0 (2026-11-14)

- **Embeddable chat.** `<mnemo-chat>`: one script tag and one element put a MNEMO chat in your own web page. The component is bundled in all three packages (`embed/mnemo-chat.js`; the npm package also serves it through jsDelivr).
- `MnemoEmbedClient` (`MINT_TOKEN`) mints a short-lived, origin-bound embed token on your server; `EmbedTokenEndpoint` and `EmbedSnippet` (Java, TypeScript, Python) are the two helpers every integration needs. Needs a MNEMO backend with embed tokens.
- `MnemoChatClient.Operation.CHAT_STREAM`: streaming chat (`POST mnemo/chat/stream`) as events arrive (Java callback, TypeScript async iterable, Python generator).
- `embedToken(...)` on every builder: a third credential, exclusive with `apiKey` and `clientCredentials`. TypeScript refuses an API key in a browser unless `allowApiKeyInBrowser(true)`.
- Python parses service timestamps with nanoseconds on Python < 3.11.

## 1.1.0

OAuth client credentials as an alternative to an API key.

## 1.0.0

First stable release of the Java, TypeScript and Python clients.
