#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]] || [[ ! -f /etc/gemma-ir-lab/authorized ]]; then
  printf "Refusing to run outside the marked disposable Gemma IR lab VM.\n" >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  printf "Run this script as root inside the disposable lab VM.\n" >&2
  exit 1
fi

systemctl disable --now pacs-health-sync.service 2>/dev/null || true
rm -f /etc/systemd/system/pacs-health-sync.service
rm -f /usr/local/bin/pacs-health-sync
rm -rf /var/tmp/.pacs-cache
userdel --remove backup-admin 2>/dev/null || true
rm -f /root/.gemma-ir-demo-key /root/.gemma-ir-demo-key.pub
rm -f /root/gemma-ir-ground-truth.json

# Ransomware scenario artifacts (only the lab-owned paths it created).
systemctl disable --now pacs-archive.service 2>/dev/null || true
rm -f /etc/systemd/system/pacs-archive.service
rm -f /usr/local/bin/pacs-crypt
rm -rf /srv/backups /srv/hospital-data/patient-4821 /srv/hospital-data/patient-5190
rm -f /srv/hospital-data/HOW_TO_DECRYPT.txt
rm -f /root/gemma-ir-ransomware-ground-truth.json

# Webshell scenario artifacts.
rm -f /var/www/pacs/uploads/.cache.php
rm -f /etc/sudoers.d/pacs-maintenance
rm -f /etc/cron.d/pacs-index
rm -f /usr/local/bin/pacs-index-update
rm -f /var/tmp/.pacs-root-proof
rm -rf /var/tmp/.pacs-export /etc/pacs /srv/pacs-db
rm -rf /var/log/gemma-ir-external
rm -f /var/log/nginx/access.log
rm -f /root/gemma-ir-webshell-ground-truth.json
ip address del 192.0.2.44/32 dev lo 2>/dev/null || true

systemctl daemon-reload

printf "Synthetic scenario artifacts removed. Restore the clean snapshot for a "
printf "fully reproducible reset.\n"
