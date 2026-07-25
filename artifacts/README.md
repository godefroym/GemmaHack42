# Offline artifact inventory

Prepared artifacts:

```text
artifacts/
├── containers/
│   └── vllm-gemma4-linux-amd64.tar  # optional; not stored on this Mac
├── models/
│   ├── gemma-4-E4B-it-qat-w4a16-ct/  # metadata; weights optional
│   └── gemma-4-E4B-it-qat-assistant/
└── ubuntu/
    └── ubuntu-24.04.4-live-server-arm64.iso
```

The local Ollama model is intentionally not duplicated here. It is already stored
under Ollama's model directory and available as `gemma4:e4b`.
The pinned Ubuntu checksum is tracked in `vm/`; run
`./scripts/verify-artifacts.sh` before using the ISO.

The main NVIDIA path is Hugging Face Jobs. The remote Job pulls the vLLM image
and mounts Gemma 4 31B directly on its L40S, so neither the 31B weights nor a
large amd64 container archive are useful on this 16 GB Apple Silicon Mac.

## Optional loading on a separate Linux/NVIDIA host

```bash
docker pull vllm/vllm-openai:gemma4
hf auth login
hf download google/gemma-4-E4B-it-qat-w4a16-ct \
  --local-dir artifacts/models/gemma-4-E4B-it-qat-w4a16-ct
./scripts/start-nvidia-vllm.sh baseline
./scripts/start-nvidia-vllm.sh mtp
```

If an offline NVIDIA host becomes available, create or copy the Docker archive
there and download the E4B checkpoint after authentication.
The 31B Hugging Face Job mounts its checkpoint directly from the Hub and does
not need a second local copy. If 31B weights are copied here later, use:

```bash
GEMMA_SIZE=31B ./scripts/start-nvidia-vllm.sh baseline
```

Use an APFS or exFAT transfer disk: the vLLM archive is larger than FAT32's
single-file limit.
