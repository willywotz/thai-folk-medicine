# syntax=docker/dockerfile:1

# Shared base: module cache warmed once, reused by dev and build.
FROM golang:1.26.5 AS base
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

# Development: `go run` recompiles on start. Compose `develop.watch` syncs
# source in and restarts this service on change (see compose.override.yaml).
FROM base AS development
COPY . .
ENV HTTP_PORT=8080
ENV PHOTO_STORAGE_DIR=/data/photo
EXPOSE 8080
CMD ["go", "run", "./cmd/api"]

# Build a static Go binary (migrations are embedded, so nothing else is needed).
FROM base AS builder
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/seed ./cmd/seed

# Minimal runtime.
FROM alpine:3.20 AS production
RUN apk add --no-cache ca-certificates \
 && adduser -D -u 10001 app \
 && mkdir -p /data/photo \
 && chown -R app /data
COPY --from=builder /out/api /usr/local/bin/api
COPY --from=builder /out/seed /usr/local/bin/seed
USER app
ENV HTTP_PORT=8080
ENV PHOTO_STORAGE_DIR=/data/photo
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api"]
