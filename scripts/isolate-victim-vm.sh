#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
utmctl stop "Gemma IR Victim" >/dev/null 2>&1 || true
osascript "${workspace_dir}/vm/isolate-utm-vm.applescript"
