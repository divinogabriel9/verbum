#!/usr/bin/env bash
# Export YouTube-only cookies for Render YTDLP_COOKIES_B64 (keeps size small).
# Usage: bash scripts/export_ytdlp_cookies_for_render.sh
set -euo pipefail

OUT="${TMPDIR:-/tmp}/verbum_youtube_cookies.txt"
B64_OUT="${TMPDIR:-/tmp}/verbum_ytdlp_cookies.b64"

echo "1) Exporting cookies from Chrome (must be signed into YouTube)…"
yt-dlp --cookies-from-browser chrome --cookies "$OUT" --skip-download "https://www.youtube.com" >/dev/null

# Keep only YouTube-related lines (Netscape cookie format).
FILTERED="${TMPDIR:-/tmp}/verbum_youtube_cookies.filtered.txt"
{
  echo "# Netscape HTTP Cookie File"
  awk 'BEGIN{FS="\t"} /^#/ {next} NF>=7 && $1 ~ /youtube|google/ {print}' "$OUT"
} > "$FILTERED"

BYTES=$(wc -c < "$FILTERED" | tr -d ' ')
echo "2) Filtered cookie file size: ${BYTES} bytes"

if [ "$BYTES" -lt 200 ]; then
  echo "ERROR: Cookie file looks empty. Sign into YouTube in Chrome, then retry."
  exit 1
fi

# Render env values should stay well under ~48KB.
if [ "$BYTES" -gt 40000 ]; then
  echo "WARNING: Still large (${BYTES} bytes). Prefer the Get cookies.txt LOCALLY"
  echo "browser extension and export only youtube.com, then:"
  echo "  base64 -i that-file.txt | pbcopy"
fi

base64 -i "$FILTERED" | tr -d '\n' > "$B64_OUT"
B64_BYTES=$(wc -c < "$B64_OUT" | tr -d ' ')
echo "3) Base64 length: ${B64_BYTES} chars"
pbcopy < "$B64_OUT"
echo
echo "Done — base64 is on your clipboard."
echo "Render → your web service → Environment →"
echo "  Key:   YTDLP_COOKIES_B64"
echo "  Value: Cmd+V  (paste)"
echo "Save. If deploy fails, open Events → failed deploy → copy the red lines."
