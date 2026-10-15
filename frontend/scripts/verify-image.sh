#!/bin/sh
# Verifies the production image of the frontend: SPA serving, hardening headers, caching, the /api proxy
# (prefix preserved, Origin forwarded) and that it runs as a non-root user. Needs Docker; run from anywhere:
#   bash frontend/scripts/verify-image.sh
# Exits non-zero on the first failed assertion. Everything it starts is removed on exit.
set -eu

cd "$(dirname "$0")/../.."

IMAGE="${IMAGE:-eg-frontend:verify}"
PORT="${PORT:-18080}"
RUN_ID="$$"
NET="eg-verify-net-$RUN_ID"
UPSTREAM="eg-verify-upstream-$RUN_ID"
WEB="eg-verify-web-$RUN_ID"
BASE="http://127.0.0.1:$PORT"

cleanup() {
  docker rm -f "$WEB" "$UPSTREAM" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

ok() {
  echo "ok: $1"
}

# header NAME URL [curl args...]  -> prints the value of response header NAME (case-insensitive), empty if absent
header() {
  name="$1"
  url="$2"
  shift 2
  curl -s -D - -o /dev/null "$@" "$url" | tr -d '\r' | grep -i "^$name:" | head -n 1 | sed "s/^[^:]*: *//" || true
}

status() {
  url="$1"
  shift
  curl -s -o /dev/null -w '%{http_code}' "$@" "$url"
}

EXPECTED_CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

echo "== build"
docker build -f frontend/Dockerfile -t "$IMAGE" .

echo "== start (stub upstream + image)"
docker network create "$NET" >/dev/null
docker run -d --name "$UPSTREAM" --network "$NET" --network-alias upstream node:22-alpine node -e "
require('http').createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ path: req.url, method: req.method, origin: req.headers.origin || null, host: req.headers.host || null }));
}).listen(3000);
" >/dev/null
docker run -d --name "$WEB" --network "$NET" -e BACKEND_URL=http://upstream:3000 -p "127.0.0.1:$PORT:8080" "$IMAGE" >/dev/null

i=0
until [ "$(status "$BASE/healthz" || true)" = "200" ]; do
  i=$((i + 1))
  [ "$i" -gt 40 ] && { docker logs "$WEB" >&2 || true; fail "image did not become healthy"; }
  sleep 1
done
ok "GET /healthz is 200"

echo "== SPA serving"
[ "$(status "$BASE/")" = "200" ] || fail "GET / is not 200"
curl -s "$BASE/" | grep -qi '<div id="root">' || fail "GET / is not the SPA shell"
ok "GET / serves the SPA shell"
[ "$(status "$BASE/signin")" = "200" ] || fail "GET /signin (SPA fallback) is not 200"
curl -s "$BASE/signin" | grep -qi '<div id="root">' || fail "GET /signin is not the SPA shell"
ok "GET /signin falls back to index.html"
[ "$(status "$BASE/assets/does-not-exist.js")" = "404" ] || fail "a missing asset must be 404, not the SPA shell"
ok "missing /assets file is 404"

echo "== hardening headers"
for path in / /signin; do
  [ "$(header content-security-policy "$BASE$path")" = "$EXPECTED_CSP" ] || fail "CSP on $path differs from the expected policy"
  [ "$(header x-content-type-options "$BASE$path")" = "nosniff" ] || fail "X-Content-Type-Options on $path"
  [ "$(header x-frame-options "$BASE$path")" = "DENY" ] || fail "X-Frame-Options on $path"
  [ -n "$(header referrer-policy "$BASE$path")" ] || fail "Referrer-Policy on $path"
  [ -n "$(header permissions-policy "$BASE$path")" ] || fail "Permissions-Policy on $path"
  [ "$(header cross-origin-opener-policy "$BASE$path")" = "same-origin" ] || fail "Cross-Origin-Opener-Policy on $path"
done
ok "SPA responses carry CSP (no unsafe-inline) and the other hardening headers"
echo "$EXPECTED_CSP" | grep -q "unsafe-inline" && fail "expected CSP must not contain unsafe-inline"
[ "$(header server "$BASE/")" = "nginx" ] || fail "Server header must be exactly 'nginx' (no version)"
ok "Server header hides the version"

echo "== caching"
ASSET="$(curl -s "$BASE/" | grep -o '/assets/[^"]*\.js' | head -n 1)"
[ -n "$ASSET" ] || fail "could not find a hashed JS asset in index.html"
header cache-control "$BASE$ASSET" | grep -q "immutable" || fail "hashed asset must be immutable"
[ "$(header content-security-policy "$BASE$ASSET")" = "$EXPECTED_CSP" ] || fail "assets must carry the security headers too (add_header inheritance)"
header cache-control "$BASE/" | grep -q "no-cache" || fail "index.html must be no-cache"
ok "hashed assets are immutable, index.html is no-cache, headers survive per-location add_header"

echo "== /api proxy"
BODY="$(curl -s -X POST -H 'Origin: http://localhost:8080' -H 'Content-Type: application/json' -d '{}' "$BASE/api/auth/signin")"
echo "$BODY" | grep -q '"path":"/api/auth/signin"' || fail "the /api prefix was not preserved (upstream saw: $BODY)"
echo "$BODY" | grep -q '"origin":"http://localhost:8080"' || fail "the Origin header was not forwarded unchanged (upstream saw: $BODY)"
ok "POST /api/auth/signin reaches the upstream with its prefix and Origin intact"
[ -z "$(header content-security-policy "$BASE/api/health")" ] || fail "the SPA CSP must not be added to /api responses"
ok "/api responses keep the backend's own headers"
[ "$(curl -s "$BASE/api/health" | grep -c '"path":"/api/health"')" = "1" ] || fail "GET /api/health did not reach the upstream intact"

echo "== runtime user"
[ "$(docker exec "$WEB" id -u)" != "0" ] || fail "the container runs as root"
ok "container runs as a non-root user"

echo "ALL CHECKS PASSED"
