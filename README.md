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

| Configuration | Score | Critical checks |
| --- | ---: | ---: |
| Local E4B, Ollama | 54/87 (62.1%) | 3/11 |
| 31B QAT, vLLM MTP on L40S | 75/87 (86.2%) | 9/11 |

The E4B notably treated an instruction embedded in a log as a possible attacker
action, generalized all six expected MITRE technique IDs, and trusted a file
timestamp despite a documented clock correction. The 31B improved the aggregate
score by 24.1 points and correctly handled most critical checks. This is a
prototype benchmark, not a general claim about model safety.

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
planner on an L40S completed in 30.7 seconds, made five allowlisted read-only
tool calls, produced nine valid evidence citations, recovered all six expected
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

## DGX Spark portability

The deployment claim is deliberately narrow: the exact 31B target and MTP
assistant revisions used on Hugging Face can be loaded through the same vLLM
API on Linux ARM64. NVIDIA publishes a Gemma 4 CUDA 13 container for DGX Spark,
and the selected image is multi-architecture.

On a Spark, authenticate with `hf auth login`, then inspect or launch the pinned
configuration:

```bash
./scripts/start-dgx-spark-vllm.sh mtp
./scripts/start-dgx-spark-vllm.sh mtp --launch
```

This configuration has been prepared but not measured on a physical Spark.
Quality should be validated by rerunning the suite above; throughput must not be
presented as a Spark result until that run exists. NVIDIA documents DGX Spark as
an ARM64 Grace Blackwell system with 128 GB unified memory and provides an
[official Gemma 4 vLLM recipe](https://build.nvidia.com/spark/vllm/instructions).
Short-term bare-metal rentals also exist, but are optional for the hackathon.

## Local artifacts

The Ubuntu VM ISO is stored under `artifacts/` and deliberately ignored by Git.
Gemma 4 31B and the vLLM image are not duplicated on this Mac. See
[`artifacts/README.md`](artifacts/README.md) for the optional separate-NVIDIA-
host workflow.

## Victim VM

Use UTM with the Ubuntu Server ARM64 ISO in `artifacts/ubuntu/`. The preparation
notes and lab-only scripts live in [`vm/README.md`](vm/README.md).
