FROM python:3.13-slim

WORKDIR /app

# Poster fonts + LibreOffice for in-app slideshow (PPTX → PDF → PNG).
# Poppins/Arimo/Gelasio/Carlito are bundled (OFL) for Present parity.
# ffmpeg cuts 5–10s chorus preview clips from YouTube audio (superadmin tool).
# node is required by yt-dlp for YouTube JS challenges (avoids HTTP 403 on audio fetch).
RUN apt-get update && apt-get install -y --no-install-recommends \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation \
    fonts-crosextra-carlito \
    libreoffice-impress \
    libreoffice-draw \
    ffmpeg \
    nodejs \
    && (command -v soffice >/dev/null || ln -sf "$(command -v libreoffice)" /usr/bin/soffice) \
    && rm -rf /var/lib/apt/lists/*

# LibreOffice headless on Render: writable home + SVP plugin (no display).
ENV HOME=/tmp \
    SAL_USE_VCLPLUGIN=svp \
    DBUS_SESSION_BUS_ADDRESS=/dev/null \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p outputs \
    && mkdir -p /usr/share/fonts/truetype/verbum \
    && cp -v data/reference/fonts/*.ttf /usr/share/fonts/truetype/verbum/ \
    && cp -v data/reference/fonts/99-verbum-pptx.conf /etc/fonts/conf.d/99-verbum-pptx.conf \
    && fc-cache -f \
    && soffice --version

# Bake deploy identity when Render passes RENDER_GIT_COMMIT / APP_VERSION as build args.
ARG RENDER_GIT_COMMIT=
ARG APP_VERSION=
RUN V="${APP_VERSION:-${RENDER_GIT_COMMIT}}"; \
    if [ -n "$V" ]; then printf '%s\n' "$V" > /app/.build-version; fi; \
    date -u +%Y-%m-%dT%H:%M:%SZ > /app/.build-time

EXPOSE 8000
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
