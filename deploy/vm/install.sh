#!/usr/bin/env bash
# Install ClassAgent backend as a systemd service on Ubuntu.
# Run ON THE VM depuis la racine du dépôt (peu importe le nom du dossier: classagent, classagent-github, etc.):
#   cd /chemin/vers/ton-depot && git pull && sudo bash deploy/vm/install.sh
#
# Le script détecte la racine du repo via deploy/vm/install.sh (../..).
# Sinon: export CLASSAGENT_ROOT=/chemin/absolu/vers/ton-depot
#
# Prérequis: git, curl (script n'installe pas uv — faire une fois: curl -LsSf https://astral.sh/uv/install.sh | sh)
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Lance avec: sudo bash deploy/vm/install.sh (depuis la racine du repo, ex. cd ~/classagent-github && sudo bash deploy/vm/install.sh)"
  exit 1
fi

INSTALL_USER="${SUDO_USER:-${INSTALL_USER:-ubuntu}}"
INSTALL_HOME="$(getent passwd "$INSTALL_USER" | cut -d: -f6)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -n "${CLASSAGENT_ROOT:-}" ]]; then
  REPO_ROOT="$CLASSAGENT_ROOT"
elif [[ -f "$AUTO_ROOT/backend/pyproject.toml" ]]; then
  REPO_ROOT="$AUTO_ROOT"
else
  REPO_ROOT="$INSTALL_HOME/classagent"
fi

BACKEND="$REPO_ROOT/backend"

if [[ ! -f "$BACKEND/pyproject.toml" ]]; then
  echo "Introuvable: $BACKEND/pyproject.toml"
  echo "Indique la racine du clone: export CLASSAGENT_ROOT=/home/$INSTALL_USER/classagent-github"
  echo "Puis: sudo -E bash deploy/vm/install.sh"
  exit 1
fi

if [[ ! -x "$BACKEND/.venv/bin/uvicorn" ]]; then
  echo "Création du venv (uv sync) en tant que $INSTALL_USER ..."
  sudo -u "$INSTALL_USER" bash -lc "cd '$BACKEND' && export PATH=\"\$HOME/.local/bin:\$PATH\" && command -v uv >/dev/null || { echo 'Installe uv: curl -LsSf https://astral.sh/uv/install.sh | sh'; exit 1; } && uv sync"
fi

UNIT="/etc/systemd/system/classagent-backend.service"
cat >"$UNIT" <<EOF
[Unit]
Description=ClassAgent FastAPI backend
After=network.target

[Service]
Type=simple
User=$INSTALL_USER
Group=$INSTALL_USER
WorkingDirectory=$BACKEND
Environment=PATH=$BACKEND/.venv/bin:/usr/local/bin:/usr/bin
ExecStart=$BACKEND/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable classagent-backend.service
systemctl restart classagent-backend.service
sleep 1
systemctl --no-pager -l status classagent-backend.service || true

if curl -sf http://127.0.0.1:8000/health >/dev/null; then
  echo "OK: http://127.0.0.1:8000/health"
else
  echo "Vérifie les logs: journalctl -u classagent-backend -n 50 --no-pager"
  exit 1
fi

echo ""
echo "Étape suivante: reverse proxy (Caddy/Nginx) sur 443 → 127.0.0.1:8000"
echo "Puis dans backend/.env: ALLOW_ORIGINS=https://ton-front.vercel.app"
