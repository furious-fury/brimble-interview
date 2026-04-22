# syntax=docker/dockerfile:1
# better-sqlite3 (native) needs a compiler on Alpine
FROM node:20-alpine AS base
ARG RAILPACK_VERSION=v0.23.0
RUN apk add --no-cache python3 make g++ openssl git unzip curl ca-certificates \
  && curl -sSL "https://github.com/railwayapp/railpack/releases/download/${RAILPACK_VERSION}/railpack-${RAILPACK_VERSION}-x86_64-unknown-linux-musl.tar.gz" -o /tmp/rp.tgz \
  && tar -xzf /tmp/rp.tgz -C /tmp \
  && install -m 0755 /tmp/railpack /usr/local/bin/railpack \
  && rm -f /tmp/rp.tgz /tmp/railpack /tmp/LICENSE /tmp/README.md
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate

FROM base AS dev
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 3000
ENV NODE_ENV=development
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm run build

FROM node:20-alpine AS production
ARG RAILPACK_VERSION=v0.23.0
RUN apk add --no-cache python3 make g++ openssl git unzip curl ca-certificates \
  && curl -sSL "https://github.com/railwayapp/railpack/releases/download/${RAILPACK_VERSION}/railpack-${RAILPACK_VERSION}-x86_64-unknown-linux-musl.tar.gz" -o /tmp/rp.tgz \
  && tar -xzf /tmp/rp.tgz -C /tmp \
  && install -m 0755 /tmp/railpack /usr/local/bin/railpack \
  && rm -f /tmp/rp.tgz /tmp/railpack /tmp/LICENSE /tmp/README.md
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
