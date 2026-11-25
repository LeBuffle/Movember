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

AUTH_KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "$AUTH_KEYS"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"
ok "dossier .ssh prêt"

# --- Public key -----------------------------------------------------------
#
# The account is created with --disabled-password, which is what we want: it
# can only ever be reached by key. The consequence is that `ssh-copy-id`
# cannot work — it needs a password to log in and drop the key. So the key is
# installed from here, where we already have root.
info "Clé publique de déploiement"
if [[ -s "$AUTH_KEYS" ]]; then
  ok "$(wc -l <"$AUTH_KEYS") clé(s) déjà autorisée(s)"
fi

cat <<'EOF'

  Sur VOTRE ordinateur, générez la paire de clés si ce n'est pas déjà fait :

    ssh-keygen -t ed25519 -f ~/.ssh/defi-movember-deploy -N "" -C "github-actions"

  Puis affichez la clé PUBLIQUE et copiez la ligne entière :

    cat ~/.ssh/defi-movember-deploy.pub

  Elle commence par « ssh-ed25519 » — c'est la clé publique, elle se partage
  sans risque. Ne collez JAMAIS ici le fichier sans « .pub ».

EOF

read -r -p "Collez la clé publique (ou laissez vide pour passer) : " PUBKEY

if [[ -n "$PUBKEY" ]]; then
  if [[ "$PUBKEY" == *"PRIVATE KEY"* ]]; then
    echo
    warn "C'est une clé PRIVÉE. Rien n'a été enregistré."
    warn "Considérez-la comme compromise : supprimez-la et générez-en une autre."
    exit 1
  elif [[ "$PUBKEY" != ssh-* ]]; then
    warn "Format inattendu — une clé publique commence par « ssh- ». Ignorée."
  elif grep -qF "$PUBKEY" "$AUTH_KEYS" 2>/dev/null; then
    ok "cette clé est déjà autorisée"
  else
    printf '%s\n' "$PUBKEY" >>"$AUTH_KEYS"
    ok "clé autorisée"
  fi
fi

# --- Application directory ------------------------------------------------
info "Dossier applicatif : $APP_DIR"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

# The repository is usually cloned as root before this script runs, which
# leaves the deployment account unable to write to it. Reclaiming ownership
# here is what lets automated deployments pull and rebuild.
if [[ -d "$APP_DIR/.git" ]]; then
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
  ok "dépôt existant, propriété transférée à $DEPLOY_USER"
  # Git refuses to operate on a repository owned by another user; harmless
  # here since the directory now belongs to the deployment account.
  su - "$DEPLOY_USER" -c "git config --global --add safe.directory $APP_DIR" || true
else
  ok "prêt"
fi

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

   1. Vérifier que la connexion fonctionne, SANS mot de passe demandé
      ssh -i ~/.ssh/defi-movember-deploy $DEPLOY_USER@${IP_ADDR:-IP_DU_SERVEUR} "docker ps"

      Si un mot de passe est demandé, la clé publique n'a pas été enregistrée :
      relancez ce script et collez-la à l'invite.

   2. Copier la clé PRIVÉE dans les secrets GitHub du dépôt
      cat ~/.ssh/defi-movember-deploy
      → GitHub → Settings → Secrets and variables → Actions → New secret
        VPS_SSH_KEY  = le contenu affiché, en entier
        VPS_HOST     = ${IP_ADDR:-IP_DU_SERVEUR}
        VPS_USER     = $DEPLOY_USER

   La clé privée ne doit être collée QUE dans GitHub. Jamais dans une
   conversation, jamais dans le dépôt, jamais par e-mail.

   ssh-copy-id ne fonctionne pas ici, et c'est normal : le compte est créé
   sans mot de passe, or ssh-copy-id en a besoin pour déposer la clé. C'est
   pourquoi ce script s'en charge lui-même.

 DURCISSEMENT RECOMMANDÉ — à faire vous-même, sans précipitation :

   Ces commandes peuvent vous couper l'accès à votre propre serveur si
   elles sont lancées avant d'avoir vérifié l'étape 1 ci-dessus.

   # Pare-feu : n'ouvrir que SSH, HTTP et HTTPS
   ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

   # Mises à jour de sécurité automatiques
   apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades

   # Protection contre les tentatives répétées
   apt install -y fail2ban

   # Interdire la connexion root et par mot de passe
   # (UNIQUEMENT après avoir confirmé que l'étape 1 fonctionne)
   sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
   systemctl restart ssh

────────────────────────────────────────────────────────────────────────
EOF
