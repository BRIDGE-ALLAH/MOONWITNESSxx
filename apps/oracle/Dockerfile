FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ORACLE_HOST=0.0.0.0

WORKDIR /app

RUN groupadd --system oracle && useradd --system --gid oracle --home-dir /app oracle

COPY pyproject.toml README.md ./
COPY src ./src
COPY migrations ./migrations

RUN python -m pip install --no-cache-dir . \
    && chown -R oracle:oracle /app

USER oracle
EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/health/ready', timeout=3)"
CMD ["python", "-m", "oracle"]
