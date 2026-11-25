#!/usr/bin/env bash
#
# DEFI Movember — database backup, run by cron ON THE VPS (story 11.5).
#
#   bash deploy/scripts/backup-database.sh [--check]
#
# **Why this exists when Supabase already backs up.** Supabase's own backups
# depend on the plan, are retained for a period we do not control, and — the
# part that matters — cannot be restored into a database we own for a
# rehearsal. This copy can. The exit criterion of epic 11 is not "a backup is
# configured", it is "a backup has been restored", and that sentence is only
# testable with a dump we hold.
#
# It is also the answer to the one failure Supabase's backups do not cover: a
# mistake of ours. A migration that drops the wrong column, a purge with a bad
# date — those are valid operations, replicated instantly, and only a copy
# from BEFORE them brings anything back.
#
# Requires, in deploy/.env:
#   DATABASE_URL   the Supabase connection string (direct connection, not the
#                  pooler: pg_dump needs session-level features)
#
# ⚠️ That string contains the database password. It goes in deploy/.env at
# chmod 600, never in this repository and never in a conversation.
#
# Install: the crontab in deploy/crontab does it. Never by hand on the server.

set -uo pipefail

APP_DIR="${APP_DIR:-/opt/defi-movember}"
ENV_FILE="$APP_DIR/deploy/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/defi-movember}"

# Seven days. Long enough to notice a mistake made on a Friday and act on the
# Monday; short enough that a month of dumps does not fill the disk the
# resource watch is guarding.
KEEP_DAYS="${KEEP_DAYS:-7}"

# A dump smaller than this is not a database, it is an error message. Refusing
# to keep it is the whole point: the classic way to lose everything is a
# broken backup quietly replacing the last good one, every night, for a month.
MIN_BYTES="${MIN_BYTES:-20480}"

CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true

log() { echo "[$(date '+%F %T')] $*"; }
fail() { log "✗ $*" >&2; exit 1; }

# -------------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------------

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" >/dev/null 2>&1
  set +a
fi

[[ -n "${DATABASE_URL:-}" ]] \
  || fail "DATABASE_URL absent de $ENV_FILE. Voir docs/runbook.md."

command -v pg_dump >/dev/null \
  || fail "pg_dump introuvable. Installer: apt install postgresql-client"

if [[ "$CHECK_ONLY" == true ]]; then
  log "✓ configuration présente, pg_dump disponible"
  log "  dossier : $BACKUP_DIR (conservation : $KEEP_DAYS jours)"
  ls -lh "$BACKUP_DIR" 2>/dev/null | tail -10 || log "  (aucune sauvegarde encore)"
  exit 0
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d)"
TARGET="$BACKUP_DIR/defi-movember-$STAMP.sql.gz"

# Written to a temporary name first, and only renamed once its size has been
# checked. A dump interrupted halfway would otherwise sit there looking like
# the day's backup.
TEMP="$TARGET.partial"

log "sauvegarde en cours…"

# `--no-owner --no-privileges`: the roles of a Supabase project do not exist
# in a database we restore into for a rehearsal, and their absence would turn
# a restore into a wall of permission errors.
if ! pg_dump "$DATABASE_URL" \
      --no-owner --no-privileges --clean --if-exists \
      2>/tmp/defi-movember-backup.err \
   | gzip -9 > "$TEMP"; then
  rm -f "$TEMP"
  log "erreur pg_dump :"
  cat /tmp/defi-movember-backup.err >&2 || true
  fail "sauvegarde échouée — la précédente est intacte"
fi

SIZE="$(stat -c %s "$TEMP" 2>/dev/null || echo 0)"

if (( SIZE < MIN_BYTES )); then
  rm -f "$TEMP"
  fail "dump anormalement petit ($SIZE octets) — refusé, la précédente est intacte"
fi

mv "$TEMP" "$TARGET"
chmod 600 "$TARGET"

log "✓ $TARGET ($(numfmt --to=iec "$SIZE" 2>/dev/null || echo "$SIZE octets"))"

# Rotation last, and only after a successful dump. Deleting the old ones first
# would mean a failed night leaves nothing at all.
DELETED="$(find "$BACKUP_DIR" -name 'defi-movember-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete | wc -l)"
(( DELETED > 0 )) && log "  $DELETED sauvegarde(s) au-delà de $KEEP_DAYS jours supprimée(s)"

# The count, every night. One line that says "7 copies" is what turns a
# backup into something somebody trusts.
COUNT="$(find "$BACKUP_DIR" -name 'defi-movember-*.sql.gz' | wc -l)"
log "  $COUNT sauvegarde(s) conservée(s)"

exit 0
