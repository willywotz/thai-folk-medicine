FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV INTERNAL_API_URL=http://backend:8080
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV INTERNAL_API_URL=http://backend:8080
RUN pnpm build

FROM node:24-slim AS production
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER node
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV INTERNAL_API_URL=http://backend:8080
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
