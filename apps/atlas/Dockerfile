FROM rust:1.94-bookworm AS builder
WORKDIR /build
COPY Cargo.toml Cargo.toml
COPY .cargo .cargo
COPY config config
COPY assets assets
COPY migrations migrations
COPY src src
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates freeradius-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /build/target/release/atlas-cli /usr/local/bin/atlas
COPY --from=builder /build/target/release/atlas-migrate /usr/local/bin/atlas-migrate
COPY --from=builder /build/config ./config
ENV LOCO_ENV=production
ENV BINDING=0.0.0.0
ENV PORT=5150
EXPOSE 5150
USER 10001:10001
ENTRYPOINT ["/usr/local/bin/atlas"]
CMD ["start"]
