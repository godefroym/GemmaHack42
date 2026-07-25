#!/usr/bin/env bash
set -euo pipefail

mode="${1:-baseline}"
workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
model_size="${GEMMA_SIZE:-E4B}"

case "${model_size}" in
  31B)
    default_model_dir="${workspace_dir}/artifacts/models/gemma-4-31B-it-qat-w4a16-ct"
    default_assistant_dir="${workspace_dir}/artifacts/models/gemma-4-31B-it-qat-assistant"
    served_model_name="gemma4:31b"
    ;;
  E4B)
    default_model_dir="${workspace_dir}/artifacts/models/gemma-4-E4B-it-qat-w4a16-ct"
    default_assistant_dir="${workspace_dir}/artifacts/models/gemma-4-E4B-it-qat-assistant"
    served_model_name="gemma4:e4b"
    ;;
  *)
    printf "GEMMA_SIZE must be 31B or E4B, got: %s\n" "${model_size}" >&2
    exit 1
    ;;
esac

model_dir="${GEMMA_MODEL_DIR:-${default_model_dir}}"
assistant_dir="${GEMMA_ASSISTANT_DIR:-${default_assistant_dir}}"
image_name="${VLLM_IMAGE:-vllm/vllm-openai:gemma4}"
network_name="ir-analysis-internal"
container_name="ir-vllm"
max_model_len="${GEMMA_MAX_MODEL_LEN:-8192}"

if [[ ! -s "${model_dir}/model.safetensors" ]]; then
  printf "Missing Gemma model directory: %s\n" "${model_dir}" >&2
  exit 1
fi

if ! docker network inspect "${network_name}" >/dev/null 2>&1; then
  docker network create --internal "${network_name}" >/dev/null
fi

docker rm -f "${container_name}" >/dev/null 2>&1 || true

if [[ "${mode}" == "mtp" ]]; then
  if [[ ! -s "${assistant_dir}/model.safetensors" ]]; then
    printf "Missing Gemma assistant directory: %s\n" "${assistant_dir}" >&2
    exit 1
  fi
elif [[ "${mode}" != "baseline" ]]; then
  printf "Usage: %s [baseline|mtp]\n" "$0" >&2
  exit 1
fi

docker_args=(
  run --detach
  --name "${container_name}"
  --gpus all
  --ipc host
  --network "${network_name}"
  --publish 127.0.0.1:8000:8000
  --volume "${model_dir}:/models/gemma4:ro"
  --volume "${assistant_dir}:/models/assistant:ro"
  "${image_name}"
  /models/gemma4
  --served-model-name "${served_model_name}"
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
  docker_args+=(
    --speculative-config
    "{\"method\":\"mtp\",\"model\":\"/models/assistant\",\"num_speculative_tokens\":1}"
  )
fi

docker "${docker_args[@]}"

printf "Started Gemma %s in %s mode as container %s\n" \
  "${model_size}" "${mode}" "${container_name}"
printf "Follow startup with: docker logs -f %s\n" "${container_name}"
