# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY index.html ./
COPY vite.config.ts tsconfig.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

FROM base AS dev
EXPOSE 5173
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
