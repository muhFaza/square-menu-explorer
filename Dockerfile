# syntax=docker/dockerfile:1

# Multi-stage build producing a small standalone Next.js runtime image.
FROM node:22-alpine AS base
# Enable Corepack and pin the exact pnpm the repository records.
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app

# --- deps: install from the lockfile only, cached until dependencies change ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build: compile the production standalone output ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- runtime: minimal image serving the standalone server ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Bind to all interfaces so the mapped container port is reachable.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# .next/standalone ships its own trimmed node_modules and server.js.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# node:22-alpine already provides a non-root `node` user.
USER node

EXPOSE 3000

# Secrets (SQUARE_ACCESS_TOKEN, SQUARE_ENVIRONMENT) and PORT arrive at runtime,
# never as build args, so nothing sensitive is baked into the image layers.
CMD ["node", "server.js"]
