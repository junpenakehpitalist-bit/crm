#!/usr/bin/env bash
#
# Store (or rotate) the Google OAuth Web client ID/secret in Secret Manager and
# roll out a new Cloud Run revision so the app picks them up.
#
# Usage:
#   ./deploy/set-google-oauth.sh                 # prompts (input hidden)
#   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... ./deploy/set-google-oauth.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${CONFIG_FILE:-${SCRIPT_DIR}/config.env}"
[[ -f "${CONFIG_FILE}" ]] || { echo "Missing ${CONFIG_FILE}" >&2; exit 1; }
# shellcheck source=/dev/null
source "${CONFIG_FILE}"
: "${PROJECT_ID:?}" "${REGION:?}"
SERVICE_NAME="${SERVICE_NAME:-crm-web}"
GC=(gcloud --project="${PROJECT_ID}" --quiet)

if [[ -z "${GOOGLE_CLIENT_ID:-}" ]]; then
  read -r -p "Google OAuth Client ID: " GOOGLE_CLIENT_ID
fi
if [[ -z "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  read -r -s -p "Google OAuth Client secret (hidden): " GOOGLE_CLIENT_SECRET; echo
fi
[[ "${GOOGLE_CLIENT_ID}" == *.apps.googleusercontent.com ]] \
  || { echo "That does not look like a Web client ID (*.apps.googleusercontent.com)." >&2; exit 1; }
[[ -n "${GOOGLE_CLIENT_SECRET}" ]] || { echo "Client secret is empty." >&2; exit 1; }

for pair in "crm-google-client-id:${GOOGLE_CLIENT_ID}" "crm-google-client-secret:${GOOGLE_CLIENT_SECRET}"; do
  name="${pair%%:*}"; value="${pair#*:}"
  "${GC[@]}" secrets describe "${name}" >/dev/null 2>&1 \
    || "${GC[@]}" secrets create "${name}" --replication-policy=automatic >/dev/null
  printf '%s' "${value}" | "${GC[@]}" secrets versions add "${name}" --data-file=- >/dev/null
  echo "Stored new version of ${name}"
done
unset GOOGLE_CLIENT_SECRET

# Secrets are mounted as ":latest" but only resolved when a revision starts -> force a new revision.
"${GC[@]}" run services update "${SERVICE_NAME}" --region="${REGION}" \
  --update-labels="oauth-rotated=$(date -u +%Y%m%d%H%M%S)" >/dev/null
echo "New Cloud Run revision deployed. Google sign-in and Google Sheets sync are now enabled."
echo "Next: sign in as admin > Settings > 'Connect Google Account'."
