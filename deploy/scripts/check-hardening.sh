#!/usr/bin/env bash
#
# DEFI Movember — audit du durcissement du serveur (story 11.8).
#
#   bash deploy/scripts/check-hardening.sh
#
# **Vérifier, pas recommander.** Le durcissement était déjà décrit dans
# `bootstrap-vps.sh`, sous forme de commandes à lancer soi-même. Le critère de
# sortie de l'epic 11 n'est pas « le durcissement est documenté », c'est « le
# durcissement est vérifié » — et une liste de conseils ne se vérifie pas.
#
# Ce script ne change RIEN. Il regarde, il dit, il s'arrête. Un script qui
# durcirait tout seul pourrait couper l'accès SSH du PO à son propre serveur
# un dimanche soir, et c'est exactement le genre d'automatisme qu'il ne faut
# pas écrire.
#
# À lancer en root sur le VPS, avant l'ouverture des inscriptions, puis une
# fois par mois. La sortie est faite pour être lue par quelqu'un qui n'est pas
# administrateur système : chaque ligne dit ce qui va, ce qui ne va pas, et
# quoi taper.
#
# Code de sortie : 0 si tout passe, 1 sinon. Utilisable dans une tâche
# planifiée si le PO le souhaite un jour.

set -uo pipefail

PASS=0
FAIL=0

ok()   { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad()  { echo "  ✗ $1"; echo "      → $2"; FAIL=$((FAIL + 1)); }
skip() { echo "  · $1"; }

title() { echo; echo "$1"; echo "${1//?/─}"; }

# -------------------------------------------------------------------------
title "Accès SSH"
# -------------------------------------------------------------------------
#
# Le point le plus important de la liste. Un mot de passe SSH sur un serveur
# public est testé par des milliers de machines par jour, en continu, et il
# finit par tomber.

SSHD_CONFIG="$(sshd -T 2>/dev/null || true)"

if [[ -z "$SSHD_CONFIG" ]]; then
  skip "configuration SSH illisible (lancer ce script en root)"
else
  if grep -qi '^passwordauthentication no' <<< "$SSHD_CONFIG"; then
    ok "connexion par mot de passe refusée"
  else
    bad "connexion par mot de passe AUTORISÉE" \
        "sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart ssh"
  fi

  if grep -qi '^permitrootlogin no' <<< "$SSHD_CONFIG"; then
    ok "connexion root refusée"
  else
    bad "connexion root AUTORISÉE" \
        "sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl restart ssh"
  fi
fi

# -------------------------------------------------------------------------
title "Pare-feu"
# -------------------------------------------------------------------------
#
# Ce qui n'est pas ouvert n'est pas attaquable. Trois ports suffisent, et
# Postgres n'en fait pas partie : la base est chez Supabase.

if command -v ufw >/dev/null; then
  if ufw status 2>/dev/null | grep -q '^Status: active'; then
    ok "pare-feu actif"

    for port in 22 80 443; do
      if ufw status | grep -qE "(^|\s)$port(/tcp)?\s.*ALLOW"; then
        ok "port $port ouvert"
      else
        skip "port $port non listé explicitement (vérifier: ufw status)"
      fi
    done
  else
    bad "pare-feu INACTIF" \
        "ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable"
  fi
else
  bad "ufw non installé" "apt install -y ufw"
fi

# -------------------------------------------------------------------------
title "Mises à jour de sécurité"
# -------------------------------------------------------------------------
#
# Un serveur qu'on n'a pas mis à jour depuis novembre est un serveur qui
# tourne avec les failles publiées en décembre. Automatique, ou pas du tout :
# personne ne se connecte chaque semaine pour taper `apt upgrade`.

if dpkg -s unattended-upgrades >/dev/null 2>&1; then
  ok "unattended-upgrades installé"

  if grep -rqs '^APT::Periodic::Unattended-Upgrade "1"' /etc/apt/apt.conf.d/; then
    ok "mises à jour automatiques activées"
  else
    bad "installé mais NON activé" \
        "dpkg-reconfigure -plow unattended-upgrades"
  fi
else
  bad "unattended-upgrades absent" "apt install -y unattended-upgrades"
fi

# -------------------------------------------------------------------------
title "Protection contre les tentatives répétées"
# -------------------------------------------------------------------------

if systemctl is-active --quiet fail2ban 2>/dev/null; then
  ok "fail2ban actif"
else
  bad "fail2ban inactif ou absent" "apt install -y fail2ban && systemctl enable --now fail2ban"
fi

# -------------------------------------------------------------------------
title "Secrets sur le disque"
# -------------------------------------------------------------------------
#
# Les fichiers d'environnement portent la clé de service Supabase, le secret
# Stripe et la chaîne de connexion à la base. Lisibles par tout le monde sur
# la machine, ils annulent le reste de cette liste.

APP_DIR="${APP_DIR:-/opt/defi-movember}"
FOUND_ENV=false

for file in "$APP_DIR"/deploy/.env "$APP_DIR"/deploy/.env.production "$APP_DIR"/deploy/.env.staging; do
  [[ -f "$file" ]] || continue
  FOUND_ENV=true

  MODE="$(stat -c %a "$file")"

  if [[ "$MODE" == "600" ]]; then
    ok "$(basename "$file") en 600"
  else
    bad "$(basename "$file") en $MODE — lisible par d'autres comptes" \
        "chmod 600 $file"
  fi
done

$FOUND_ENV || skip "aucun fichier d'environnement trouvé dans $APP_DIR/deploy"

# Une clé privée dans le dépôt cloné serait le pire des cas : elle partirait
# au prochain `git add`.
if find "$APP_DIR" -maxdepth 3 -name 'id_*' -o -maxdepth 3 -name '*.pem' 2>/dev/null | grep -q .; then
  bad "une clé privée se trouve dans le dossier de l'application" \
      "la déplacer hors de $APP_DIR — elle risque de partir dans un commit"
else
  ok "aucune clé privée dans le dossier de l'application"
fi

# -------------------------------------------------------------------------
title "Sauvegardes"
# -------------------------------------------------------------------------
#
# Configurées ne suffit pas : le critère de sortie de l'epic est qu'une
# sauvegarde ait été RESTAURÉE. Ce bloc vérifie qu'il y en a une récente ;
# la restauration, elle, se répète à la main (docs/runbook.md).

BACKUP_DIR="${BACKUP_DIR:-/var/backups/defi-movember}"

if [[ -d "$BACKUP_DIR" ]]; then
  RECENT="$(find "$BACKUP_DIR" -name 'defi-movember-*.sql.gz' -mtime -2 | wc -l)"

  if (( RECENT > 0 )); then
    ok "$RECENT sauvegarde(s) de moins de 48 h"
  else
    bad "aucune sauvegarde récente dans $BACKUP_DIR" \
        "bash $APP_DIR/deploy/scripts/backup-database.sh"
  fi
else
  bad "aucun dossier de sauvegarde" \
      "bash $APP_DIR/deploy/scripts/backup-database.sh --check"
fi

# -------------------------------------------------------------------------
title "Tâches planifiées"
# -------------------------------------------------------------------------
#
# Sans elles, aucun défi n'est distribué le matin. C'est le défaut le plus
# grave possible en novembre, et il est silencieux.

DEPLOY_USER="${DEPLOY_USER:-deploy}"
CRON_COUNT="$(crontab -u "$DEPLOY_USER" -l 2>/dev/null | grep -c '^[0-9*]' || true)"

if (( CRON_COUNT >= 5 )); then
  ok "$CRON_COUNT tâches installées pour $DEPLOY_USER"
else
  bad "seulement $CRON_COUNT tâche(s) pour $DEPLOY_USER" \
      "crontab -u $DEPLOY_USER $APP_DIR/deploy/crontab"
fi

# -------------------------------------------------------------------------
echo
echo "═══════════════════════════════════════════════"
echo " $PASS vérification(s) au vert, $FAIL au rouge"
echo "═══════════════════════════════════════════════"

if (( FAIL > 0 )); then
  echo
  echo "Chaque ligne rouge porte la commande qui la corrige."
  echo "⚠️  Les deux premières touchent l'accès SSH : garder une session"
  echo "    ouverte pendant l'opération, et vérifier depuis une SECONDE"
  echo "    session avant de fermer la première."
  exit 1
fi

echo
echo "Rien à corriger. À relancer une fois par mois, et avant l'ouverture"
echo "des inscriptions."
exit 0
