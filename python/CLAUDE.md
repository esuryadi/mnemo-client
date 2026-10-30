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
- The version lives only in `__version__` (`src/mnemo_client/__init__.py`); `pyproject.toml` reads it with
  `dynamic = ["version"]`. Do not add a `version =` to `pyproject.toml`.
- `LICENSE` here is a copy of the repo root's: setuptools refuses license files outside the project directory.
  `MANIFEST.in` puts `tests/fake_server.py` in the sdist, which setuptools would otherwise leave out (it only picks
  up `test_*.py`), so the sdist's tests can run.
- `license = "Apache-2.0"` is an SPDX expression, which needs setuptools 77+. Do not add a `License ::` classifier
  next to it: setuptools rejects the pair.
- The README is the project page on pypi.org, where relative links outside `python/` break: link the rest of the
  repo with absolute GitHub URLs.

## Release (PyPI, `mnemo-client`)

Released by hand from GitHub: Actions -> "Publish Python client" -> Run workflow (`dry_run`
first; `index: testpypi` rehearses the upload on test.pypi.org). `.github/workflows/python-publish.yml` has the
details. It runs the tests on 3.9 and 3.14, builds the sdist and wheel, runs `twine check --strict` and installs the
wheel, and refuses a version already on the index. PyPI never accepts a version twice (not even after a delete), so a
real run is **irreversible**: bump `__version__` first.

One-time setup, done by a maintainer: an account with two-factor authentication on pypi.org (and separately on
test.pypi.org), then Account -> Publishing -> Add a new pending publisher -> GitHub: project `mnemo-client`, owner
`esuryadi`, repository `mnemo-client`, workflow `python-publish.yml`, environment `pypi` (`testpypi` on TestPyPI).
That is trusted publishing: no token is stored anywhere, and every upload gets a provenance attestation.

After every release, run `smoke-test/verify-pypi.sh <version> --wait` (add `--test-pypi` for TestPyPI). It installs
the release from the real index into an empty virtual environment with no pip cache, checks the files, the
attestations, `py.typed` and `__version__`, then runs `smoke_test.py` (a health check and a bad-key 401, neither of
which costs LLM budget). `PYTHON=/usr/bin/python3` checks it on 3.9. `PYTHON=/opt/homebrew/bin/python3.14` checks a current one.

`1.1.0` is the first release (2026-10-30, trusted publishing, attestations on both files, verified with the script
on 3.9 and 3.14).
