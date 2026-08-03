#!/usr/bin/env bash
#
# DEFI Movember — one-off VPS preparation.
#
# Creates the deployment user, its Docker access and the application
# directory, then prints the exact next steps. Safe to re-run: every step is
# idempotent.
#
# Run as root ON THE VPS:
#   bash bootstrap-vps.sh
#
# It deliberately does NOT touch the firewall or the SSH server config.
# Getting either wrong locks you out of your own machine, and neither can be
# undone remotely. Those are printed as suggestions at the end instead.

set -euo pipefail

DEPLOY_USER="deploy"
APP_DIR="/opt/defi-movember"

info() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
ok() { printf '  \033[1;32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$1"; }

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit être lancé en root (ou avec sudo)." >&2
  exit 1
fi

# Creating users and granting Docker access is not something to do on the
# wrong machine by accident, and it cannot be undone remotely. Confirm which
# host this is before touching anything. `--yes` skips it for automation.
if [[ "${1:-}" != "--yes" ]]; then
  cat <<EOF

Ce script va modifier CETTE machine :

  Nom d'hôte  : $(hostname)
  Système     : $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo inconnu)
  Adresse IP  : $(hostname -I 2>/dev/null | awk '{print $1}')

Il va y créer un utilisateur « $DEPLOY_USER », lui donner accès à Docker,
et créer le dossier $APP_DIR.

EOF
  read -r -p "Est-ce bien votre VPS Hostinger ? [oui/non] " answer
  if [[ "$answer" != "oui" ]]; then
    echo "Annulé — rien n'a été modifié."
    exit 0
  fi
fi

# --- Prerequisites --------------------------------------------------------
info "Vérification de Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker n'est pas installé. Installez-le d'abord :" >&2
  echo "  curl -fsSL https://get.docker.com | sh" >&2
  exit 1
fi
ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"

if ! docker compose version >/dev/null 2>&1; then
  echo "Le plugin 'docker compose' est absent. Installez docker-compose-plugin." >&2
  exit 1
fi
ok "Compose $(docker compose version --short)"

# --- Deployment user ------------------------------------------------------
info "Utilisateur de déploiement : $DEPLOY_USER"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  ok "existe déjà"
else
  # No password is set: this account is reachable by SSH key only.
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  ok "créé"
fi

usermod -aG docker "$DEPLOY_USER"
ok "membre du groupe docker"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
ok "dossier .ssh prêt"

# --- Application directory ------------------------------------------------
info "Dossier applicatif : $APP_DIR"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
ok "prêt"

# --- Summary --------------------------------------------------------------
IP_ADDR="$(hostname -I 2>/dev/null | awk '{print $1}')"

cat <<EOF

────────────────────────────────────────────────────────────────────────
 Serveur prêt.
────────────────────────────────────────────────────────────────────────

 Système        : $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo inconnu)
 Adresse IP     : ${IP_ADDR:-à relever manuellement}
 Utilisateur    : $DEPLOY_USER
 Dossier        : $APP_DIR

 ÉTAPE SUIVANTE — depuis VOTRE ordinateur, pas depuis le serveur :

   1. Générer une paire de clés dédiée au déploiement
      ssh-keygen -t ed25519 -f ~/.ssh/defi-movember-deploy -N "" -C "github-actions"

   2. Envoyer la clé PUBLIQUE sur le serveur
      ssh-copy-id -i ~/.ssh/defi-movember-deploy.pub $DEPLOY_USER@${IP_ADDR:-IP_DU_SERVEUR}

   3. Vérifier que la connexion fonctionne
      ssh -i ~/.ssh/defi-movember-deploy $DEPLOY_USER@${IP_ADDR:-IP_DU_SERVEUR} "docker ps"

   4. Copier la clé PRIVÉE dans les secrets GitHub du dépôt
      cat ~/.ssh/defi-movember-deploy
      → GitHub → Settings → Secrets and variables → Actions → New secret
        VPS_SSH_KEY  = le contenu affiché, en entier
        VPS_HOST     = ${IP_ADDR:-IP_DU_SERVEUR}
        VPS_USER     = $DEPLOY_USER

   La clé privée ne doit être collée QUE dans GitHub. Jamais dans une
   conversation, jamais dans le dépôt, jamais par e-mail.

 DURCISSEMENT RECOMMANDÉ — à faire vous-même, sans précipitation :

   Ces commandes peuvent vous couper l'accès à votre propre serveur si
   elles sont lancées avant d'avoir vérifié l'étape 3 ci-dessus.

   # Pare-feu : n'ouvrir que SSH, HTTP et HTTPS
   ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

   # Mises à jour de sécurité automatiques
   apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades

   # Protection contre les tentatives répétées
   apt install -y fail2ban

   # Interdire la connexion root et par mot de passe
   # (UNIQUEMENT après avoir confirmé que l'étape 3 fonctionne)
   sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   systemctl restart ssh

────────────────────────────────────────────────────────────────────────
EOF
