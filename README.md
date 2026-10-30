# mnemo-client
M.N.E.M.O. API public client library to communicate with Mnemo API 

## Clients

| Language | Status | Docs |
|---|---|---|
| Java | Available on Maven Central | [java/README.md](java/README.md) |
| Python | Available on PyPI (`mnemo-client`) | [python/README.md](python/README.md) |
| TypeScript | Available on npm (`@panaxon/mnemo-client`) | [typescript/README.md](typescript/README.md) |

All three share one version number, so the same version gives you the same operations in every language.

## Install

**Java** (17+), from Maven Central:

```xml
<dependency>
    <groupId>ai.panaxon</groupId>
    <artifactId>mnemo-client</artifactId>
    <version>1.1.0</version>
</dependency>
```

or with Gradle: `implementation("ai.panaxon:mnemo-client:1.1.0")`

**TypeScript / JavaScript** (Node 18+), from npm:

```sh
npm install @panaxon/mnemo-client     # or: yarn add / pnpm add @panaxon/mnemo-client
```

```ts
import { MnemoChatClient } from "@panaxon/mnemo-client";
```

**Python** (3.9+), from PyPI. You install `mnemo-client` and import `mnemo_client`:

```sh
pip install mnemo-client              # or: uv add mnemo-client / poetry add mnemo-client
```

```python
from mnemo_client import MnemoChatClient
```

The TypeScript and Python clients have no runtime dependencies. Usage, operations and error handling are in each
language's README.

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
