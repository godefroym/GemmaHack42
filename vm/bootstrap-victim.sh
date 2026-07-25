#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  printf "This script must run inside the Linux victim VM.\n" >&2
  exit 1
fi

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  auditd \
  curl \
  jq \
  openssh-client \
  openssh-server \
  qemu-guest-agent \
  rsyslog \
  zstd

sudo install -d -m 0755 /etc/gemma-ir-lab
sudo install -m 0444 /dev/null /etc/gemma-ir-lab/authorized
sudo install -d -m 0750 /opt/hospital/pacs
sudo install -d -m 0750 /srv/hospital-data
sudo install -d -m 0750 /var/log/hospital

if ! id pacs-service >/dev/null 2>&1; then
  sudo useradd --system --home /opt/hospital/pacs --shell /usr/sbin/nologin pacs-service
fi

sudo chown -R pacs-service:pacs-service /opt/hospital/pacs /srv/hospital-data

sudo tee /srv/hospital-data/demo-secret.txt >/dev/null <<'EOF'
SYNTHETIC DATA ONLY
PACS_BACKUP_TOKEN=DEMO-NOT-A-REAL-SECRET
EOF
sudo chown root:root /srv/hospital-data/demo-secret.txt
sudo chmod 0600 /srv/hospital-data/demo-secret.txt

sudo tee /etc/audit/rules.d/hospital-ir.rules >/dev/null <<'EOF'
-w /etc/passwd -p wa -k identity_change
-w /etc/group -p wa -k identity_change
-w /etc/sudoers -p wa -k privilege_change
-w /etc/systemd/system -p wa -k persistence
-w /srv/hospital-data/demo-secret.txt -p r -k sensitive_access
EOF

sudo augenrules --load
sudo systemctl enable --now auditd
sudo systemctl enable --now qemu-guest-agent
sudo systemctl enable --now rsyslog
sudo systemctl enable --now ssh

printf "Victim VM prepared. Shut it down and create the clean snapshot now.\n"
