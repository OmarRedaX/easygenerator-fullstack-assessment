# syntax=docker/dockerfile:1
# Build context is the repository root (like backend/Dockerfile): the lockfile lives there.
#   docker build -f frontend/Dockerfile -t eg-frontend .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w frontend
COPY frontend frontend
RUN npm run build -w frontend

# Non-root nginx (uid 101, port 8080). Same-site hosting: it serves the SPA and proxies /api to the backend.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
# The image entrypoint renders /etc/nginx/templates/*.template with the environment (BACKEND_URL).
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY frontend/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY frontend/nginx/forwarded-edge.conf frontend/nginx/forwarded-trusted.conf /etc/nginx/
# Backend origin only: scheme://host[:port], no path and no trailing slash (a path would rewrite /api).
ENV BACKEND_URL=http://api:3000
# edge: this nginx is the first proxy; client forwarding headers are overwritten. trusted: a load balancer you control
# is in front (see nginx/forwarded-trusted.conf; the backend then needs one more trusted hop).
ENV FORWARDED_HEADERS_MODE=edge
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
