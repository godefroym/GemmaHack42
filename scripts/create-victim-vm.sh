#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
iso_path="${workspace_dir}/artifacts/ubuntu/ubuntu-24.04.4-live-server-arm64.iso"
expected_sha="9a6ce6d7e66c8abed24d24944570a495caca80b3b0007df02818e13829f27f32"

if [[ ! -f "${iso_path}" ]]; then
  printf "Missing Ubuntu ISO: %s\n" "${iso_path}" >&2
  exit 1
fi

actual_sha="$(shasum -a 256 "${iso_path}" | awk '{print $1}')"
if [[ "${actual_sha}" != "${expected_sha}" ]]; then
  printf "Refusing to create the VM: Ubuntu ISO checksum mismatch.\n" >&2
  exit 1
fi

open -a UTM
osascript "${workspace_dir}/vm/create-utm-vm.applescript" "${iso_path}"

printf "Start the installer with:\n"
printf "  utmctl start \"Gemma IR Victim\"\n"
printf "  utmctl attach \"Gemma IR Victim\"\n"
