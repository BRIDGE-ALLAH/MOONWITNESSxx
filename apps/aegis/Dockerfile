FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/aegis ./cmd/aegis

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build --chown=nonroot:nonroot /out/aegis /aegis
USER nonroot:nonroot
EXPOSE 3102
ENTRYPOINT ["/aegis"]
