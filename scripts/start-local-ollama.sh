#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" == "Darwin" ]]; then
  open -a Ollama
fi

for _ in {1..30}; do
  if curl -fsS --max-time 1 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null
ollama show gemma4:e4b >/dev/null

printf "Ollama ready\n"
printf "MODEL_API_BASE=http://127.0.0.1:11434/v1\n"
printf "MODEL_API_KEY=ollama\n"
printf "MODEL_NAME=gemma4:e4b\n"

