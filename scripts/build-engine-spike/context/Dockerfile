FROM docker.io/library/busybox:1.36.1@sha256:73aaf090f3d85aa34ee199857f03fa3a95c8ede2ffd4cc2cdb5b94e566b11662
ARG SPIKE_SOURCE_COMMIT
LABEL org.opencontainers.image.revision="${SPIKE_SOURCE_COMMIT}"
LABEL org.opencontainers.image.title="MOONWITNESS rootless BuildKit isolation spike"

RUN set -eu; \
    test -z "${ARSY_OPERATOR_TOKEN:-}"; \
    test ! -S /var/run/docker.sock; \
    test ! -S /tmp/build-engine-spike-host.sock; \
    if wget -q -T 2 -O /dev/null http://10.0.2.2:18765/; then \
      echo "host loopback sentinel was reachable through the slirp host gateway" >&2; exit 41; \
    fi; \
    if wget -q -T 2 -O /dev/null http://127.0.0.1:18765/; then \
      echo "container loopback sentinel was reachable" >&2; exit 43; \
    fi

RUN --network=none sh -ec 'if wget -q -T 2 -O /dev/null http://1.1.1.1/; then echo "network=none allowed egress" >&2; exit 42; fi'

COPY proof.txt /proof.txt
