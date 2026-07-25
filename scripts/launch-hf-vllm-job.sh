#!/usr/bin/env bash
set -euo pipefail

mode="${1:-baseline}"
action="${2:-}"
image_name="${VLLM_IMAGE:-vllm/vllm-openai:nightly}"
flavor="${HF_JOB_FLAVOR:-l40sx1}"
timeout="${HF_JOB_TIMEOUT:-90m}"
max_model_len="${VLLM_MAX_MODEL_LEN:-32768}"
model_repo="google/gemma-4-31B-it-qat-w4a16-ct"
assistant_repo="google/gemma-4-31B-it-qat-q4_0-unquantized-assistant"
model_revision="52f3f65bc7a02d555763bc923bd1d9094898219d"
assistant_revision="96d4c8ca3cb38c107a8478587878124895d1e844"

if [[ "${mode}" != "baseline" ]] && [[ "${mode}" != "mtp" ]]; then
  printf "Usage: %s [baseline|mtp] [--launch]\n" "$0" >&2
  exit 1
fi

job_command=(
  hf jobs run
  --name "ir-gemma4-31b-${mode}"
  --flavor "${flavor}"
  --timeout "${timeout}"
  --detach
  --expose 8000
  --secrets HF_TOKEN
  "${image_name}"
  vllm serve "${model_repo}"
  --revision "${model_revision}"
  --served-model-name gemma4:31b
  --host 0.0.0.0
  --port 8000
  --max-model-len "${max_model_len}"
  --gpu-memory-utilization 0.90
  --limit-mm-per-prompt '{"image":0,"audio":0}'
  --enable-auto-tool-choice
  --tool-call-parser gemma4
  --reasoning-parser gemma4
  --chat-template examples/tool_chat_template_gemma4.jinja
)

if [[ "${mode}" == "mtp" ]]; then
  job_command+=(
    --speculative-config
    "{\"method\":\"mtp\",\"model\":\"${assistant_repo}\",\"revision\":\"${assistant_revision}\",\"num_speculative_tokens\":1}"
  )
fi

if [[ "${action}" != "--launch" ]]; then
  printf "Dry run only; no paid job was started.\n"
  printf "Hardware: %s, timeout: %s, mode: %s, context: %s\n" \
    "${flavor}" "${timeout}" "${mode}" "${max_model_len}"
  printf "Authenticate with 'hf auth login', then run:\n"
  printf "  %q" "${job_command[@]}"
  printf "\n"
  exit 0
fi

if ! hf auth whoami >/dev/null 2>&1; then
  printf "Hugging Face CLI is not authenticated. Run 'hf auth login' first.\n" >&2
  exit 1
fi

"${job_command[@]}"
