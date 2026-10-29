#!/usr/bin/env bash
# Checks that a released mnemo-client works for anybody: installs it from the real PyPI into an EMPTY virtual
# environment with no pip cache (so nothing on this machine can mask a problem), checks the files and the release's
# attestations, then runs smoke_test.py against it.
#
#   ./verify-pypi.sh 1.0.0              # version to check (default: __version__ in ../src/mnemo_client/__init__.py)
#   ./verify-pypi.sh 1.0.0 --wait       # keep retrying for up to 30 minutes while the index catches up
#   ./verify-pypi.sh 1.0.0 --test-pypi  # check a release on test.pypi.org instead
#
# Needs: python3 (3.9+; PYTHON=... picks another), curl. Optional: MNEMO_API_KEY, MNEMO_BASE_URL.
set -uo pipefail
cd "$(dirname "$0")"

NAME="${NAME:-mnemo-client}"  # overridable only to test this script itself
PYTHON="${PYTHON:-python3}"
VERSION="${1:-$(sed -n 's/^__version__ = "\(.*\)"/\1/p' ../src/mnemo_client/__init__.py)}"
WAIT=false; HOST=pypi.org
for arg in "${@:2}"; do
  case "$arg" in --wait) WAIT=true;; --test-pypi) HOST=test.pypi.org;; *) echo "unknown option $arg"; exit 2;; esac
done
URL="https://$HOST/pypi/$NAME/$VERSION/json"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
fail=0
ok()  { echo "  ok    $1"; }
bad() { echo "  FAIL  $1"; fail=1; }

echo "== Checking $NAME $VERSION on $HOST"
deadline=$(( $(date +%s) + 1800 ))
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" = "200" ]; do
  if ! $WAIT || [ "$(date +%s)" -gt "$deadline" ]; then
    echo "  $NAME $VERSION is not on $HOST ($URL); rerun with --wait to keep trying."; exit 2
  fi
  echo "  not there yet, retrying in 30s..."; sleep 30
done

echo "== Files published with the release"
curl -s "$URL" > "$WORK/release.json"
FILES="$("$PYTHON" -I -c 'import json,sys; print("\n".join(u["filename"] for u in json.load(open(sys.argv[1]))["urls"]))' "$WORK/release.json")"
SDIST="mnemo_client-$VERSION.tar.gz"; WHEEL="mnemo_client-$VERSION-py3-none-any.whl"
for f in "$SDIST" "$WHEEL"; do echo "$FILES" | grep -qx "$f" && ok "$f" || bad "$f is missing"; done
# trusted publishing attaches a provenance attestation to every file (PEP 740)
for f in "$SDIST" "$WHEEL"; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/vnd.pypi.integrity.v1+json' \
    "https://$HOST/integrity/$NAME/$VERSION/$f/provenance")
  [ "$STATUS" = "200" ] && ok "$f has a provenance attestation" \
    || bad "$f has no provenance attestation (HTTP $STATUS; was it uploaded without trusted publishing?)"
done

echo "== Using it from an empty virtual environment ($("$PYTHON" --version 2>&1))"
"$PYTHON" -m venv "$WORK/venv"
INDEX=(); [ "$HOST" = "test.pypi.org" ] && INDEX=(--index-url https://test.pypi.org/simple/)
if "$WORK/venv/bin/pip" install -q --no-cache-dir --disable-pip-version-check ${INDEX[@]+"${INDEX[@]}"} "$NAME==$VERSION" \
    >"$WORK/pip.log" 2>&1; then
  ok "pip installed $NAME==$VERSION"
  SITE="$("$WORK/venv/bin/python" -I -c 'import mnemo_client, os; print(os.path.dirname(mnemo_client.__file__))')"
  [ -f "$SITE/py.typed" ] && ok "py.typed is installed" || bad "py.typed is missing"
  GOT="$("$WORK/venv/bin/python" -I -c 'import mnemo_client; print(mnemo_client.__version__)')"
  [ "$GOT" = "$VERSION" ] && ok "__version__ is $GOT" || bad "__version__ is $GOT, expected $VERSION"
  (cd "$WORK" && "$WORK/venv/bin/python" -I "$OLDPWD/smoke_test.py"); [ $? = 0 ] && ok "smoke_test.py ran" || bad "smoke_test.py failed"
else bad "pip could not install it: $(tail -3 "$WORK/pip.log")"; fi

echo
[ "$fail" = "0" ] && echo "RESULT: $NAME $VERSION works from $HOST" || echo "RESULT: problems found (see FAIL lines above)"
exit "$fail"
