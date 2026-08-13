# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# Install dependencies from the lockfile.
# pnpm-workspace.yaml carries the allowBuilds decisions (sharp/unrs-resolver);
# without it pnpm 10+ fails with ERR_PNPM_IGNORED_BUILDS.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build the standalone Next.js server.
# INTERNAL_API_URL is baked into the /api rewrite at build time, so it must
# point at the backend service reachable from the frontend container.
FROM base AS build
ARG INTERNAL_API_URL=http://backend:8080
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Minimal runtime: the standalone output plus static assets.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
