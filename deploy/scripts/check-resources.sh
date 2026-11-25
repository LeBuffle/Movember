#!/usr/bin/env bash
#
# DEFI Movember — disk and memory watch, run by cron ON THE VPS.
#
#   bash deploy/scripts/check-resources.sh [--dry-run]
#
# Warns BEFORE saturation, which is the only moment a warning is useful. A
# full disk does not announce itself: the site starts refusing requests for
# reasons that make no sense, Docker cannot write a layer, Postgres clients
# cannot open a socket. By the time the cause is obvious, the evening is
# gone.
#
# Alerts go to a webhook rather than an e-mail. A VPS with no mail server
# configured silently drops mail, which is the worst possible property for an
# alerting channel — it looks like it works right up to the moment it
# matters. A webhook either answers or it does not, and this script says
# which.
#
# Install (see docs/runbook.md):
#   crontab -e
#   */10 * * * * bash /opt/defi-movember/deploy/scripts/check-resources.sh

set -uo pipefail

APP_DIR="${APP_DIR:-/opt/defi-movember}"
ENV_FILE="$APP_DIR/deploy/.env"
STATE_DIR="${STATE_DIR:-/var/tmp/defi-movember}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Thresholds. Deliberately not tight: an alert that fires on a normal Tuesday
# is an alert nobody reads by November.
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-80}"
MEMORY_WARN_PERCENT="${MEMORY_WARN_PERCENT:-90}"

# Loaded for ALERT_WEBHOOK_URL. `set -a` exports what the file defines; the
# subshell keeps the rest of this script's variables out of its way.
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" >/dev/null 2>&1
  set +a
fi

mkdir -p "$STATE_DIR"

# -------------------------------------------------------------------------
# Measurements
# -------------------------------------------------------------------------

disk_percent() {
  df --output=pcent / | tail -1 | tr -dc '0-9'
}

memory_percent() {
  # `available` rather than `free`: Linux uses spare memory for cache, and
  # reading `free` reports a healthy server as nearly full every single time.
  awk '
    /^MemTotal:/     { total = $2 }
    /^MemAvailable:/ { available = $2 }
    END { if (total > 0) printf "%d", (total - available) * 100 / total }
  ' /proc/meminfo
}

# -------------------------------------------------------------------------
# Alerting
# -------------------------------------------------------------------------

# One alert per problem per day. Cron runs this every ten minutes; without
# this, a disk at 81% would send 144 identical messages before anyone woke
# up, and the 145th would be ignored along with the rest.
already_alerted_today() {
  local key="$1"
  local marker="$STATE_DIR/alerted-$key-$(date +%F)"
  [[ -f "$marker" ]] && return 0
  touch "$marker"
  return 1
}

send_alert() {
  local key="$1" message="$2"

  # Always on stdout: cron mails it locally if a mail spool exists, and it
  # lands in the journal either way. The webhook is the channel that reaches
  # a phone; this is the one that survives the webhook being misconfigured.
  echo "[$(date --iso-8601=seconds)] ALERTE $key : $message"

  if $DRY_RUN; then
    echo "  (essai à blanc : rien n'est envoyé)"
    return 0
  fi

  already_alerted_today "$key" && return 0

  if [[ -z "${ALERT_WEBHOOK_URL:-}" ]]; then
    echo "  ALERT_WEBHOOK_URL n'est pas renseigné dans $ENV_FILE — alerte non transmise." >&2
    return 1
  fi

  # `--fail` so a webhook answering 4xx is reported rather than assumed
  # delivered. Silence here would defeat the whole point.
  if curl --fail --silent --show-error --max-time 10 \
    -H "Content-Type: application/json" \
    -d "{\"source\":\"defi-movember\",\"host\":\"$(hostname)\",\"level\":\"warning\",\"check\":\"$key\",\"message\":\"$message\"}" \
    "$ALERT_WEBHOOK_URL" >/dev/null; then
    echo "  alerte transmise"
  else
    echo "  ÉCHEC de transmission de l'alerte" >&2
    return 1
  fi
}

# -------------------------------------------------------------------------
# Checks
# -------------------------------------------------------------------------

problems=0

disk=$(disk_percent)
if [[ -n "$disk" ]] && ((disk >= DISK_WARN_PERCENT)); then
  send_alert "disque" "Le disque de / est occupé à ${disk}% (seuil ${DISK_WARN_PERCENT}%). Voir « Le disque est plein » dans docs/runbook.md."
  problems=$((problems + 1))
else
  echo "disque : ${disk}% (seuil ${DISK_WARN_PERCENT}%) — ok"
fi

memory=$(memory_percent)
if [[ -n "$memory" ]] && ((memory >= MEMORY_WARN_PERCENT)); then
  send_alert "memoire" "La mémoire est occupée à ${memory}% (seuil ${MEMORY_WARN_PERCENT}%). Voir « Le serveur rame » dans docs/runbook.md."
  problems=$((problems + 1))
else
  echo "mémoire : ${memory}% (seuil ${MEMORY_WARN_PERCENT}%) — ok"
fi

# Docker images accumulate: every deploy builds a new one, and the deploy
# script keeps the last three. Anything else is dead weight nobody thinks to
# look for until the disk is full.
if command -v docker >/dev/null 2>&1; then
  reclaimable=$(docker system df --format '{{.Type}} {{.Reclaimable}}' 2>/dev/null | head -20)
  [[ -n "$reclaimable" ]] && echo "récupérable par docker : $(echo "$reclaimable" | tr '\n' '; ')"
fi

exit "$((problems > 0 ? 1 : 0))"
