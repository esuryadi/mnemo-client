#!/usr/bin/env bash
# Checks that a released @panaxon/mnemo-client works for anybody: installs it from the real npm registry into an
# EMPTY project with an empty cache (so nothing on this machine can mask a problem), checks the package files and its
# registry signature and provenance, then type-checks and runs SmokeTest.ts against it.
#
#   ./verify-npm.sh 1.0.0            # version to check (default: the version in ../package.json)
#   ./verify-npm.sh 1.0.0 --wait     # keep retrying for up to 30 minutes while the registry catches up
#
# Needs: node 18+, npm, curl. Optional: MNEMO_API_KEY, MNEMO_BASE_URL.
set -uo pipefail
cd "$(dirname "$0")"

NAME="${NAME:-@panaxon/mnemo-client}"  # overridable only to test this script itself
VERSION="${1:-$(node -p 'require("../package.json").version')}"
WAIT=false; [ "${2:-}" = "--wait" ] && WAIT=true
URL="https://registry.npmjs.org/$(echo "$NAME" | sed 's|/|%2f|')/$VERSION"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
export npm_config_cache="$WORK/npm-cache" npm_config_userconfig="$WORK/npmrc" npm_config_fund=false npm_config_update_notifier=false
fail=0
ok()  { echo "  ok    $1"; }
bad() { echo "  FAIL  $1"; fail=1; }

echo "== Checking $NAME@$VERSION on npm"
deadline=$(( $(date +%s) + 1800 ))
# wait for the package document that `npm install` reads, not just the version URL: right after a first release the
# registry's CDN can serve the version while still answering 404 for the package
listed() {
  curl -s "${URL%/*}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.exit(JSON.parse(s).versions?.[process.argv[1]]?0:1)}catch{process.exit(1)}})' "$VERSION"
}
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" = "200" ] && listed; do
  if ! $WAIT || [ "$(date +%s)" -gt "$deadline" ]; then
    echo "  $NAME@$VERSION is not on the registry ($URL); rerun with --wait to keep trying."; exit 2
  fi
  echo "  not there yet, retrying in 30s..."; sleep 30
done

echo "== Installing it into an empty project"
cd "$WORK" && npm init -y >/dev/null && npm pkg set type=module >/dev/null
if npm install --no-audit "$NAME@$VERSION" typescript@7 @types/node >"$WORK/install.log" 2>&1; then
  ok "npm installed $NAME@$VERSION"
else
  bad "npm could not install it: $(tail -3 "$WORK/install.log")"; echo; echo "RESULT: problems found"; exit 1
fi

PKG="node_modules/$NAME"
for f in package.json README.md LICENSE dist/index.js dist/index.d.ts; do
  [ -f "$PKG/$f" ] && ok "$f" || bad "$f is missing from the package"
done
[ -z "$(ls "$PKG" | grep -vE '^(dist|package\.json|README\.md|LICENSE)$')" ] && ok "nothing else is shipped" \
  || bad "unexpected files in the package: $(ls "$PKG" | tr '\n' ' ')"

echo "== Registry signature and provenance"
SIG="$(npm audit signatures 2>&1)"
echo "$SIG" | grep -qE 'verified registry signature' && ok "registry signature verifies" || bad "registry signature: $SIG"
echo "$SIG" | grep -qiE 'invalid|missing' && bad "npm audit signatures reported a problem: $SIG"
# the audit counts every installed package, so look at this version's own provenance in the registry
PROV="$(curl -s "$URL" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).dist?.attestations;console.log(a?.provenance?.predicateType??"")})')"
case "$PROV" in *slsa.dev/provenance*) ok "has a provenance attestation ($PROV)";;
  *) bad "no provenance attestation (was it published without --provenance, or from a laptop?)";; esac

echo "== Using it from a fresh project (Node $(node --version))"
cp "$OLDPWD/SmokeTest.ts" .
cat > tsconfig.json <<'EOF'
{ "compilerOptions": { "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext", "strict": true,
                       "skipLibCheck": false, "types": ["node"], "outDir": "out" },
  "files": ["SmokeTest.ts"] }
EOF
if npx tsc -p tsconfig.json >"$WORK/tsc.log" 2>&1; then
  ok "SmokeTest compiles against the published types (skipLibCheck off)"
  node out/SmokeTest.js; [ $? = 0 ] && ok "SmokeTest ran" || bad "SmokeTest failed"
else bad "SmokeTest does not compile: $(head -5 "$WORK/tsc.log")"; fi

echo
[ "$fail" = "0" ] && echo "RESULT: $NAME@$VERSION works from npm" || echo "RESULT: problems found (see FAIL lines above)"
exit "$fail"
