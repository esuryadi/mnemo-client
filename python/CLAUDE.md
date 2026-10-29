# CLAUDE.md — Python client (`python/`)

The repo-wide rules (the client pattern, conventions, backend facts) are in `../CLAUDE.md`. This file is only what
differs for Python.

## Commands (run from `python/`)

- `PYTHONPATH=src:tests python3 -m unittest discover -s tests` — unit tests, stdlib only, no network. Read
  `Ran N tests` and check that N > 0.
- Run the suite under both `/usr/bin/python3` (3.9, the oldest supported version) and a current Python.
  `requires-python = ">=3.9"` is a promise, so keep the code 3.9-safe: `from __future__ import annotations`, no
  `match`, and no `dataclass(kw_only=…/slots=…)`.

## How the Java pattern maps

- `MnemoXxxClient(MnemoClient)` with nested `Operation(Enum)` and `Builder(MnemoClientBuilder)` classes. The
  implementation is `_xxx_impl.MnemoXxxClientImpl`, imported lazily inside `Builder.build()` to break the import
  cycle.
- Setters are public, snake_case and fluent (`.session_id(...)`). Builder state is held in `_snake_case`
  attributes, which the Impl reads directly. That is the stand-in for Java's package-private getters.
- `execute()` builds a `dict` from `Operation` to a private method, and dispatches through it. Python 3.9 has no
  `match`. A new operation needs its entry in that dict.
- Typed models are frozen dataclasses with a `from_dict` that maps camelCase JSON to snake_case. A
  `from_dict` that fails becomes `SERIALIZATION_ERROR`. Untyped calls return the parsed JSON unchanged, so their
  keys stay camelCase.
- `_require(value, "session_id")` names the snake_case builder method in the error message (Java and TS name the
  camelCase one); the wire field names in `_body`/`_query` stay camelCase.
- `MnemoError.Code` members carry `(code, default_message)`; `.code` is the `MNERR-xxxx` string.

## Gotchas

- `str(True)` is `"True"`, but the service expects `true`. `_query` lowercases booleans: keep every query value
  going through it.
- `urllib.parse.quote` keeps `/` unless you pass `safe=""`. `_path` and `_query` pass it. Do the same anywhere new.
- `urllib` raises `HTTPError` for a status of 400 or above. `_request` catches it before the generic
  `URLError`/`OSError` branch (it is a subclass of `URLError`).
- `datetime.fromisoformat` only accepts a trailing `Z` from Python 3.11 onwards. Use `model._instant`.
- Test server: `HTTPServer.server_bind` calls `socket.getfqdn()`, which stalled for about 35s per run on this Mac.
  `tests/fake_server.py` overrides it, so keep that override.
- Not published to PyPI yet. `mnemo-client` is a placeholder distribution name: check that it is available before
  the first upload.
