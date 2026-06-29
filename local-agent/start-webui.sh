#!/usr/bin/env bash
# Launch Open WebUI for the local agent lane.
# Data is kept in ~/.open-webui so it never pollutes the church repo.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
export DATA_DIR="$HOME/.open-webui"          # webui.db, secret key, vectors live here
export OLLAMA_BASE_URL="http://localhost:11434"
export WEBUI_AUTH="${WEBUI_AUTH:-True}"      # set to False to skip the login screen

mkdir -p "$DATA_DIR"

echo "Open WebUI starting on http://localhost:8080  (data: $DATA_DIR)"
exec open-webui serve --port 8080
