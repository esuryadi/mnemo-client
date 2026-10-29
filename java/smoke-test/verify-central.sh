#!/usr/bin/env bash
# Checks that a released mnemo-client works for anybody: downloads it from the real Maven Central into an EMPTY local
# repository (so nothing on this machine can mask a problem), verifies the files and the GPG signatures, then compiles
# and runs SmokeTest against it.
#
#   ./verify-central.sh 0.1.0            # version to check (default: the smoke-test pom's mnemo.version)
#   ./verify-central.sh 0.1.0 --wait     # keep retrying for up to 2 hours while Central syndicates a new release
#
# Needs: mvn, curl, gpg, a JDK 17+. Optional: MNEMO_API_KEY, MNEMO_BASE_URL.
set -uo pipefail
cd "$(dirname "$0")"

GROUP_PATH="${GROUP_PATH:-ai/panaxon}"; ARTIFACT="${ARTIFACT:-mnemo-client}"  # overridable only to test this script itself
VERSION="${1:-$(sed -n 's:.*<mnemo.version>\(.*\)</mnemo.version>.*:\1:p' pom.xml)}"
WAIT=false; [ "${2:-}" = "--wait" ] && WAIT=true
BASE="https://repo.maven.apache.org/maven2/$GROUP_PATH/$ARTIFACT/$VERSION"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
fail=0
ok()  { echo "  ok    $1"; }
bad() { echo "  FAIL  $1"; fail=1; }

echo "== Checking ai.panaxon:$ARTIFACT:$VERSION on Maven Central"
deadline=$(( $(date +%s) + 7200 ))
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$ARTIFACT-$VERSION.pom")" = "200" ]; do
  if ! $WAIT || [ "$(date +%s)" -gt "$deadline" ]; then
    echo "  The pom is not on Central yet ($BASE). A new release can take from minutes to a couple of hours to appear;"
    echo "  rerun with --wait to keep trying."; exit 2
  fi
  echo "  not there yet, retrying in 60s..."; sleep 60
done

echo "== Files published with the release"
for f in "$ARTIFACT-$VERSION.pom" "$ARTIFACT-$VERSION.jar" "$ARTIFACT-$VERSION-sources.jar" "$ARTIFACT-$VERSION-javadoc.jar"; do
  curl -sf -o "$WORK/$f" "$BASE/$f" && ok "$f" || bad "$f is missing"
  curl -sf -o "$WORK/$f.asc" "$BASE/$f.asc" && ok "$f.asc (signature)" || bad "$f.asc is missing"
  want=$(curl -sf "$BASE/$f.sha1") && got=$(shasum -a 1 "$WORK/$f" 2>/dev/null | cut -d' ' -f1)
  [ -n "${want:-}" ] && [ "${want%% *}" = "$got" ] && ok "$f sha1 matches" || bad "$f sha1 does not match"
done

echo "== GPG signatures verify against the key on a public keyserver"
export GNUPGHOME="$WORK/gnupg"; mkdir -m 700 "$GNUPGHOME"
SIGPKT=$(gpg --list-packets "$WORK/$ARTIFACT-$VERSION.jar.asc" 2>/dev/null)
# prefer the full fingerprint: some keyservers (keyserver.ubuntu.com) answer a lookup by it but not by the short key id
KEYID=$(echo "$SIGPKT" | sed -n 's/.*issuer fpr v4 \([0-9A-F]*\).*/\1/p' | head -1)
[ -z "$KEYID" ] && KEYID=$(echo "$SIGPKT" | sed -n 's/.*keyid \([0-9A-F]*\).*/\1/p' | head -1)
echo "  signed with key: ${KEYID:-unknown}"
FETCHED=false
for ks in hkps://keys.openpgp.org hkps://keyserver.ubuntu.com; do
  if [ -n "$KEYID" ] && gpg --batch --keyserver "$ks" --recv-keys "$KEYID" >/dev/null 2>&1; then FETCHED=true; echo "  fetched the public key from ${ks#hkps://}"; break; fi
done
if $FETCHED; then
  for f in "$ARTIFACT-$VERSION.pom" "$ARTIFACT-$VERSION.jar" "$ARTIFACT-$VERSION-sources.jar" "$ARTIFACT-$VERSION-javadoc.jar"; do
    gpg --batch --verify "$WORK/$f.asc" "$WORK/$f" >/dev/null 2>&1 && ok "$f signature is good" || bad "$f signature does not verify"
  done
else
  bad "could not fetch the signing key from keys.openpgp.org or keyserver.ubuntu.com (Central requires it to be public)"
fi
unset GNUPGHOME

[ -n "${SKIP_SMOKE:-}" ] && { echo; [ "$fail" = "0" ] && echo "RESULT: file and signature checks passed" || echo "RESULT: problems found"; exit "$fail"; }
echo "== Using it from a fresh project with an empty local repository (Java: $(javac -version 2>&1))"
REPO="$WORK/m2"
if mvn -B -q -Dmaven.repo.local="$REPO" -Dmnemo.version="$VERSION" dependency:build-classpath -Dmdep.outputFile="$WORK/cp.txt" >"$WORK/mvn.log" 2>&1; then
  ok "Maven resolved ai.panaxon:$ARTIFACT:$VERSION and its dependencies from Central"
  mkdir -p "$WORK/out"
  if javac --release 17 -cp "$(cat "$WORK/cp.txt")" -d "$WORK/out" src/main/java/SmokeTest.java 2>"$WORK/javac.log"; then
    ok "SmokeTest compiles against the published API"
    java -cp "$WORK/out:$(cat "$WORK/cp.txt")" SmokeTest 2>&1 | grep -vE '^(SLF4J|WARNING)' && true
    [ "${PIPESTATUS[0]}" = "0" ] && ok "SmokeTest ran" || bad "SmokeTest failed"
  else bad "SmokeTest does not compile: $(head -3 "$WORK/javac.log")"; fi
else bad "Maven could not resolve the artifact: $(tail -3 "$WORK/mvn.log")"; fi

echo
[ "$fail" = "0" ] && echo "RESULT: ai.panaxon:$ARTIFACT:$VERSION works from Maven Central" || echo "RESULT: problems found (see FAIL lines above)"
exit "$fail"
