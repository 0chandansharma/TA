# syntax=docker/dockerfile:1

FROM golang:1.22-alpine as base
RUN mkdir /build
WORKDIR /build
COPY go.mod .
COPY go.sum .
RUN go mod download
COPY . .
# Build the binary
FROM base AS builder
ARG APP_VERSION
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-X main.AppVersion=${APP_VERSION}" -o /main cmd/app/main.go
# Build minimal image
FROM alpine:3
COPY --from=builder main /bin/main
ENTRYPOINT ["/bin/main"]