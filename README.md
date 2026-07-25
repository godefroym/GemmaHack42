# Local incident-response hackathon environment

This workspace prepares three inference profiles behind the same
OpenAI-compatible API:

- Offline demo and fallback: Ollama with `gemma4:e4b`.
- Development and optimization: Gemma 4 31B QAT on an NVIDIA L40S through
  Hugging Face Jobs.
- Intended on-premise deployment: the same 31B checkpoint served by vLLM on a
  DGX Spark-class machine.

The product remains local-first. Cloud GPUs are only a development bench for
synthetic cases; real hospital or incident data must never be uploaded.

| Backend | Purpose | Model/runtime |
| --- | --- | --- |
| Ollama | Offline demo on commodity hardware | `gemma4:e4b` |
| HF Jobs L40S | 31B quality and NVIDIA optimization bench | vLLM, `gemma4:31b` |
| DGX Spark-class box | Intended air-gapped/on-premise deployment | vLLM, `gemma4:31b` |

## Measured result

The purpose-built incident-response suite contains four synthetic cases and 87
weighted checks. Both models received the same evidence and system policy.

| Configuration | Precision | Score | Critical checks |
| --- | --- | ---: | ---: |
| E4B, Ollama, MacBook | Q4_K_M | 54/87 (62.1%) | 3/11 |
| 31B QAT, vLLM MTP on L40S | W4A16 | 75/87 (86.2%) | 9/11 |
| 31B QAT, vLLM on DGX Spark | W4A16 | 76/87 (87.4%) | 9/11 |
| **26B-A4B, vLLM on DGX Spark** | **bf16** | **79/87 (90.8%)** | **9/11** |
| 26B-A4B, vLLM on DGX Spark | FP8 online | 76/87 (87.4%) | 8/11 |

The E4B notably treated an instruction embedded in a log as a possible attacker
action, missed all six expected sub-technique-level MITRE IDs, and trusted a file
timestamp despite a documented clock correction. This is a prototype benchmark,
not a general claim about model safety.

Two results are worth stating plainly. **The on-premise Spark matches the cloud
GPU** — 76/87 against the L40S's 75/87, within run-to-run variation, with no
evidence leaving the building. And **the 26B-A4B MoE beats the 31B dense model on
both axes at once**: 2.1x the decode throughput *and* a higher score, at higher
precision, because the Spark is memory-bandwidth-bound and the MoE reads only its
~4B active parameters per token. Online FP8 adds another 1.6x but costs one
critical check, so bf16 is the shipped configuration.

Full methodology, throughput, batching and the four configuration failures we hit
are in [`eval/SPARK-RESULTS.md`](eval/SPARK-RESULTS.md); raw JSON is committed
under `eval/results/`.

On the same L40S and 31B checkpoint, one-token MTP speculative decoding raised
median decode throughput from 35.4 to 62.1 tokens/s (+75.5%). TTFT increased
from 0.43 to 0.72 seconds, which is acceptable for an investigation workflow.
See [`eval/RESULTS.md`](eval/RESULTS.md) for methodology and caveats.

## End-to-end forensic pipeline

The current prototype now implements:

- SHA-256 verification for a collected directory or `.tar.zst` bundle;
- deterministic normalization, timeline, IOC and ATT&CK extraction;
- a sourced incident graph with observed and derived relations;
- an optional isolated Neo4j mirror plus an always-available JSON fallback;
- eight typed, read-only forensic tools;
- a bounded Gemma planner with timeout, invalid-output and tool-loop fallbacks;
- a policy pass that requires human approval for every modifying action;
- a local dashboard and a full-pipeline benchmark.

On the included synthetic hospital fixture, the deterministic path satisfied
all fixture assertions in 5 ms. The local E4B planner reached its 75-second
deadline and safely fell back to that deterministic report. The 31B MTP
planner on an L40S completed in 30.7 seconds after the orchestrator's five
allowlisted preflight tool calls, produced nine valid evidence citations,
recovered all six expected
ATT&CK techniques, recognized the prompt injection, and preserved human
approval on every modifying action.

The included fixture follows the same layout as the real VM collector. Prepare
the entire demonstration with:

```bash
./scripts/run-demo.sh
```

Serve the dashboard at `http://127.0.0.1:8080`:

```bash
./scripts/run-demo.sh eval/fixtures/hospital-demo --serve
```

The generated graph, report, SVG and HTML live under `artifacts/demo/`. Neo4j
Browser is bound to `http://127.0.0.1:7475`, with Bolt on `127.0.0.1:7688`.
The separate Neo4j instance already running for another project is untouched.

To inspect the mirrored case in Neo4j Browser:

```cypher
MATCH p=(n:IRNode {case_id: "hospital-demo"})-[r]->(m)
RETURN p
LIMIT 100
```

Example read-only tool call:

```bash
uv run gemma-ir tool eval/fixtures/hospital-demo trace_attack_path \
  --arguments '{"start_entity":"203.0.113.77","max_depth":8}'
```

Run the LLM planner locally:

```bash
uv run gemma-ir plan eval/fixtures/hospital-demo \
  --base-url http://127.0.0.1:11434/v1 \
  --model gemma4:e4b
```

Run the deterministic and optional LLM benchmark:

```bash
uv run python scripts/benchmark-ir-pipeline.py
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the trust boundaries,
tool allowlist and fallback order.

## Installed locally

- Docker Desktop
- Ollama and `gemma4:e4b` Q4_K_M
- Hugging Face CLI
- uv and a Python 3.12 project environment
- llama.cpp
- Git LFS
- UTM
- Skopeo
- aria2
- jq
- ShellCheck

## Quick checks

```bash
./scripts/check-prerequisites.sh
./scripts/verify-artifacts.sh
./scripts/start-local-ollama.sh
./scripts/test-model-api.sh http://127.0.0.1:11434/v1 gemma4:e4b
```

To test the hosted fallback after creating an API key in Google AI Studio:

```bash
export GEMINI_API_KEY="..."
./scripts/test-gemini-api.sh
```

Do not put API keys in `.env` files that may be committed or paste them into
chat. The `.env` path is ignored as an additional safeguard.

## NVIDIA cloud development bench

Hugging Face Jobs is configured for one L40S 48 GB and the vLLM nightly image
validated against Gemma 4. The helper defaults to a dry run and will not spend
credits:

```bash
./scripts/launch-hf-vllm-job.sh baseline
./scripts/launch-hf-vllm-job.sh mtp
```

After authenticating locally with `hf auth login`, add `--launch` to actually
start a job. The model and MTP assistant revisions are pinned in the launcher.
Always cancel the job after recording the result.

Run the same streamed benchmark against baseline and MTP endpoints:

```bash
uv run python scripts/benchmark-api.py \
  --base-url http://127.0.0.1:8000/v1 \
  --model gemma4:31b \
  --label l40s-mtp \
  --output eval/results/l40s-mtp.json
```

For a Hugging Face Job, `hf jobs stats JOB_ID --json` captures GPU utilization
and memory metrics alongside the latency and throughput report.

Run the incident-response quality suite against any OpenAI-compatible endpoint:

```bash
uv run python scripts/evaluate-ir-quality.py \
  --base-url http://127.0.0.1:8000/v1 \
  --model gemma4:31b \
  --label local-nvidia-31b \
  --extra-body '{"chat_template_kwargs":{"enable_thinking":false}}' \
  --max-tokens 1024 \
  --output eval/results/quality-local-nvidia.json
```

## DGX Spark deployment

**Measured on a physical DGX Spark on 2026-07-25**, not extrapolated. GB10 Grace
Blackwell (`sm_121`), 121.7 GB unified memory, arm64, Ubuntu 24.04, driver
580.126.09, `vllm/vllm-openai:gemma4-cu130` (multi-arch, `linux/arm64` manifest
confirmed).

The shipped configuration:

```bash
docker run -d --restart unless-stopped --name gemma-ir-vllm --gpus all \
  --ipc host --shm-size 16g --publish 127.0.0.1:8000:8000 \
  --env HF_TOKEN="$HF_TOKEN" --env HF_HUB_OFFLINE=1 --env TRANSFORMERS_OFFLINE=1 \
  --volume "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  vllm/vllm-openai:gemma4-cu130 google/gemma-4-26B-A4B-it \
  --revision 4d7ae4984b7db7de8f8457170b3f1a419ee76d52 \
  --served-model-name gemma4:26b --host 0.0.0.0 --port 8000 \
  --max-model-len 8192 --gpu-memory-utilization 0.60 \
  --enable-auto-tool-choice --tool-call-parser gemma4 --reasoning-parser gemma4
```

`HF_HUB_OFFLINE=1` is not decoration: it makes the appliance structurally unable
to contact Hugging Face at startup, which is what "air-gapped" has to mean for
this product.

Four things that cost real time and are documented in full in
[`eval/SPARK-RESULTS.md`](eval/SPARK-RESULTS.md):

- **`--gpu-memory-utilization 0.80` fails on a busy Spark.** Unified memory is
  shared with every other process on the box; 0.60 is the safe default here.
- **Ollama silently runs on CPU on GB10.** It reports `gpus=1`, starts cleanly,
  and repacks the whole model into host memory. No error. A 31B at 5.66 tok/s.
- **MTP speculative decoding does not load** on this image — the pinned assistant
  checkpoint uses a `gemma4_assistant` architecture the bundled Transformers does
  not know. The +75% MTP result stands for the L40S only.
- **Third-party quantized MoE checkpoints do not load** either: NVIDIA's NVFP4 and
  RedHatAI's FP8-dynamic both ship per-expert tensors where the loader expects
  Google's fused layout. Use `--quantization fp8` against Google's own bf16
  checkpoint instead.

NVIDIA's [official Gemma 4 vLLM recipe](https://build.nvidia.com/spark/vllm/instructions)
documents the platform.

## Terminal demo

A single command walks through a whole run — evidence intake with recomputed
SHA-256 hashes, the deterministic reconstruction, the planner's real tool calls
streamed live, and the post-mortem:

```bash
uv run python scripts/pandar-demo.py
```

Add `--skip-llm` to run the deterministic layers alone, which needs no model
endpoint and completes in milliseconds.

## Local artifacts

The Ubuntu VM ISO is stored under `artifacts/` and deliberately ignored by Git.
Gemma 4 31B and the vLLM image are not duplicated on this Mac. See
[`artifacts/README.md`](artifacts/README.md) for the optional separate-NVIDIA-
host workflow.

## Victim VM

Use UTM with the Ubuntu Server ARM64 ISO in `artifacts/ubuntu/`. The preparation
notes and lab-only scripts live in [`vm/README.md`](vm/README.md).
