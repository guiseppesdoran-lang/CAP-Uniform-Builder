# Builds the site and serves dist/ with Caddy. Build context is the repository root:
#   docker compose -f deploy/docker-compose.yml up -d --build
FROM node:22-alpine AS build
WORKDIR /src
COPY . .
RUN node scripts/build-site.cjs

FROM caddy:2-alpine
COPY deploy/Caddyfile.tunnel /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
