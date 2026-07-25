#!/usr/bin/env bash
set -euo pipefail

required=(docker git hf jq shellcheck uv)
optional=(aria2c llama-server ollama skopeo utmctl)
failed=0

for command_name in "${required[@]}"; do
  if command -v "${command_name}" >/dev/null 2>&1; then
    printf "ok       %-18s %s\n" "${command_name}" "$(command -v "${command_name}")"
  else
    printf "missing  %s\n" "${command_name}"
    failed=1
  fi
done

for command_name in "${optional[@]}"; do
  if command -v "${command_name}" >/dev/null 2>&1; then
    printf "ok       %-18s %s\n" "${command_name}" "$(command -v "${command_name}")"
  else
    printf "optional %s\n" "${command_name}"
  fi
done

if [[ -x ".venv/bin/python" ]]; then
  printf "ok       .venv/bin/python\n"
else
  printf "missing  .venv/bin/python (run: uv sync)\n"
  failed=1
fi

exit "${failed}"
