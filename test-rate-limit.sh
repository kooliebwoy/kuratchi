#!/usr/bin/env bash
set -euo pipefail

# Config
BASE_URL="${BASE_URL:-http://localhost:5173}"
EMAIL="${EMAIL:-test@example.com}"
PASSWORD="${PASSWORD:-wrong-password}"
ROUTE="${ROUTE:-/auth/signin}"   # or /auth/signup if you prefer
REQUESTS="${REQUESTS:-15}"       # number of requests to send

echo "Testing rate limit on ${BASE_URL}${ROUTE}"
echo "Email: ${EMAIL}"
echo "Requests: ${REQUESTS}"
echo

for i in $(seq 1 "${REQUESTS}"); do
  echo "=== Request $i ==="
  curl -i -s \
    -X POST "${BASE_URL}${ROUTE}" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "email=${EMAIL}" \
    --data-urlencode "password=${PASSWORD}" \
    | awk '
      NR==1 ||  # status line
      tolower($1) ~ /^retry-after:/ ||
      tolower($1) ~ /^x-ratelimit-/ ||
      tolower($1) ~ /^content-type:/ ||
      /^$/ { print }        # blank line before body
      /^{"error":/ { print; exit }  # first JSON error line if present
    '
  echo
  sleep 0.5
done