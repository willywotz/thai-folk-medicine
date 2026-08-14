# syntax=docker/dockerfile:1

# Build a static Go binary (migrations are embedded, so nothing else is needed).
FROM golang:1.26.5 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/seed ./cmd/seed

# Minimal runtime.
FROM alpine:3.20
RUN apk add --no-cache ca-certificates \
 && adduser -D -u 10001 app \
 && mkdir -p /data/photo \
 && chown -R app /data
COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/seed /usr/local/bin/seed
USER app
ENV HTTP_PORT=8080 \
    PHOTO_STORAGE_DIR=/data/photo
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api"]
