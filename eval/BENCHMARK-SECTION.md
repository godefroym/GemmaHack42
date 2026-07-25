# Benchmark

> Paste-ready section for the Kaggle writeup or the README. It presents the
> measurements; the full methodology, the raw failure logs and the caveats in
> long form live in [`eval/SPARK-RESULTS.md`](SPARK-RESULTS.md). Raw JSON for
> every number is committed under `eval/results/`.

**Headline.** On a physical DGX Spark, **Gemma 4 26B-A4B (MoE) beats Gemma 4 31B
(dense) on both axes at once** — 2.1x the decode throughput *and* a higher score
on our 87-check incident-response suite — while running at higher precision
(bf16 vs W4A16). On a memory-bandwidth-bound machine, active parameter count
dominates total parameter count.

The consequence for the product: **the on-premise appliance runs a 26B model at
the same speed an analyst laptop runs an 8B one (24.0 vs 24.4 tok/s), and scores
90.8% against the laptop's 62.1%** — without a byte of evidence leaving the site.

## Bench under test

Recorded explicitly, because a benchmark without hardware, model variant,
precision and concurrency is not reproducible.

| Property | Value |
| --- | --- |
| Machine | NVIDIA DGX Spark, `spark-3a34` |
| GPU | NVIDIA GB10 (Grace Blackwell), compute capability 12.1 (`sm_121`) |
| Memory | 121.7 GB unified LPDDR5X (~273 GB/s), shared CPU/GPU |
| CPU / OS | 20 cores `aarch64` · Ubuntu 24.04.4 LTS, kernel 6.17.0-1008-nvidia |
| Driver / runtime | 580.126.09 · Docker 29.1.3 + nvidia-container-toolkit |
| Serving image | `vllm/vllm-openai:gemma4-cu130` (`linux/arm64` manifest) |
| Attention backend | `TRITON_ATTN` (auto-selected) |
| Server flags | `--gpu-memory-utilization 0.60` · `--max-model-len 8192` |

Checkpoints, pinned by revision:

| Served as | Repo | Revision | Precision |
| --- | --- | --- | --- |
| `gemma4:31b` | `google/gemma-4-31B-it-qat-w4a16-ct` | `52f3f65b…` | W4A16 (Marlin) |
| `gemma4:26b` | `google/gemma-4-26B-A4B-it` | `4d7ae498…` | bf16 (+ online FP8) |

Baseline machine: MacBook (Apple Silicon), Ollama, `gemma4:e4b` Q4_K_M — same
repository scripts, same prompts.

## Method

Three scripts, all in-repo, all run against unmodified pinned checkpoints:

- **Throughput** — `scripts/benchmark-api.py`: 3 fixed prompts x 2 repeats = 6
  measured runs after one unmeasured warm-up. `temperature=0`, `max_tokens=512`,
  streaming with usage accounting. TTFT is wall-clock to first content delta;
  decode is `completion_tokens / (finish − first_token)`. **Medians** reported.
- **Concurrency** — `scripts/benchmark-concurrency.py`: same prompts, levels
  1/2/4/8. Aggregate throughput is total completion tokens ÷ wall-clock for the
  whole batch.
- **Quality** — `scripts/evaluate-ir-quality.py` against
  `eval/quality-cases.jsonl` (SHA-256 `373027b9…4a2b1742`): 4 synthetic IR cases,
  **87 weighted points, 11 critical checks** (weight 3). `temperature=0`,
  `--max-tokens 1024`, thinking disabled.

## 1. Single stream — speed and quality on the same axis

| # | Configuration | Precision | Decode (tok/s) | TTFT (s) | Quality /87 | Critical /11 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | Analyst laptop, Gemma 4 E4B, Ollama | Q4_K_M | 24.38 | 0.991 | 54 (62.1%) | 3 |
| 2 | Spark, 31B, Ollama — **silent CPU fallback** | Q4_K_M | 5.66 | 4.440 | not run | — |
| 3 | Spark, 31B **dense**, vLLM | W4A16 | 11.32 | 0.243 | 76 (87.4%) | 9 |
| 4 | **Spark, 26B-A4B MoE, vLLM — shipped** | **bf16** | **24.01** | 1.040 | **79 (90.8%)** | **9** |
| 5 | Spark, 26B-A4B MoE, vLLM `--quantization fp8` | FP8 (online) | **38.77** | 1.400 | 76 (87.4%) | 8 |
| 6 | *L40S 48 GB, 31B, vLLM (prior run, other hardware)* | *W4A16* | *35.4* | *0.431* | — | — |
| 7 | *L40S 48 GB, 31B, vLLM + 1-token MTP (prior run)* | *W4A16* | *62.1* | *0.721* | *75 (86.2%)* | *9* |

Rows 6–7 were measured on different hardware and are **not** a like-for-like
comparison; they are shown for context only.

**Rows 3 → 4, the result to take away.** The 26B-A4B MoE is **2.1x faster** than
the 31B dense despite carrying *more* bytes per weight. The Spark's ~273 GB/s of
unified bandwidth predicts this almost exactly: the dense 31B must read ~17 GB of
weights per token (ceiling ~16 tok/s, measured 11.3 — 70% of ceiling), while the
MoE reads only its ~4B active parameters at bf16, roughly 8 GB per token (ceiling
~34 tok/s, measured 24.0 — also ~70%). Same efficiency ratio, half the bytes.
**On this class of machine, choose the model by active parameters, not by
parameter count.**

**Rows 2 → 3.** Moving the *same* 31B checkpoint off Ollama's silent CPU fallback
onto vLLM doubled decode and cut TTFT **18x** (4.440 s → 0.243 s). For an
interactive investigation the TTFT collapse matters more than the decode gain.

**Row 5.** `--quantization fp8` quantizes Google's bf16 checkpoint at load time —
no separate checkpoint, no download. On Blackwell, where FP8 is native, that is
**1.6x over bf16 and 3.4x over the 31B dense**, and it puts the Spark ahead of
the L40S 31B baseline. It is not free — see §5.

## 2. Continuous batching — throughput vs concurrency

Gemma 4 26B-A4B, same prompts, `max_tokens=512`.

| Concurrency | bf16 aggregate | speed-up | FP8 aggregate | speed-up |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 23.7 tok/s | 1.00x | 36.9 tok/s | 1.00x |
| 2 | 43.3 | 1.83x | 67.2 | 1.82x |
| 4 | 56.8 | 2.40x | 88.5 | 2.40x |
| 8 | **102.5** | **4.33x** | **176.3** | **4.78x** |

Median TTFT stays low throughout — 0.225 s → 0.460 s for bf16 — so aggregate
throughput scales 4.3x while perceived latency only doubles, and an
analyst-facing UI stays responsive.

Batching and quantization **compound**: FP8 at concurrency 8 reaches 176.3 tok/s,
**7.4x the bf16 single-stream figure** and 15.6x the 31B dense single-stream
figure. Every single-stream number above therefore *understates* what one box
serves to a team of investigators.

## 3. The biggest end-to-end optimization: the agent as concurrent specialists

The sweep above is synthetic. This is the same effect on the **real product
workload**.

`IRPlanner.analyze()` issued **one large model call** that had to produce the
timeline, the ATT&CK mapping, the clock-conflict analysis and the remediation
plan in a single JSON response. Those four sub-tasks are independent — each reads
the same immutable `IncidentGraph`, none reads another's output — so they run as
four concurrent specialist calls and are merged afterwards
(`scripts/benchmark-agent-parallelism.py`, bf16, `max_tokens=1024`, 2 rounds
after a warm-up):

| Round | Sequential wall | Concurrent wall | Speed-up |
| ---: | ---: | ---: | ---: |
| 1 | 80.42 s | 46.66 s | 1.72x |
| 2 | 78.98 s | 38.99 s | **2.03x** |

Per-specialist latency *rises* under concurrency — reconstruction goes 16.7 s →
23.4 s, the four streams share decode bandwidth — but total wall-clock nearly
halves, because the GPU is no longer idle between calls. **The analyst waits 39
seconds instead of 79 for the same four answers.** No new hardware, no
quantization change, no kernel work.

*Not worth parallelizing:* the planner's five preflight tool calls are pure
in-memory graph reads that finish in milliseconds and never touch the model.

## 4. The optimization stack

All four measured on this hardware, and they compound:

| Optimization | Effect | Cost |
| --- | --- | --- |
| Agent restructured as concurrent specialists | **2.0x** end-to-end wall-clock | none |
| Model choice: 26B-A4B MoE over 31B dense | **2.1x** decode, **+3.4 pts** quality | none |
| Continuous batching at concurrency 8 | **4.3x** aggregate (bf16) | TTFT 0.23 s → 0.46 s |
| Online FP8 (`--quantization fp8`) | **1.6x** decode | 1 critical check — not shipped |

Best measured single stream: **38.77 tok/s** (26B-A4B, FP8). Best aggregate:
**176.3 tok/s** (26B-A4B, FP8, concurrency 8). **Shipped configuration: 26B-A4B
bf16** — 9/11 critical checks kept, 102.5 tok/s aggregate under batching.

## 5. What we chose not to claim

**FP8 costs a critical check, so we do not ship it.** The 1.6x is real, but the
FP8 run drops 9/11 → **8/11 critical** and loses 4 points on `clock_conflict` —
the case testing whether the model is fooled by a misleading file timestamp after
a documented clock correction. For a forensic tool that is the wrong place to
trade accuracy for speed. We serve bf16 and report FP8 as the *measured*
trade-off rather than as a free win.

**No flat winner between the two model sizes.** Per case:

| Case | 31B W4A16 | 26B-A4B bf16 | 26B-A4B FP8 |
| --- | ---: | ---: | ---: |
| reconstruction | **31/34** | 28/34 | 28/34 |
| mitre_mapping | 14/17 | 15/17 | **16/17** |
| clock_conflict | 16/19 | **19/19** | 15/19 |
| remediation | 15/17 | **17/17** | **17/17** |

The 26B is better on aggregate and much faster, and it is perfect on
`clock_conflict` and `remediation`. But it loses **two** critical checks on
`reconstruction` where the 31B loses only one — and `reconstruction` is the case
containing the embedded prompt injection. Both end at 9/11 critical. The honest
claim is "better on aggregate and 2.1x faster", not "strictly better".

**One concurrency number in our data is not trustworthy, and we say so.** The
31B sweep's concurrency-1 point implies 7.0 tok/s, contradicting the 11.32 tok/s
`benchmark-api.py` measures for the same configuration: the 64-token warm-up in
`benchmark-concurrency.py` is too short to absorb that model's first-request
compilation, and wall times *fall* across levels (72.9 s → 47.8 s), showing
warm-up bleeding into the first measurement. **We do not quote the resulting
9.5x.** Only the shape is trustworthy — aggregate throughput keeps rising through
concurrency 8 while TTFT stays under 0.35 s. The 26B sweeps do not show the
artefact because the model compiles faster.

**The Spark is not a fast GPU.** It is ~1.5x slower than an L40S on the same
31B. What it buys is 128 GB of unified memory in a box that can sit inside the
hospital — which, for this product, is the entire point.

**This is a prototype benchmark** — 4 synthetic cases, 87 checks — not a general
claim about model safety.

## Reproducing

Server, on the Spark:

```bash
docker run --rm --name gemma-ir-vllm --gpus all --ipc host --shm-size 16g \
  --publish 127.0.0.1:8000:8000 --env HF_TOKEN="$HF_TOKEN" \
  --volume "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  vllm/vllm-openai:gemma4-cu130 google/gemma-4-26B-A4B-it \
  --revision 4d7ae4984b7db7de8f8457170b3f1a419ee76d52 \
  --served-model-name gemma4:26b --host 0.0.0.0 --port 8000 \
  --max-model-len 8192 --gpu-memory-utilization 0.60 \
  --limit-mm-per-prompt '{"image":0,"audio":0}' \
  --enable-auto-tool-choice --tool-call-parser gemma4 --reasoning-parser gemma4
```

Client, from the analyst machine — the SSH tunnel keeps the endpoint on loopback,
so the local-first claim holds and no application code changes:

```bash
ssh -N -L 8010:127.0.0.1:8000 dgx1
```

```bash
uv run python scripts/benchmark-api.py --base-url http://127.0.0.1:8010/v1 \
  --model gemma4:26b --label spark-26b --output eval/results/spark-26b.json
```

```bash
uv run python scripts/benchmark-concurrency.py --base-url http://127.0.0.1:8010/v1 \
  --model gemma4:26b --levels 1,2,4,8 --output eval/results/spark-26b-concurrency.json
```

```bash
uv run python scripts/benchmark-agent-parallelism.py --base-url http://127.0.0.1:8010/v1 \
  --model gemma4:26b --repeats 2 --output eval/results/spark-26b-agent-parallelism.json
```

```bash
uv run python scripts/evaluate-ir-quality.py --base-url http://127.0.0.1:8010/v1 \
  --model gemma4:26b --max-tokens 1024 \
  --extra-body '{"chat_template_kwargs":{"enable_thinking":false}}' \
  --label spark-26b --output eval/results/spark-26b-quality.json
```

Committed raw output, one file per row above:

| File | Contains |
| --- | --- |
| `eval/results/mac-e4b.json` | laptop E4B throughput (row 1) |
| `eval/results/spark-31b.json` | Spark 31B via Ollama, CPU fallback (row 2) |
| `eval/results/spark-vllm-31b-baseline.json` | Spark 31B dense, vLLM (row 3) |
| `eval/results/spark-vllm-26b-baseline.json` | Spark 26B-A4B bf16 (row 4) |
| `eval/results/spark-vllm-26b-fp8.json` | Spark 26B-A4B FP8 (row 5) |
| `eval/results/spark-{26b,26b-fp8,31b}-concurrency.json` | §2 sweeps |
| `eval/results/spark-26b-agent-parallelism.json` | §3 |
| `eval/results/spark-vllm-{31b,26b,26b-fp8}-quality.json` | quality columns and §5 |
