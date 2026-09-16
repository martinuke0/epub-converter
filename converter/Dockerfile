# Cloudflare Containers require linux/amd64.
# Local Compose on Apple Silicon will emulate via QEMU when platform is set in compose.
FROM --platform=linux/amd64 debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV QTWEBENGINE_CHROMIUM_FLAGS="--no-sandbox --disable-gpu --disable-dev-shm-usage"
ENV QT_QPA_PLATFORM=offscreen
ENV XDG_RUNTIME_DIR=/tmp/runtime-root

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    calibre \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    curl \
    xvfb \
    fonts-liberation \
    fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/epub-convert /tmp/runtime-root \
  && chmod 777 /tmp/epub-convert && chmod 700 /tmp/runtime-root

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt \
  || pip3 install --no-cache-dir -r requirements.txt

COPY server.py /app/server.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8090

ENV CONVERTER_PORT=8090
ENV TEMP_DIR=/tmp/epub-convert
ENV TEMP_TTL_SECONDS=3600
ENV MAX_FILE_SIZE_MB=80

ENTRYPOINT ["/app/entrypoint.sh"]
