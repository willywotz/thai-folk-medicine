FROM node:24-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM oven/bun:1-alpine AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ARG INTERNAL_API_URL=http://backend:8080
ENV INTERNAL_API_URL=${INTERNAL_API_URL:-http://backend:8080}
EXPOSE 3000
CMD ["bun", "run", "dev"]

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN pnpm build

FROM oven/bun:1-alpine AS production
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER bun
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ARG INTERNAL_API_URL=http://backend:8080
ENV INTERNAL_API_URL=${INTERNAL_API_URL:-http://backend:8080}
EXPOSE 3000
CMD ["bun", "server.js"]
