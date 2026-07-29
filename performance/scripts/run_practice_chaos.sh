#!/usr/bin/env bash
# Run 1000 anonymous choir phones against a practice share (chaos mix).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${PRACTICE_ENV_FILE:-performance/reports/.practice_chaos_env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
fi

: "${PRACTICE_TOKEN:?Set PRACTICE_TOKEN or create $ENV_FILE}"
: "${PRACTICE_PIN:?Set PRACTICE_PIN or create $ENV_FILE}"

export PRACTICE_VUS="${PRACTICE_VUS:-1000}"
export PRACTICE_HOLD="${PRACTICE_HOLD:-5m}"
export STRESS_SPOOF_IP="${STRESS_SPOOF_IP:-1}"
export BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"

echo "practice-chaos → ${BASE_URL}  VUs=${PRACTICE_VUS} hold=${PRACTICE_HOLD} spoof_ip=${STRESS_SPOOF_IP}"
exec k6 run performance/scenarios/practice-chaos.js
