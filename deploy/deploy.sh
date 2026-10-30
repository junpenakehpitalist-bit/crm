#!/usr/bin/env bash
#
# CRM Hub - one-command, idempotent deployment to Google Cloud.
#
#   1. Enables required Google APIs
#   2. Creates an Artifact Registry Docker repo
#   3. Creates a Cloud SQL (PostgreSQL) instance, database and user
#   4. Creates service accounts + IAM bindings (least privilege)
#   5. Stores secrets in Secret Manager (generated, never printed):
#        DATABASE_URL, AUTH_SECRET (also used as NEXTAUTH_SECRET),
#        GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_PASSWORD, DB password
#   6. Runs Cloud Build (cloudbuild.yaml): builds images, runs the Prisma
#      migration/seed Cloud Run Job, deploys the Cloud Run service
#
# Safe to re-run at any time: existing resources and secrets are reused.
# Re-running is also how you deploy a new version of the app.
#
# Usage (from the project root, i.e. the folder containing Dockerfile):
#   cp deploy/config.env.example deploy/config.env   # then edit it
#   ./deploy/deploy.sh
#
# Optional environment variables (only needed the first time, or to change them):
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   OAuth client (or use deploy/set-google-oauth.sh later)
#   ADMIN_PASSWORD                            first admin's password (otherwise generated)
#   SKIP_BUILD=1                              infrastructure only, no build/deploy
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${CONFIG_FILE:-${SCRIPT_DIR}/config.env}"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m[error] %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- config ----
[[ -f "${CONFIG_FILE}" ]] || die "Missing ${CONFIG_FILE}. Run: cp deploy/config.env.example deploy/config.env and edit it."
# shellcheck source=/dev/null
source "${CONFIG_FILE}"

: "${PROJECT_ID:?PROJECT_ID is required in config.env}"
: "${REGION:?REGION is required in config.env}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL is required in config.env}"
[[ "${PROJECT_ID}" != "your-gcp-project-id" ]] || die "Set PROJECT_ID in ${CONFIG_FILE}."

SERVICE_NAME="${SERVICE_NAME:-crm-web}"
MIGRATE_JOB_NAME="${MIGRATE_JOB_NAME:-crm-migrate}"
AR_REPO="${AR_REPO:-crm}"
SQL_INSTANCE="${SQL_INSTANCE:-crm-postgres}"
SQL_TIER="${SQL_TIER:-db-custom-1-3840}"
SQL_VERSION="${SQL_VERSION:-POSTGRES_16}"
SQL_EDITION="${SQL_EDITION:-ENTERPRISE}"
SQL_AVAILABILITY="${SQL_AVAILABILITY:-zonal}"
DB_NAME="${DB_NAME:-crm}"
DB_USER="${DB_USER:-crm_app}"
ADMIN_NAME="${ADMIN_NAME:-Administrator}"
ADMIN_EMAIL="$(printf '%s' "${ADMIN_EMAIL}" | tr '[:upper:]' '[:lower:]')"
APP_URL_FROM_CONFIG="${APP_URL:-}"
RUN_MEMORY="${RUN_MEMORY:-1Gi}"
RUN_CPU="${RUN_CPU:-1}"
RUN_MIN_INSTANCES="${RUN_MIN_INSTANCES:-0}"
RUN_MAX_INSTANCES="${RUN_MAX_INSTANCES:-5}"
DISABLE_PUBLIC_SIGNUP="${DISABLE_PUBLIC_SIGNUP:-true}"

# Secret names in Secret Manager
SECRET_DB_PASSWORD="crm-db-password"
SECRET_DATABASE_URL="crm-database-url"
SECRET_AUTH="crm-auth-secret"
SECRET_GOOGLE_ID="crm-google-client-id"
SECRET_GOOGLE_SECRET="crm-google-client-secret"
SECRET_ADMIN_PASSWORD="crm-admin-password"

RUN_SA_NAME="crm-run"
BUILD_SA_NAME="crm-build"

# ---------------------------------------------------------------- checks ----
command -v gcloud  >/dev/null || die "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
command -v openssl >/dev/null || die "openssl not found."
gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q . \
  || die "Not logged in. Run: gcloud auth login"

GC=(gcloud --project="${PROJECT_ID}" --quiet)

PROJECT_NUMBER="$("${GC[@]}" projects describe "${PROJECT_ID}" --format='value(projectNumber)')" \
  || die "Cannot access project ${PROJECT_ID}. Check the ID and your permissions."
RUN_SA="${RUN_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_SA="${BUILD_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_CONNECTION="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
DEFAULT_URL="https://${SERVICE_NAME}-${PROJECT_NUMBER}.${REGION}.run.app"
APP_URL="${APP_URL_FROM_CONFIG:-${DEFAULT_URL}}"
APP_URL="${APP_URL%/}"

log "Project ${PROJECT_ID} (#${PROJECT_NUMBER}), region ${REGION}"
info "App URL will be: ${APP_URL}"

# ------------------------------------------------------------------ APIs ----
log "Enabling required APIs (may take a minute the first time)"
"${GC[@]}" services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sheets.googleapis.com \
  drive.googleapis.com

# ------------------------------------------------------ Artifact Registry ----
log "Artifact Registry repository '${AR_REPO}'"
if "${GC[@]}" artifacts repositories describe "${AR_REPO}" --location="${REGION}" >/dev/null 2>&1; then
  info "exists"
else
  "${GC[@]}" artifacts repositories create "${AR_REPO}" \
    --repository-format=docker --location="${REGION}" \
    --description="CRM Hub container images"
fi

# --------------------------------------------------------- Secret helpers ----
secret_exists() { "${GC[@]}" secrets describe "$1" >/dev/null 2>&1; }

# put_secret NAME VALUE  - create secret if needed and add VALUE as a new version
# (value is passed on stdin, never on the command line or in logs)
put_secret() {
  local name="$1" value="$2"
  if ! secret_exists "${name}"; then
    "${GC[@]}" secrets create "${name}" --replication-policy=automatic >/dev/null
  fi
  printf '%s' "${value}" | "${GC[@]}" secrets versions add "${name}" --data-file=- >/dev/null
  info "secret ${name}: new version stored"
}

# ensure_secret NAME GENERATED_VALUE - only create if the secret has no version yet
ensure_secret() {
  local name="$1" value="$2"
  if secret_exists "${name}" && "${GC[@]}" secrets versions access latest --secret="${name}" >/dev/null 2>&1; then
    info "secret ${name}: exists (kept)"
  else
    put_secret "${name}" "${value}"
  fi
}

read_secret() { "${GC[@]}" secrets versions access latest --secret="$1"; }

# --------------------------------------------------------------- Cloud SQL ----
log "Cloud SQL instance '${SQL_INSTANCE}' (${SQL_VERSION}, ${SQL_TIER})"
if "${GC[@]}" sql instances describe "${SQL_INSTANCE}" >/dev/null 2>&1; then
  info "exists"
else
  info "creating - this usually takes 5-15 minutes..."
  "${GC[@]}" sql instances create "${SQL_INSTANCE}" \
    --database-version="${SQL_VERSION}" \
    --edition="${SQL_EDITION}" \
    --tier="${SQL_TIER}" \
    --region="${REGION}" \
    --availability-type="${SQL_AVAILABILITY}" \
    --storage-type=SSD \
    --storage-size=10 \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --enable-point-in-time-recovery \
    --retained-backups-count=14 \
    --deletion-protection
fi

log "Database '${DB_NAME}'"
if "${GC[@]}" sql databases describe "${DB_NAME}" --instance="${SQL_INSTANCE}" >/dev/null 2>&1; then
  info "exists"
else
  "${GC[@]}" sql databases create "${DB_NAME}" --instance="${SQL_INSTANCE}"
fi

log "Database user '${DB_USER}'"
# Hex password => URL-safe inside DATABASE_URL.
ensure_secret "${SECRET_DB_PASSWORD}" "$(openssl rand -hex 24)"
DB_PASSWORD="$(read_secret "${SECRET_DB_PASSWORD}")"
if "${GC[@]}" sql users list --instance="${SQL_INSTANCE}" --format='value(name)' | grep -qx "${DB_USER}"; then
  # Keep the DB user in sync with the stored secret (idempotent).
  "${GC[@]}" sql users set-password "${DB_USER}" --instance="${SQL_INSTANCE}" --password="${DB_PASSWORD}" >/dev/null
  info "exists (password synced with Secret Manager)"
else
  "${GC[@]}" sql users create "${DB_USER}" --instance="${SQL_INSTANCE}" --password="${DB_PASSWORD}" >/dev/null
  info "created"
fi

# Cloud Run connects to Cloud SQL through the built-in Unix socket at /cloudsql/<connection-name>.
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION}&connection_limit=5"
if secret_exists "${SECRET_DATABASE_URL}" && [[ "$(read_secret "${SECRET_DATABASE_URL}" 2>/dev/null || true)" == "${DATABASE_URL}" ]]; then
  info "secret ${SECRET_DATABASE_URL}: up to date"
else
  put_secret "${SECRET_DATABASE_URL}" "${DATABASE_URL}"
fi
unset DB_PASSWORD DATABASE_URL

# ------------------------------------------------------------ App secrets ----
log "Application secrets"
ensure_secret "${SECRET_AUTH}" "$(openssl rand -base64 48 | tr -d '\n')"

if [[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  put_secret "${SECRET_GOOGLE_ID}" "${GOOGLE_CLIENT_ID}"
  put_secret "${SECRET_GOOGLE_SECRET}" "${GOOGLE_CLIENT_SECRET}"
else
  # Placeholders let the app start; Google login / Sheets stay disabled until real values are set
  # with ./deploy/set-google-oauth.sh
  ensure_secret "${SECRET_GOOGLE_ID}" "PLACEHOLDER_GOOGLE_CLIENT_ID"
  ensure_secret "${SECRET_GOOGLE_SECRET}" "PLACEHOLDER_GOOGLE_CLIENT_SECRET"
  if [[ "$(read_secret "${SECRET_GOOGLE_ID}")" == PLACEHOLDER* ]]; then
    warn "Google OAuth client not configured yet. After deploying, follow README section"
    warn "'Google OAuth setup' and run ./deploy/set-google-oauth.sh"
  fi
fi

ADMIN_PASSWORD_GENERATED=0
ADMIN_RESET="false"
if [[ -n "${ADMIN_PASSWORD:-}" ]]; then
  # Explicitly provided => store it and let the migrate job (re)set the admin's password.
  [[ ${#ADMIN_PASSWORD} -ge 10 ]] || die "ADMIN_PASSWORD must be at least 10 characters."
  put_secret "${SECRET_ADMIN_PASSWORD}" "${ADMIN_PASSWORD}"
  ADMIN_RESET="true"
else
  secret_exists "${SECRET_ADMIN_PASSWORD}" || ADMIN_PASSWORD_GENERATED=1
  ensure_secret "${SECRET_ADMIN_PASSWORD}" "$(openssl rand -base64 18 | tr -d '\n/+=')"
fi

# ------------------------------------------------------- Service accounts ----
log "Service accounts"
ensure_sa() {
  local name="$1" display="$2"
  if "${GC[@]}" iam service-accounts describe "${name}@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1; then
    info "${name}: exists"
  else
    "${GC[@]}" iam service-accounts create "${name}" --display-name="${display}"
    sleep 5   # IAM propagation
  fi
}
ensure_sa "${RUN_SA_NAME}"   "CRM Hub runtime (Cloud Run service + migrate job)"
ensure_sa "${BUILD_SA_NAME}" "CRM Hub Cloud Build deployer"

project_role() {
  "${GC[@]}" projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:$1" --role="$2" --condition=None >/dev/null
  info "$1 -> $2"
}

log "IAM bindings"
# Runtime: connect to Cloud SQL, read only its own secrets.
project_role "${RUN_SA}" roles/cloudsql.client
for s in "${SECRET_DATABASE_URL}" "${SECRET_AUTH}" "${SECRET_GOOGLE_ID}" "${SECRET_GOOGLE_SECRET}" "${SECRET_ADMIN_PASSWORD}"; do
  "${GC[@]}" secrets add-iam-policy-binding "${s}" \
    --member="serviceAccount:${RUN_SA}" --role=roles/secretmanager.secretAccessor >/dev/null
  info "${RUN_SA} -> secretAccessor on ${s}"
done
# Build/deploy: push images, write logs, read uploaded source, deploy Cloud Run, act as runtime SA.
project_role "${BUILD_SA}" roles/artifactregistry.writer
project_role "${BUILD_SA}" roles/logging.logWriter
project_role "${BUILD_SA}" roles/storage.objectViewer
project_role "${BUILD_SA}" roles/run.admin
"${GC[@]}" iam service-accounts add-iam-policy-binding "${RUN_SA}" \
  --member="serviceAccount:${BUILD_SA}" --role=roles/iam.serviceAccountUser >/dev/null
info "${BUILD_SA} -> serviceAccountUser on ${RUN_SA}"

# ------------------------------------------------------ Build + deploy -------
if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  log "SKIP_BUILD=1 - infrastructure is ready; skipping build and deploy."
  exit 0
fi

TAG="$(date -u +%Y%m%d-%H%M%S)"
if git -C "${ROOT_DIR}" rev-parse --short HEAD >/dev/null 2>&1; then
  TAG="${TAG}-$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
fi

log "Cloud Build: build images, run migrations, deploy (tag ${TAG}) - ~5-10 minutes"
"${GC[@]}" builds submit "${ROOT_DIR}" \
  --region="${REGION}" \
  --config="${ROOT_DIR}/cloudbuild.yaml" \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" \
  --substitutions="^|^_REGION=${REGION}|_AR_REPO=${AR_REPO}|_SERVICE=${SERVICE_NAME}|_MIGRATE_JOB=${MIGRATE_JOB_NAME}|_RUN_SA=${RUN_SA}|_SQL_CONNECTION=${SQL_CONNECTION}|_APP_URL=${APP_URL}|_ADMIN_EMAIL=${ADMIN_EMAIL}|_ADMIN_NAME=${ADMIN_NAME}|_ADMIN_RESET=${ADMIN_RESET}|_TAG=${TAG}|_MEMORY=${RUN_MEMORY}|_CPU=${RUN_CPU}|_MIN_INSTANCES=${RUN_MIN_INSTANCES}|_MAX_INSTANCES=${RUN_MAX_INSTANCES}|_DISABLE_PUBLIC_SIGNUP=${DISABLE_PUBLIC_SIGNUP}"

ACTUAL_URL="$("${GC[@]}" run services describe "${SERVICE_NAME}" --region="${REGION}" --format='value(status.url)')"
if [[ -z "${APP_URL_FROM_CONFIG}" && -n "${ACTUAL_URL}" && "${ACTUAL_URL}" != "${DEFAULT_URL}" ]]; then
  warn "Cloud Run reports URL ${ACTUAL_URL} (expected ${DEFAULT_URL}). Updating AUTH_URL/NEXTAUTH_URL."
  "${GC[@]}" run services update "${SERVICE_NAME}" --region="${REGION}" \
    --update-env-vars="AUTH_URL=${ACTUAL_URL},NEXTAUTH_URL=${ACTUAL_URL}" >/dev/null
  APP_URL="${ACTUAL_URL}"
fi

log "Deployment complete"
cat <<EOF

  App URL:             ${APP_URL}
  Admin login:         ${ADMIN_EMAIL}
  Admin password:      stored in Secret Manager. Read it with:
                         gcloud secrets versions access latest --secret=${SECRET_ADMIN_PASSWORD} --project=${PROJECT_ID}
                       (to change it later: ADMIN_PASSWORD='new-password' ./deploy/deploy.sh)

  Google OAuth client - in Google Cloud Console > APIs & Services > Credentials use:
    Authorized JavaScript origin:  ${APP_URL}
    Authorized redirect URIs:      ${APP_URL}/api/auth/callback/google
                                   ${APP_URL}/api/google/callback
  Then run:  ./deploy/set-google-oauth.sh

EOF
if [[ "${ADMIN_PASSWORD_GENERATED}" == "1" ]]; then
  info "A random admin password was generated for ${ADMIN_EMAIL} (see command above)."
fi
