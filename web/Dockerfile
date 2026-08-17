FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm exec vite build

# Dev stage: Vite dev server with HMR, on :3000 to match the prod nginx port
# (so compose.override.yaml inherits the prod ports mapping cleanly).
# Proxy target is set via VITE_API_TARGET (see compose.override.yaml) so /api
# reaches the backend container.
FROM base AS development
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"]

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
