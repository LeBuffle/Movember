#!/usr/bin/env bash
#
# DEFI Movember — deployment, run ON THE VPS by the GitHub Actions workflow.
#
#   bash deploy/scripts/deploy.sh <git-ref> <staging|production>
#
# Checks out the requested commit, rebuilds the image, swaps the container
# and waits for it to report healthy. If it does not, the previous image is
# put back automatically — a failed deploy must never leave the site down.

set -euo pipefail

GIT_REF="${1:?usage: deploy.sh <git-ref> <staging|production>}"
ENVIRONMENT="${2:?usage: deploy.sh <git-ref> <staging|production>}"

APP_DIR="/opt/defi-movember"
DEPLOY_DIR="$APP_DIR/deploy"
HEALTH_TIMEOUT=90
KEEP_IMAGES=3

case "$ENVIRONMENT" in
staging)
  SERVICE="app-staging"
  IMAGE_VAR="STAGING_IMAGE"
  VERSION_VAR="STAGING_APP_VERSION"
  ENV_FILE=".env.staging"
  ;;
production)
  SERVICE="app"
  IMAGE_VAR="APP_IMAGE"
  VERSION_VAR="APP_VERSION"
  ENV_FILE=".env.production"
  ;;
*)
  echo "Environnement inconnu : $ENVIRONMENT (attendu : staging ou production)" >&2
  exit 1
  ;;
esac

info() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
ok() { printf '  \033[1;32m✓\033[0m %s\n' "$1"; }
fail() {
  printf '  \033[1;31m✗\033[0m %s\n' "$1" >&2
  exit 1
}

cd "$DEPLOY_DIR"

# --- Preflight ------------------------------------------------------------
#
# Missing configuration is the most likely cause of a first-run failure, and
# the resulting Docker errors are cryptic. Say plainly what is missing.
info "Vérification de la configuration"
for f in .env "$ENV_FILE"; do
  [[ -f "$f" ]] || fail "$DEPLOY_DIR/$f est absent. Créez-le à partir de son modèle (voir deploy/README.md)."
done
ok "fichiers d'environnement présents"

docker network inspect "$(grep -E '^TRAEFIK_NETWORK=' .env | cut -d= -f2- || echo n8n_default)" >/dev/null 2>&1 ||
  fail "Le réseau Traefik est introuvable. Vérifiez TRAEFIK_NETWORK dans deploy/.env."
ok "réseau Traefik joignable"

# --- Source ---------------------------------------------------------------
info "Récupération du code — $GIT_REF"
cd "$APP_DIR"
git fetch --quiet origin
git checkout --quiet --force "$GIT_REF"
SHORT_SHA="$(git rev-parse --short HEAD)"
ok "$SHORT_SHA — $(git log -1 --pretty=%s | cut -c1-60)"

# --- Build ----------------------------------------------------------------
#
# The image is built here rather than pulled from a registry. At 12 GB of RAM
# and four cores this takes well under a minute, and it removes a registry
# and a long-lived access token from the chain — two fewer things to hold
# credentials for, and two fewer things to break in November.
cd "$DEPLOY_DIR"
NEW_IMAGE="defi-movember:${ENVIRONMENT}-${SHORT_SHA}"

info "Construction de l'image $NEW_IMAGE"
# The previous image is captured BEFORE building, so a rollback target exists
# even if the build itself is what goes wrong.
PREVIOUS_IMAGE="$(docker inspect --format '{{.Config.Image}}' "defi-movember-${SERVICE}-1" 2>/dev/null || true)"

docker build \
  --file "$APP_DIR/deploy/Dockerfile" \
  --build-arg "APP_VERSION=$SHORT_SHA" \
  --tag "$NEW_IMAGE" \
  "$APP_DIR" ||
  fail "La construction a échoué. Rien n'a été déployé, le site tourne toujours."
ok "image construite"

# --- Swap -----------------------------------------------------------------
info "Bascule du service $SERVICE"
export "$IMAGE_VAR=$NEW_IMAGE"
export "$VERSION_VAR=$SHORT_SHA"

# Also written to `.env`, which Docker Compose reads on its own from this
# directory. Exporting alone would only last for this script: a later
# `docker compose up -d` typed by hand — to pick up a change in an
# environment file, say — would find the variable unset, fall back to the
# default in `docker-compose.yml`, and silently start an OLD image. It
# happened, and it is invisible: the site keeps answering, on last week's
# code. Persisting the value means the file on disk always says what is
# actually meant to run.
persist_var() {
  local name="$1" value="$2"
  touch .env
  # Rewrite in place rather than append: a second line would leave the file
  # ambiguous, and the answer would depend on which one Compose reads last.
  sed -i "/^${name}=/d" .env
  printf '%s=%s\n' "$name" "$value" >>.env
}

persist_var "$IMAGE_VAR" "$NEW_IMAGE"
persist_var "$VERSION_VAR" "$SHORT_SHA"

docker compose up -d --no-deps "$SERVICE" || fail "Le démarrage du conteneur a échoué."

# --- Health check ---------------------------------------------------------
#
# `docker compose up` returns as soon as the container is started, which says
# nothing about whether the app actually serves. The HEALTHCHECK does, so we
# wait for it rather than declaring victory early.
info "Attente de l'état healthy (max ${HEALTH_TIMEOUT}s)"
CONTAINER="defi-movember-${SERVICE}-1"
elapsed=0
status=""

while ((elapsed < HEALTH_TIMEOUT)); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)"
  case "$status" in
  healthy)
    ok "healthy après ${elapsed}s"
    break
    ;;
  unhealthy)
    break
    ;;
  esac
  sleep 3
  elapsed=$((elapsed + 3))
done

if [[ "$status" != "healthy" ]]; then
  printf '\n\033[1;31m✗\033[0m Le conteneur n'"'"'est pas devenu healthy (%s).\n' "$status" >&2
  echo "--- 40 dernières lignes de journal ---" >&2
  docker logs --tail 40 "$CONTAINER" 2>&1 >&2 || true

  if [[ -n "$PREVIOUS_IMAGE" && "$PREVIOUS_IMAGE" != "$NEW_IMAGE" ]]; then
    info "Retour à la version précédente : $PREVIOUS_IMAGE"
    export "$IMAGE_VAR=$PREVIOUS_IMAGE"
    # Persisted here too, so the file keeps describing what is running. A
    # rollback that left `.env` pointing at the failed image would put that
    # image back at the next manual restart.
    persist_var "$IMAGE_VAR" "$PREVIOUS_IMAGE"
    docker compose up -d --no-deps "$SERVICE" && ok "version précédente rétablie"
  else
    echo "Aucune version précédente à rétablir." >&2
  fi
  exit 1
fi

# --- Cleanup --------------------------------------------------------------
#
# Keep a few recent images so a manual rollback stays instant, and drop the
# rest so the disk does not fill up over an edition.
info "Nettoyage des anciennes images"
mapfile -t old_images < <(
  docker images "defi-movember" --filter "reference=defi-movember:${ENVIRONMENT}-*" \
    --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' |
    sort -r | tail -n "+$((KEEP_IMAGES + 1))" | cut -f2
)
for img in "${old_images[@]:-}"; do
  [[ -n "$img" ]] && docker rmi "$img" >/dev/null 2>&1 || true
done
ok "${KEEP_IMAGES} images les plus récentes conservées"

# --- Scheduled tasks ------------------------------------------------------
#
# Installed from the repository, on production deployments only, replacing
# whatever was there. That is deliberate: a task added by hand on the server
# would vanish at the next deployment without anyone noticing, and a task
# removed from the repository would keep running for months. Installing it
# every time is what keeps the server and `deploy/crontab` in agreement.
#
# Staging is left alone — it has no business running scheduled tasks against
# a database it shares with production.
if [[ "$ENVIRONMENT" == "production" ]]; then
  info "Installation des tâches planifiées"

  if [[ -f "$APP_DIR/deploy/crontab" ]]; then
    if crontab "$APP_DIR/deploy/crontab"; then
      ok "$(crontab -l 2>/dev/null | grep -cE '^[^#[:space:]]' || echo 0) tâches installées"
    else
      # Not fatal: the application is deployed and serving. Scheduled tasks
      # matter from epic 4 onwards, and failing the whole deployment over
      # them would be the wrong trade — but it must be said loudly.
      printf '  \033[1;31m✗\033[0m Le crontab n'"'"'a pas pu être installé. Les tâches planifiées ne tourneront pas.\n' >&2
    fi
  else
    echo "  deploy/crontab est absent — aucune tâche planifiée installée." >&2
  fi
fi

printf '\n\033[1;32m✓ Déploiement %s réussi — %s\033[0m\n\n' "$ENVIRONMENT" "$SHORT_SHA"
