#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
iso_path="${workspace_dir}/artifacts/ubuntu/ubuntu-24.04.4-live-server-arm64.iso"
image_path="${workspace_dir}/artifacts/containers/vllm-gemma4-linux-amd64.tar"
model_path="${workspace_dir}/artifacts/models/gemma-4-E4B-it-qat-w4a16-ct/model.safetensors"
assistant_path="${workspace_dir}/artifacts/models/gemma-4-E4B-it-qat-assistant/model.safetensors"
expected_iso_sha="9a6ce6d7e66c8abed24d24944570a495caca80b3b0007df02818e13829f27f32"
failed=0

check_large_file() {
  local label="$1"
  local path="$2"
  local minimum_bytes="$3"
  local actual_bytes

  if [[ ! -f "${path}" ]]; then
    printf "missing  %-22s %s\n" "${label}" "${path}"
    failed=1
    return
  fi

  actual_bytes="$(stat -f '%z' "${path}")"
  if (( actual_bytes < minimum_bytes )); then
    printf "invalid  %-22s %s bytes\n" "${label}" "${actual_bytes}"
    failed=1
    return
  fi

  printf "ok       %-22s %s bytes\n" "${label}" "${actual_bytes}"
}

check_optional_large_file() {
  local label="$1"
  local path="$2"
  local minimum_bytes="$3"

  if [[ ! -f "${path}" ]]; then
    printf "optional %-22s not downloaded\n" "${label}"
    return
  fi

  check_large_file "${label}" "${path}" "${minimum_bytes}"
}

check_large_file "Ubuntu ARM64 ISO" "${iso_path}" 3000000000
check_optional_large_file "vLLM amd64 archive" "${image_path}" 5000000000
check_optional_large_file "Gemma E4B weights" "${model_path}" 1000000000
check_optional_large_file "Gemma E4B assistant" "${assistant_path}" 100000000

if [[ -f "${iso_path}" ]]; then
  actual_iso_sha="$(shasum -a 256 "${iso_path}" | awk '{print $1}')"
  if [[ "${actual_iso_sha}" == "${expected_iso_sha}" ]]; then
    printf "ok       Ubuntu ISO SHA-256\n"
  else
    printf "invalid  Ubuntu ISO SHA-256: %s\n" "${actual_iso_sha}"
    failed=1
  fi
fi

if [[ -f "${image_path}" ]] && (( $(stat -f '%z' "${image_path}") >= 5000000000 )); then
  if skopeo inspect "docker-archive:${image_path}" >/dev/null 2>&1; then
    printf "ok       vLLM archive manifest\n"
  else
    printf "invalid  vLLM archive manifest\n"
    failed=1
  fi
fi

exit "${failed}"
