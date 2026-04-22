# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY tsconfig.json ./
COPY src ./src

FROM base AS dev
EXPOSE 3000
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
