# Cloudflare Containers require linux/amd64.
# Local Compose on Apple Silicon emulates via QEMU when platform is set in compose.
# We deliberately avoid Debian's huge `calibre` apt package (pulls avahi/etc. and
# often fails under QEMU with dpkg I/O errors). Official binary instead.
FROM --platform=linux/amd64 debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV QTWEBENGINE_CHROMIUM_FLAGS="--no-sandbox --disable-gpu --disable-dev-shm-usage"
ENV QT_QPA_PLATFORM=offscreen
ENV XDG_RUNTIME_DIR=/tmp/runtime-root
ENV PATH="/opt/calibre:${PATH}"

# Small apt set only — shared libs Calibre's official binary needs + our server deps.
# Do NOT apt-get install calibre.
RUN apt-get update -o Acquire::Retries=5 \
  && apt-get install -y -o Acquire::Retries=5 --no-install-recommends \
    ca-certificates \
    curl \
    xz-utils \
    xdg-utils \
    python3 \
    python3-pip \
    python3-venv \
    xvfb \
    fonts-liberation \
    fonts-dejavu-core \
    libegl1 \
    libopengl0 \
    libgl1 \
    libxcb-cursor0 \
    libxcb-xinerama0 \
    libxkbcommon0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxtst6 \
    libdbus-1-3 \
    libasound2 \
    libfontconfig1 \
    libfreetype6 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxi6 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/epub-convert /tmp/runtime-root \
  && chmod 777 /tmp/epub-convert && chmod 700 /tmp/runtime-root

# Official Calibre linux binary → /opt/calibre (isolated; no system desktop hooks).
# Symlink ebook-convert onto PATH for server.py / health checks.
RUN curl -fsSL https://download.calibre-ebook.com/linux-installer.sh \
    | sh /dev/stdin install_dir=/opt isolated=y \
  && ln -sf /opt/calibre/ebook-convert /usr/local/bin/ebook-convert \
  && ebook-convert --version \
  && rm -rf /tmp/calibre-installer-cache /tmp/*.txz 2>/dev/null || true

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
