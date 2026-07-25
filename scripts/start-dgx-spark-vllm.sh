#!/usr/bin/env bash
set -euo pipefail

mode="${1:-baseline}"
action="${2:-}"
image_name="${VLLM_IMAGE:-vllm/vllm-openai:gemma4-cu130}"
model_repo="${GEMMA_MODEL_REPO:-google/gemma-4-31B-it-qat-w4a16-ct}"
assistant_repo="${GEMMA_ASSISTANT_REPO:-google/gemma-4-31B-it-qat-q4_0-unquantized-assistant}"
model_revision="${GEMMA_MODEL_REVISION:-52f3f65bc7a02d555763bc923bd1d9094898219d}"
assistant_revision="${GEMMA_ASSISTANT_REVISION:-96d4c8ca3cb38c107a8478587878124895d1e844}"
container_name="${VLLM_CONTAINER_NAME:-gemma-ir-vllm}"
max_model_len="${GEMMA_MAX_MODEL_LEN:-8192}"
gpu_memory_utilization="${VLLM_GPU_MEMORY_UTILIZATION:-0.80}"
hf_cache_dir="${HF_HOME:-${HOME}/.cache/huggingface}"

if [[ "${mode}" != "baseline" ]] && [[ "${mode}" != "mtp" ]]; then
  printf "Usage: %s [baseline|mtp] [--launch]\n" "$0" >&2
  exit 1
fi

if [[ ! -s "${hf_cache_dir}/token" ]] && [[ -z "${HF_TOKEN:-}" ]]; then
  printf "No Hugging Face token found. Run 'hf auth login' first.\n" >&2
  exit 1
fi

docker_args=(
  run --rm
  --name "${container_name}"
  --gpus all
  --ipc host
  --shm-size 16g
  --publish 127.0.0.1:8000:8000
  --env HF_TOKEN
  --volume "${hf_cache_dir}:/root/.cache/huggingface"
  "${image_name}"
  "${model_repo}"
  --revision "${model_revision}"
  --served-model-name gemma4:31b
  --host 0.0.0.0
  --port 8000
  --max-model-len "${max_model_len}"
  --gpu-memory-utilization "${gpu_memory_utilization}"
  --limit-mm-per-prompt '{"image":0,"audio":0}'
  --enable-auto-tool-choice
  --tool-call-parser gemma4
  --reasoning-parser gemma4
  --chat-template examples/tool_chat_template_gemma4.jinja
)

if [[ "${mode}" == "mtp" ]]; then
  docker_args+=(
    --speculative-config
    "{\"method\":\"mtp\",\"model\":\"${assistant_repo}\",\"revision\":\"${assistant_revision}\",\"num_speculative_tokens\":1}"
  )
fi

if [[ "${action}" != "--launch" ]]; then
  printf "Dry run only; no container was started.\n"
  printf "Target: DGX Spark / Linux ARM64 / CUDA 13, mode: %s\n" "${mode}"
  printf "Verified multi-architecture image: %s\n" "${image_name}"
  printf "Pinned model revision: %s\n" "${model_revision}"
  printf "Run on the Spark with:\n"
  printf "  %q" docker "${docker_args[@]}"
  printf "\n"
  exit 0
fi

docker "${docker_args[@]}"
