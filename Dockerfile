FROM python:3.13-slim

WORKDIR /app

# Poster text rendering (DejaVu; paths match generators/poster_generator.py fallback)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p outputs

# Bake deploy identity when Render passes RENDER_GIT_COMMIT / APP_VERSION as build args.
ARG RENDER_GIT_COMMIT=
ARG APP_VERSION=
RUN V="${APP_VERSION:-${RENDER_GIT_COMMIT}}"; \
    if [ -n "$V" ]; then printf '%s\n' "$V" > /app/.build-version; fi

EXPOSE 8000
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
