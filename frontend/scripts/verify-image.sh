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
TRUSTED="eg-verify-web-trusted-$RUN_ID"
BASE="http://127.0.0.1:$PORT"

cleanup() {
  docker rm -f "$WEB" "$TRUSTED" "$UPSTREAM" >/dev/null 2>&1 || true
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
  res.end(JSON.stringify({ path: req.url, method: req.method, origin: req.headers.origin || null, host: req.headers.host || null, xfp: req.headers['x-forwarded-proto'] || null, xff: req.headers['x-forwarded-for'] || null, xfh: req.headers['x-forwarded-host'] || null }));
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

echo "== forwarded headers: edge mode (default): nginx is the first proxy, nothing from the client is trusted"
# upstream_sees BASE [curl header args...] -> the JSON the stub upstream received for a POST through nginx
upstream_sees() {
  base="$1"
  shift
  curl -s -X POST -H 'Content-Type: application/json' -d '{}' "$@" "$base/api/auth/signin"
}
BODY="$(upstream_sees "$BASE")"
echo "$BODY" | grep -q '"xfp":"http"' || fail "edge: without a forwarded proto nginx must report its own scheme (upstream saw: $BODY)"
echo "$BODY" | grep -Eq '"xff":"[0-9a-f.:]+"' || fail "edge: X-Forwarded-For must be exactly the peer address (upstream saw: $BODY)"
BODY="$(upstream_sees "$BASE" -H 'X-Forwarded-For: 203.0.113.7' -H 'X-Forwarded-For: 198.51.100.9, 192.0.2.1')"
echo "$BODY" | grep -Eq '"xff":"[0-9a-f.:]+"' || fail "edge: a client-supplied X-Forwarded-For must be replaced by the peer address, not appended to (upstream saw: $BODY)"
echo "$BODY" | grep -q '203.0.113.7\|198.51.100.9\|192.0.2.1' && fail "edge: spoofed X-Forwarded-For reached the backend (upstream saw: $BODY)"
ok "edge: a spoofed X-Forwarded-For is replaced by the real peer address"
BODY="$(upstream_sees "$BASE" -H 'X-Forwarded-Proto: https')"
echo "$BODY" | grep -q '"xfp":"http"' || fail "edge: a client-supplied X-Forwarded-Proto: https must not make the backend believe in TLS (upstream saw: $BODY)"
BODY="$(upstream_sees "$BASE" -H 'X-Forwarded-Proto: gopher')"
echo "$BODY" | grep -q '"xfp":"http"' || fail "edge: junk X-Forwarded-Proto must be replaced by nginx's scheme (upstream saw: $BODY)"
ok "edge: a spoofed X-Forwarded-Proto cannot claim https"
BODY="$(upstream_sees "$BASE" -H 'X-Forwarded-Host: evil.example')"
echo "$BODY" | grep -q 'evil.example' && fail "edge: a spoofed X-Forwarded-Host reached the backend (upstream saw: $BODY)"
echo "$BODY" | grep -q '"xfh":"127.0.0.1"' || fail "edge: X-Forwarded-Host must be the Host nginx was asked for (upstream saw: $BODY)"
ok "edge: a spoofed X-Forwarded-Host is replaced by the real host"

echo "== forwarded headers: trusted mode (opt-in, behind a TLS-terminating load balancer)"
TRUSTED_PORT="${TRUSTED_PORT:-18081}"
TBASE="http://127.0.0.1:$TRUSTED_PORT"
docker run -d --name "$TRUSTED" --network "$NET" -e BACKEND_URL=http://upstream:3000 -e FORWARDED_HEADERS_MODE=trusted \
  -p "127.0.0.1:$TRUSTED_PORT:8080" "$IMAGE" >/dev/null
i=0
until [ "$(status "$TBASE/healthz" || true)" = "200" ]; do
  i=$((i + 1))
  [ "$i" -gt 40 ] && { docker logs "$TRUSTED" >&2 || true; fail "trusted-mode image did not become healthy"; }
  sleep 1
done
BODY="$(upstream_sees "$TBASE" -H 'X-Forwarded-For: 203.0.113.7' -H 'X-Forwarded-Proto: https')"
echo "$BODY" | grep -Eq '"xff":"203\.0\.113\.7, [0-9a-f.:]+"' || fail "trusted: the load balancer's X-Forwarded-For must be kept and the peer appended (upstream saw: $BODY)"
echo "$BODY" | grep -q '"xfp":"https"' || fail "trusted: X-Forwarded-Proto: https from the load balancer must reach the backend (upstream saw: $BODY)"
BODY="$(upstream_sees "$TBASE" -H 'X-Forwarded-Proto: gopher')"
echo "$BODY" | grep -q '"xfp":"http"' || fail "trusted: an unexpected X-Forwarded-Proto value must be replaced by nginx's scheme (upstream saw: $BODY)"
BODY="$(upstream_sees "$TBASE")"
echo "$BODY" | grep -q '"xfp":"http"' || fail "trusted: without a forwarded proto nginx must report its own scheme (upstream saw: $BODY)"
ok "trusted: X-Forwarded-For is appended, X-Forwarded-Proto is honoured only as http/https"
docker rm -f "$TRUSTED" >/dev/null
# An unknown mode must fail closed instead of silently picking one.
if docker run --rm --network "$NET" -e BACKEND_URL=http://upstream:3000 -e FORWARDED_HEADERS_MODE=bogus "$IMAGE" nginx -t >/dev/null 2>&1; then
  fail "an unknown FORWARDED_HEADERS_MODE must make nginx refuse to start"
fi
ok "an unknown FORWARDED_HEADERS_MODE is rejected at startup"

echo "== runtime user"
[ "$(docker exec "$WEB" id -u)" != "0" ] || fail "the container runs as root"
ok "container runs as a non-root user"

echo "ALL CHECKS PASSED"
