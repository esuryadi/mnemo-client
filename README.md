# mnemo-client
M.N.E.M.O. API public client library to communicate with Mnemo API 

## Clients

| Language | Status | Docs |
|---|---|---|
| Java | Available on Maven Central | [java/README.md](java/README.md) |
| Python | Available on PyPI (`mnemo-client`) | [python/README.md](python/README.md) |
| TypeScript | Available on npm (`@panaxon/mnemo-client`) | [typescript/README.md](typescript/README.md) |

## Authentication

Every client authenticates in one of two ways. Use one, not both:

- **API key:** create one in Dorothy under Security, API Keys. Pass it with `apiKey(...)` (`api_key(...)` in Python).
- **OAuth client:** create one in Dorothy under Security, OAuth Clients, and pass its ID and secret with
  `clientCredentials(clientId, clientSecret)` (`client_credentials(...)` in Python). The client exchanges them for a
  one-hour bearer token, reuses it and renews it before it expires. Available from version 1.1.0.

API keys keep working; an OAuth client is an alternative, not a replacement. Examples are in each language's README.

## Using MNEMO from Claude

No client library needed: add `https://mnemo-mcp.panaxon.ai/api/mcp` as a custom connector in Claude (web,
desktop or mobile), sign in to MNEMO and click Allow. Claude Code can use the same URL with an API key. Setup
steps are in the MNEMO Help (MCP tab) and FAQ.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
