#!/usr/bin/env bash
#
# DEFI Movember — répétition d'une restauration de sauvegarde (story 11.5).
#
#   sudo bash deploy/scripts/restore-rehearsal.sh
#   sudo bash deploy/scripts/restore-rehearsal.sh /var/backups/defi-movember/defi-movember-2026-10-15.sql.gz
#
# **Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde.** C'est
# le critère de sortie de l'epic 11, et il est resté ouvert parce que la
# procédure écrite demandait de créer un projet Supabase d'essai — assez de
# travail pour que ce soit toujours remis à plus tard.
#
# Ce script fait la même chose en une commande : il démarre une base Postgres
# jetable dans un conteneur, y déverse la sauvegarde, compte ce qui est
# revenu, puis détruit le conteneur.
#
# **Il ne peut pas toucher la production.** La seule base qu'il écrit est celle
# qu'il vient de créer lui-même ; DATABASE_URL n'est jamais lue. C'est
# volontaire : le danger d'une restauration n'est pas qu'elle échoue, c'est
# qu'elle réussisse sur la mauvaise base.
#
# Prérequis : Docker (déjà présent, l'application tourne dedans).

set -uo pipefail

APP_DIR="${APP_DIR:-/opt/defi-movember}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/defi-movember}"

# Nom fixe : deux répétitions lancées coup sur coup ne doivent pas laisser
# deux conteneurs derrière elles.
CONTAINER="${CONTAINER:-defi-movember-restore-test}"
IMAGE="${IMAGE:-postgres:16-alpine}"

log() { echo "[$(date '+%F %T')] $*"; }
fail() { log "✗ $*" >&2; cleanup; exit 1; }

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}

# Même en cas d'interruption au clavier : un conteneur Postgres oublié
# consomme de la mémoire sur une machine qui n'en a pas de trop.
trap cleanup EXIT INT TERM

# -------------------------------------------------------------------------
# Choisir la sauvegarde
# -------------------------------------------------------------------------

command -v docker >/dev/null || fail "docker introuvable"

DUMP="${1:-}"

if [[ -z "$DUMP" ]]; then
  # La plus récente : c'est celle dont on veut savoir si elle vaut quelque
  # chose. Répéter sur une vieille copie ne dit rien de la sauvegarde de cette
  # nuit.
  DUMP="$(find "$BACKUP_DIR" -name 'defi-movember-*.sql.gz' -print 2>/dev/null \
    | sort | tail -1)"
fi

[[ -n "$DUMP" && -f "$DUMP" ]] \
  || fail "aucune sauvegarde trouvée dans $BACKUP_DIR (lancer backup-database.sh)"

log "sauvegarde : $DUMP ($(du -h "$DUMP" | cut -f1))"

# -------------------------------------------------------------------------
# Une base jetable
# -------------------------------------------------------------------------

cleanup

# Le mot de passe ne quitte pas cette exécution et la base disparaît à la fin.
PGPASS="$(openssl rand -hex 16 2>/dev/null || echo "repetition-locale")"

log "démarrage d'une base d'essai ($IMAGE)…"

# Aucun port publié : tout se fait par `docker exec`. Une base d'essai
# joignable depuis le réseau, même une minute, même sur la boucle locale, est
# une porte qu'on n'a aucune raison d'ouvrir.
docker run -d --rm \
  --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$PGPASS" \
  -e POSTGRES_DB=repetition \
  "$IMAGE" >/dev/null \
  || fail "le conteneur n'a pas démarré"

# `pg_isready` plutôt qu'une attente fixe : sur un VPS chargé, cinq secondes
# ne suffisent pas toujours, et trente sont trente de perdues à chaque fois.
READY=false
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null; then
    READY=true
    break
  fi
  sleep 1
done

$READY || fail "la base d'essai n'a pas démarré en 60 s"

log "✓ base d'essai prête"

# Les rôles que Supabase attribue dans son dump. Ils n'existent pas dans un
# Postgres nu, et leur absence transforme la restauration en mur d'erreurs qui
# masque les vraies. `--no-owner --no-privileges` en évite la plupart ; ceux-ci
# restent parce qu'ils sont cités dans des politiques RLS.
docker exec -i "$CONTAINER" psql -U postgres -d repetition -q >/dev/null 2>&1 <<'SQL'
do $$
declare r text;
begin
  foreach r in array array[
    'anon', 'authenticated', 'service_role', 'authenticator',
    'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin',
    'dashboard_user', 'pgbouncer'
  ] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
SQL

# -------------------------------------------------------------------------
# Restaurer
# -------------------------------------------------------------------------

log "restauration en cours…"

ERR_LOG="$(mktemp)"

gunzip -c "$DUMP" \
  | docker exec -i -e PGPASSWORD="$PGPASS" "$CONTAINER" \
      psql -U postgres -d repetition -q >/dev/null 2>"$ERR_LOG"

# `grep -c` sort en 1 quand il ne trouve rien, tout en affichant « 0 » :
# l'assignation reprend ce code de sortie, la valeur est déjà bonne.
ERRORS="$(grep -c '^ERROR' "$ERR_LOG")" || ERRORS=0

# **Des erreurs sont attendues, et ce n'est pas un échec.** Le dump contient
# les schémas internes de Supabase — `auth`, `storage`, les extensions
# `pg_graphql` et `supabase_vault` — qui n'ont aucune raison d'exister dans un
# Postgres ordinaire. Ce qui est jugé plus bas, c'est ce qui compte : les
# données du jeu sont-elles revenues.
if (( ERRORS > 0 )); then
  log "  $ERRORS erreur(s) pendant la restauration (attendu : schémas internes Supabase)"
  log "  échantillon :"
  grep '^ERROR' "$ERR_LOG" | sed 's/^/      /' | head -5
fi

rm -f "$ERR_LOG"

# -------------------------------------------------------------------------
# Ce qui est revenu
# -------------------------------------------------------------------------

echo
echo "Contenu restauré"
echo "────────────────"

TABLES=(
  profiles
  registrations
  payments
  activities
  challenge_assignments
  card_instances
  teams
)

RESTORED=0
EMPTY=0

for table in "${TABLES[@]}"; do
  COUNT="$(docker exec -e PGPASSWORD="$PGPASS" "$CONTAINER" \
    psql -U postgres -d repetition -tAc \
    "select count(*) from public.$table" 2>/dev/null || echo "")"

  if [[ -z "$COUNT" ]]; then
    echo "  ✗ public.$table — table absente"
    EMPTY=$((EMPTY + 1))
  elif (( COUNT == 0 )); then
    echo "  · public.$table — 0 ligne"
  else
    echo "  ✓ public.$table — $COUNT ligne(s)"
    RESTORED=$((RESTORED + 1))
  fi
done

echo
echo "═══════════════════════════════════════════════"

if (( EMPTY > 0 )); then
  echo " ✗ $EMPTY table(s) absente(s) — la sauvegarde est incomplète"
  echo "═══════════════════════════════════════════════"
  echo
  echo "Ne pas s'en contenter : relancer backup-database.sh et"
  echo "recommencer. Une sauvegarde à laquelle il manque une table"
  echo "est une sauvegarde qui ne servira à rien le jour venu."
  exit 1
fi

echo " ✓ restauration réussie — $RESTORED table(s) avec des données"
echo "═══════════════════════════════════════════════"
echo
echo "La base d'essai est détruite en sortant. La production n'a pas"
echo "été touchée : ce script ne lit jamais DATABASE_URL."
echo
echo "À refaire une fois avant l'ouverture des inscriptions, et une"
echo "fois en novembre."

exit 0
