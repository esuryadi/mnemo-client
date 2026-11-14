#!/usr/bin/env python3
"""Release gate for the three clients (Java, TypeScript, Python): one version, one bundled mnemo-chat.js, and the
same embed API paths asserted by each language's tests. Exit 0 only when all agree. Run from anywhere:
    python3 scripts/check-parity.py
"""
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
problems = []


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


# 1. one version
java = re.search(r"<version>([^<]+)</version>", read("java/pom.xml").split("<dependencies>")[0]).group(1)
ts = json.loads(read("typescript/package.json"))["version"]
py = re.search(r'__version__ = "([^"]+)"', read("python/src/mnemo_client/__init__.py")).group(1)
consts = {
    "MnemoClientVersion.java": re.search(r'VERSION = "([^"]+)"', read("java/src/main/java/com/panaxon/ai/MnemoClientVersion.java")).group(1),
    "version.ts": re.search(r'CLIENT_VERSION = "([^"]+)"', read("typescript/src/version.ts")).group(1),
}
versions = {"java/pom.xml": java, "typescript/package.json": ts, "python __version__": py, **consts}
if len(set(versions.values())) != 1:
    problems.append(f"versions differ: {versions}")
print("version:", versions)

# 2. one bundled script
digests = {}
for name, p in (("typescript/embed", "typescript/embed/mnemo-chat.js"), ("java resource", "java/src/main/resources/embed/mnemo-chat.js"),
                ("python package data", "python/src/mnemo_client/embed/mnemo-chat.js")):
    digests[name] = hashlib.sha256((ROOT / p).read_bytes()).hexdigest()
if len(set(digests.values())) != 1:
    problems.append(f"mnemo-chat.js differs: {digests}")
print("mnemo-chat.js sha256:", set(digests.values()))

# 3. the embed paths each language's tests assert
PATH = re.compile(r"""["'`/](mnemo/(?:embed/token|chat/stream|init/stream|sessions/[^"'`?\s]*history))""")
files = {
    "java": list((ROOT / "java/src/test").rglob("*Embed*.java")) + list((ROOT / "java/src/test").rglob("MnemoChatStreamTest.java")) + [ROOT / "java/src/test/java/com/panaxon/ai/MnemoChatClientTest.java"],
    "typescript": list((ROOT / "typescript/test").glob("*Embed*.ts")) + [ROOT / "typescript/test/MnemoChatStream.test.ts", ROOT / "typescript/test/MnemoChatClient.test.ts"],
    "python": list((ROOT / "python/tests").glob("test_embed*.py")) + [ROOT / "python/tests/test_chat_stream.py", ROOT / "python/tests/test_chat.py"],
}
paths = {}
for lang, fs in files.items():
    found = set()
    for f in fs:
        for m in PATH.finditer(f.read_text(encoding="utf-8")):
            found.add(re.sub(r"sessions/[^/]+/history", "sessions/{id}/history", m.group(1)))
    paths[lang] = found
base = paths["typescript"]
for lang, found in paths.items():
    if found != base:
        problems.append(f"{lang} tests assert different embed paths: only here {sorted(found - base)}, missing {sorted(base - found)}")
print("embed paths asserted:", sorted(base))
required = {"mnemo/embed/token", "mnemo/chat/stream"}
if not required <= base:
    problems.append(f"the tests must assert at least {sorted(required)}")

# 4. every README code sample marked "<!-- example: path -->" is a verbatim excerpt of that example file
MARK = re.compile(r"<!-- example: (\S+) -->\n```\w*\n(.*?)\n```", re.S)
for readme in ("java/README.md", "python/README.md", "typescript/README.md"):
    for m in MARK.finditer(read(readme)):
        example, code = m.group(1), m.group(2)
        src = [l.strip() for l in read(example).split("\n")]
        want = [l.strip() for l in code.split("\n")]
        if not any(src[i:i + len(want)] == want for i in range(len(src) - len(want) + 1)):
            problems.append(f"{readme}: the sample for {example} is not a verbatim excerpt (first line: {want[0][:60]!r})")
print("README samples checked")

if problems:
    print("PARITY FAILED:\n  " + "\n  ".join(problems))
    sys.exit(1)
print("PARITY OK")
