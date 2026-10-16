# ADR 0007 — Frontend talks to the API through a same-origin `/api` proxy

Status: accepted (2026-10-16)

## Context
The backend uses `SameSite=Lax` cookie sessions and a fail-closed CSRF guard that compares the request's `Origin`
(or `Referer`) with `CORS_ORIGIN` (ADR 0003). The frontend must therefore be hosted on the same site as the API.
Two ways to reach the API from the browser were considered: calling the API's own origin directly
(`localhost:3000`), or calling a relative `/api` path on the page's own origin and letting a proxy forward it.

## Decision
- The fetch client uses the base path `/api` on the page's own origin. No API URL variable exists in the app.
- Development: the Vite dev server proxies `/api` to the backend (`API_PROXY_TARGET`, default
  `http://localhost:3000`) with **no `rewrite`** and **no `changeOrigin`**, on a fixed port (`strictPort`, 5173).
- Production: a non-root nginx image serves the built app and proxies `/api/` to `BACKEND_URL`. `proxy_pass` has no
  URI part, so the `/api` prefix is preserved, and `Origin` is forwarded as sent.
- `CORS_ORIGIN` must equal the origin the browser shows (`http://localhost:5173` in development, the real site
  origin in production). The guard checks it even though the request is same-origin from the browser's view.
- Client identity and scheme: nginx has two modes, `FORWARDED_HEADERS_MODE=edge` (default) and `trusted`. In `edge`
  mode it is the first proxy and overwrites `X-Forwarded-For` (with the socket address), `X-Forwarded-Proto` (with its
  own scheme) and `X-Forwarded-Host`, so the backend (`TRUST_PROXY_HOPS=1`) rate-limits the real peer and a client
  cannot claim HTTPS. In `trusted` mode, for a TLS-terminating load balancer you control, nginx appends to
  `X-Forwarded-For` and honours `X-Forwarded-Proto` only when it is `http` or `https`; the backend then needs
  `TRUST_PROXY_HOPS=2`. An unknown mode makes nginx refuse to start. Rejected: always trusting forwarding headers
  (a direct client could pick its own rate-limit bucket) and always overwriting them (a TLS-terminating load balancer's
  `https` would be lost and the `Secure` session cookie never sent).
- The SPA's hardening headers (CSP without `unsafe-inline`, `nosniff`, frame and referrer policies) are set by nginx
  on SPA locations only; `/api` keeps the backend's own `helmet` headers. HSTS is left to the TLS-terminating layer.

## Consequences
- Same topology in development and production; no CORS preflight in the browser; the session cookie is first-party.
- A moved dev port or a proxy that rewrites `Origin` turns every unsafe request into a `403`; `strictPort` and the
  README troubleshooting note make that failure obvious.
- The production CSP forbids inline styles and scripts, which is enforced in the app by lint.
- Rejected: direct cross-origin calls (needs CORS with credentials and an API URL setting, and differs from
  production). Cross-site hosting stays unsupported (ADR 0003).
