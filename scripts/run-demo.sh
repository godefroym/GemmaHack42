#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
evidence_path="${1:-${workspace_dir}/eval/fixtures/hospital-demo}"
action="${2:-}"
output_dir="${GEMMA_IR_OUTPUT_DIR:-${workspace_dir}/artifacts/demo}"

cd "${workspace_dir}"
docker compose up -d neo4j

for _ in {1..60}; do
  neo4j_health="$(
    docker inspect gemma-ir-neo4j \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' \
      2>/dev/null || true
  )"
  if [[ "${neo4j_health}" == "healthy" ]]; then
    break
  fi
  sleep 1
done

if [[ "${neo4j_health:-}" != "healthy" ]]; then
  printf "Neo4j did not become healthy; continuing with the JSON fallback.\n" >&2
  uv run gemma-ir analyze "${evidence_path}" --output-dir "${output_dir}"
else
  uv run gemma-ir analyze \
    "${evidence_path}" \
    --output-dir "${output_dir}" \
    --sync-neo4j
fi

printf "Dashboard artifact: %s/dashboard.html\n" "${output_dir}"
printf "Neo4j Browser: http://127.0.0.1:7475 (Bolt: 127.0.0.1:7688)\n"

if [[ "${action}" == "--serve" ]]; then
  exec uv run gemma-ir serve "${evidence_path}" --host 127.0.0.1 --port 8080
fi

printf "Serve the dashboard with:\n"
printf "  %q %q --serve\n" "$0" "${evidence_path}"
