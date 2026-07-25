#!/usr/bin/env bash
set -euo pipefail

# One-command victim lab (macOS / Linux / WSL). Builds a disposable Docker
# container that runs real systemd, compromises it, collects read-only evidence,
# and analyzes it on the host. Docker Desktop already ships on the team's Mac
# and Windows machines, so no extra tooling is needed. See run-victim-lab.ps1
# for the native Windows PowerShell equivalent.
#
# Usage:
#   ./scripts/run-victim-lab.sh [ransomware|intrusion] [container-name]

scenario="${1:-ransomware}"
container="${2:-gemma-ir-victim}"

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${workspace_dir}"

case "${scenario}" in
  ransomware)
    scenario_script="run-ransomware-scenario.sh"
    case_id="hospital-ransomware"
    ;;
  intrusion|demo)
    scenario_script="run-scenario.sh"
    case_id="hospital-demo"
    ;;
  *)
    printf "Unknown scenario '%s'. Use 'ransomware' or 'intrusion'.\n" "${scenario}" >&2
    exit 1
    ;;
esac

if ! docker info >/dev/null 2>&1; then
  printf "Docker is required and its daemon must be running (start Docker Desktop).\n" >&2
  exit 1
fi

printf "Building victim image...\n"
docker build -q -t gemma-ir-victim -f vm/victim.Dockerfile . >/dev/null

printf "Booting disposable victim container...\n"
docker rm -f "${container}" >/dev/null 2>&1 || true
docker run -d --name "${container}" \
  --privileged --cgroupns=host \
  --tmpfs /run --tmpfs /run/lock \
  -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  gemma-ir-victim >/dev/null

# Wait for systemd to finish booting; in a container it settles as "degraded"
# (some host-only units are masked), which is expected and fine for the lab.
for _ in $(seq 1 30); do
  state="$(docker exec "${container}" systemctl is-system-running 2>/dev/null || true)"
  case "${state}" in running | degraded) break ;; esac
  sleep 1
done

# cleanup runs first so every invocation yields the same fresh compromise.
printf "Compromising the container with the '%s' scenario...\n" "${scenario}"
docker exec "${container}" bash -lc \
  "cd /opt/gemma-ir/vm && bash ./cleanup-scenario.sh >/dev/null 2>&1 || true; bash ./${scenario_script}"

printf "Collecting read-only evidence...\n"
docker exec "${container}" bash -lc \
  "cd /opt/gemma-ir/vm && bash ./collect-evidence.sh ${case_id} /tmp"

archive_name="$(docker exec "${container}" bash -lc \
  "ls -1t /tmp/${case_id}-*.tar.zst | head -1 | xargs basename")"
mkdir -p cases
docker cp "${container}:/tmp/${archive_name}" "cases/${archive_name}"
printf "Evidence archive: cases/%s\n" "${archive_name}"

output_dir="artifacts/${case_id}-vm"
printf "Analyzing on the host...\n"
uv run gemma-ir analyze "cases/${archive_name}" --output-dir "${output_dir}"

printf "\nDone. Dashboard: %s/dashboard.html\n" "${output_dir}"
printf "Serve it with:\n"
printf "  uv run gemma-ir serve cases/%s --host 127.0.0.1 --port 8080\n" "${archive_name}"
printf "Destroy the victim with:\n"
printf "  docker rm -f %s\n" "${container}"
