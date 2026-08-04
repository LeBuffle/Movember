#!/usr/bin/env bash
#
# DEFI Movember — manual rollback, run ON THE VPS.
#
#   bash deploy/scripts/rollback.sh [production|staging] [image-tag]
#
# Puts the previous version back. The deployment script already rolls back on
# its own when a new container fails to become healthy; this is for the other
# case — the deployment succeeded, the container is perfectly healthy, and
# the site is wrong. A broken page, a bad price, a challenge that validates
# when it should not. Nothing automatic will catch that, and in November it
# has to be undone in under a minute.
#
# Restore first, understand afterwards.

set -uo pipefail

ENVIRONMENT="${1:-production}"
REQUESTED_TAG="${2:-}"

APP_DIR="${APP_DIR:-/opt/defi-movember}"
DEPLOY_DIR="$APP_DIR/deploy"
HEALTH_TIMEOUT=90

case "$ENVIRONMENT" in
production)
  SERVICE="app"
  IMAGE_VAR="APP_IMAGE"
  VERSION_VAR="APP_VERSION"
  ;;
staging)
  SERVICE="app-staging"
  IMAGE_VAR="STAGING_IMAGE"
  VERSION_VAR="STAGING_APP_VERSION"
  ;;
*)
  echo "Environnement inconnu : $ENVIRONMENT (attendu : production ou staging)" >&2
  exit 1
  ;;
esac

info() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
ok() { printf '  \033[1;32m✓\033[0m %s\n' "$1"; }
fail() {
  printf '  \033[1;31m✗\033[0m %s\n' "$1" >&2
  exit 1
}

cd "$DEPLOY_DIR" || fail "$DEPLOY_DIR est introuvable."

CONTAINER="defi-movember-${SERVICE}-1"
CURRENT_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"

# --- Choose the target ----------------------------------------------------
#
# The images are named `defi-movember:<environment>-<short sha>` and Docker
# lists them newest first. The one to go back to is therefore the first that
# is not the one running.
info "Versions disponibles pour $ENVIRONMENT"

mapfile -t available < <(
  docker images "defi-movember" \
    --filter "reference=defi-movember:${ENVIRONMENT}-*" \
    --format '{{.Repository}}:{{.Tag}}\t{{.CreatedSince}}'
)

if ((${#available[@]} == 0)); then
  fail "Aucune image conservée pour $ENVIRONMENT. Il n'y a rien à rétablir."
fi

for line in "${available[@]}"; do
  image="${line%%$'\t'*}"
  marker="  "
  [[ "$image" == "$CURRENT_IMAGE" ]] && marker="→ "
  printf '%s%s\n' "$marker" "$line"
done
echo "  (→ = version actuellement en service)"

if [[ -n "$REQUESTED_TAG" ]]; then
  TARGET_IMAGE="defi-movember:${REQUESTED_TAG#defi-movember:}"
  docker image inspect "$TARGET_IMAGE" >/dev/null 2>&1 ||
    fail "L'image $TARGET_IMAGE n'existe pas sur ce serveur."
else
  TARGET_IMAGE=""
  for line in "${available[@]}"; do
    image="${line%%$'\t'*}"
    if [[ "$image" != "$CURRENT_IMAGE" ]]; then
      TARGET_IMAGE="$image"
      break
    fi
  done
  [[ -n "$TARGET_IMAGE" ]] ||
    fail "Une seule version est conservée : il n'y a pas de version antérieure à rétablir."
fi

# --- Confirm --------------------------------------------------------------
#
# Production is asked about, staging is not. The one question this asks is
# the one that catches the real mistake: rolling back the wrong environment,
# or rolling back to the version that is already running.
info "Retour arrière"
echo "  environnement : $ENVIRONMENT"
echo "  en service    : ${CURRENT_IMAGE:-inconnue}"
echo "  à rétablir    : $TARGET_IMAGE"

if [[ "$ENVIRONMENT" == "production" && -t 0 ]]; then
  read -r -p $'\nConfirmer le retour arrière en PRODUCTION ? (oui/non) ' answer
  [[ "$answer" == "oui" ]] || fail "Annulé. Rien n'a été touché."
fi

# --- Switch ---------------------------------------------------------------
export "$IMAGE_VAR=$TARGET_IMAGE"
export "$VERSION_VAR=${TARGET_IMAGE##*-}"

docker compose up -d --no-deps --force-recreate "$SERVICE" ||
  fail "La bascule a échoué. Le conteneur précédent est peut-être encore en service — vérifiez avec « docker compose ps »."

# --- Health ---------------------------------------------------------------
info "Attente de l'état healthy (max ${HEALTH_TIMEOUT}s)"
elapsed=0
status=""

while ((elapsed < HEALTH_TIMEOUT)); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)"
  [[ "$status" == "healthy" || "$status" == "unhealthy" ]] && break
  sleep 3
  elapsed=$((elapsed + 3))
done

if [[ "$status" != "healthy" ]]; then
  printf '\n\033[1;31m✗\033[0m La version rétablie ne démarre pas non plus (%s).\n' "$status" >&2
  echo "--- 40 dernières lignes de journal ---" >&2
  docker logs --tail 40 "$CONTAINER" >&2 2>&1 || true
  echo >&2
  echo "Essayez une version encore antérieure :" >&2
  echo "  bash $0 $ENVIRONMENT <étiquette>" >&2
  exit 1
fi

ok "version rétablie et en bonne santé après ${elapsed}s"

echo
echo "⚠  Ce retour arrière tient jusqu'au prochain déploiement, qui remettra"
echo "   la version que vous venez de retirer. Corrigez la cause, ou suspendez"
echo "   les déploiements le temps de le faire."
