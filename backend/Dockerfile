# syntax=docker/dockerfile:1
# Debian (glibc): railpack runs a glibc-linked mise; Alpine/musl + gcompat still breaks mise (127/ENOENT).
# better-sqlite3 (native) needs a compiler. Railpack's linux release is a static musl binary and runs here fine.
FROM moby/buildkit:v0.29.0 AS buildkit_bin

FROM node:22-bookworm-slim AS base
ARG RAILPACK_VERSION=v0.23.0
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl git unzip curl ca-certificates \
  && curl -sSL "https://github.com/railwayapp/railpack/releases/download/${RAILPACK_VERSION}/railpack-${RAILPACK_VERSION}-x86_64-unknown-linux-musl.tar.gz" -o /tmp/rp.tgz \
  && tar -xzf /tmp/rp.tgz -C /tmp \
  && install -m 0755 /tmp/railpack /usr/local/bin/railpack \
  && install -m 0755 /usr/bin/env /usr/local/bin/env \
  && rm -f /tmp/rp.tgz /tmp/railpack /tmp/LICENSE /tmp/README.md \
  && rm -rf /var/lib/apt/lists/*
COPY --from=buildkit_bin /usr/bin/buildctl /usr/local/bin/buildctl
WORKDIR /app
COPY package.json package-lock.json* ./
# prisma files must be present before npm ci: postinstall runs prisma generate
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY tsconfig.json ./
COPY src ./src

FROM base AS dev
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh
EXPOSE 3000
ENV NODE_ENV=development
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm run build

FROM node:22-bookworm-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
