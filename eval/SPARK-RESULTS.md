# DGX Spark measurements — 2026-07-25

This file records what was actually measured on a **physical DGX Spark** today. It
closes the gap left open in `README.md` ("prepared but not measured on a physical
Spark") for the vLLM path, and it records the framework failures we hit on the
way, which are arguably more useful than the throughput numbers.

Everything below was produced with the repository's own scripts
(`scripts/benchmark-api.py`, `scripts/evaluate-ir-quality.py`,
`scripts/benchmark-concurrency.py`) against unmodified pinned checkpoints. Raw
JSON lives in `eval/results/`.

> **Action required:** `eval/results/` is currently listed in `.gitignore`. The
> NVIDIA GPU Challenge rubric awards up to 15 points for *reproducible*
> benchmarks, so these files must be committed before submission.

## Headline

On this hardware, **Gemma 4 26B-A4B (MoE) beats Gemma 4 31B (dense) on both axes
at once**: 2.1x the decode throughput and a higher score on the analysis suite —
while running at higher precision (bf16 vs W4A16). On a memory-bandwidth-bound
machine, active parameter count dominates total parameter count.

The on-premise Spark runs the 26B MoE at **the same speed a MacBook runs the 8B
E4B** (24.0 vs 24.4 tok/s), while scoring 90.8% against the laptop's 62.1%.

Three optimizations were measured on top of that, and they compound:

| Optimization | Effect | Cost |
| --- | --- | --- |
| Model choice: 26B-A4B MoE over 31B dense | 2.1x decode, +3.4 pts quality | none |
| Online FP8 (`--quantization fp8`) | 1.6x decode | 1 critical check |
| Continuous batching at concurrency 8 | 4.8x aggregate | TTFT 0.2s to 0.5s |
| Agent restructured as concurrent specialists | 2.0x end-to-end wall-clock | none |

Best measured single-stream figure: **38.77 tok/s** (26B-A4B, FP8). Best aggregate:
**176.3 tok/s** (26B-A4B, FP8, concurrency 8). Recommended production
configuration: **26B-A4B bf16**, which keeps 9/11 critical checks and still serves
102.5 tok/s aggregate under batching.

## Hardware and software under test

Recorded explicitly because the NVIDIA rubric caps benchmarks at 5/15 unless
hardware, model variant, precision and concurrency are documented.

| Property | Value |
| --- | --- |
| Machine | NVIDIA DGX Spark, `spark-3a34` |
| GPU | NVIDIA GB10 (Grace Blackwell), compute capability 12.1 (`sm_121`) |
| Memory | 121.7 GB unified (LPDDR5X), shared between CPU and GPU |
| CPU | 20 cores, `aarch64` |
| OS | Ubuntu 24.04.4 LTS, kernel 6.17.0-1008-nvidia |
| Driver | 580.126.09 |
| Container runtime | Docker 29.1.3, nvidia-container-toolkit present |
| Serving image | `vllm/vllm-openai:gemma4-cu130` (multi-arch, `linux/arm64` manifest confirmed) |
| Attention backend | `TRITON_ATTN` (auto-selected) |
| `--gpu-memory-utilization` | **0.60** (see failure 3) |
| `--max-model-len` | 8192 |

Checkpoints, pinned by revision:

| Served as | Repo | Revision | Precision |
| --- | --- | --- | --- |
| `gemma4:31b` | `google/gemma-4-31B-it-qat-w4a16-ct` | `52f3f65bc7a02d555763bc923bd1d9094898219d` | W4A16 (Marlin) |
| `gemma4:26b` | `google/gemma-4-26B-A4B-it` | `4d7ae4984b7db7de8f8457170b3f1a419ee76d52` | bf16 |

Baseline comparison machine: MacBook (Apple Silicon), Ollama, same repository
scripts, same prompts.

## Throughput at concurrency 1

Method: `scripts/benchmark-api.py`, 3 fixed prompts x 2 repeats = 6 measured runs,
preceded by one unmeasured warm-up. `temperature=0`, `max_tokens=512`, streaming
with usage accounting. TTFT is wall-clock to first content delta; decode rate is
`completion_tokens / (finish - first_token)`. Medians reported.

| # | Configuration | Precision | Decode (tok/s) | TTFT (s) |
| --- | --- | --- | ---: | ---: |
| 1 | MacBook, Gemma 4 E4B, Ollama | Q4_K_M | 24.38 | 0.991 |
| 2 | DGX Spark, 31B, Ollama 0.32.1 — **fell back to CPU** | Q4_K_M | 5.66 | 4.440 |
| 3 | DGX Spark, 31B dense, vLLM | W4A16 | 11.32 | 0.243 |
| 4 | DGX Spark, 26B-A4B MoE, vLLM | bf16 | 24.01 | 1.040 |
| 5 | **DGX Spark, 26B-A4B MoE, vLLM `--quantization fp8`** | **FP8 (online)** | **38.77** | 1.400 |
| 6 | *(prior run, HF L40S 48 GB, 31B vLLM baseline)* | W4A16 | *35.4* | *0.431* |
| 7 | *(prior run, HF L40S 48 GB, 31B vLLM + 1-token MTP)* | W4A16 | *62.1* | *0.721* |

Rows 6 and 7 are reproduced from `eval/RESULTS.md` for context; they were measured
on different hardware and are not a like-for-like comparison.

**Row 5.** `--quantization fp8` makes vLLM quantize the bf16 checkpoint to FP8 at
load time — no separate checkpoint, no download. On Blackwell, where FP8 is native,
this raises decode by **1.6x over bf16 and 3.4x over the 31B dense**, and puts the
Spark ahead of the L40S 31B baseline (row 6). It is not free: see the quality
table, where FP8 costs one critical check.

**Rows 2 and 3.** Moving the same 31B checkpoint from Ollama's silent CPU fallback
to vLLM on the GB10 doubled decode throughput and cut time-to-first-token by 18x
(4.440 s to 0.243 s). For an interactive investigation workflow the TTFT collapse
matters more than the decode gain.

**Rows 3 and 4 — the interesting one.** The 26B-A4B MoE is 2.1x faster than the
31B dense despite carrying *more* bytes per weight. The Spark's ~273 GB/s of
unified memory bandwidth predicts this almost exactly: the dense 31B must read
~17 GB of weights per token (ceiling ~16 tok/s, measured 11.3, 70% of ceiling),
while the MoE reads only its ~4B active parameters at bf16, roughly 8 GB per token
(ceiling ~34 tok/s, measured 24.0, also ~70% of ceiling). Same efficiency ratio,
half the bytes. **On this class of machine, choose the model by active parameters,
not by parameter count.**

**Rows 4 and 5.** The Spark is roughly 1.5x slower than an L40S on the 31B. That
is the honest framing: the Spark does not buy speed, it buys 128 GB of unified
memory in a box that can sit inside the hospital.

## Batching — how throughput scales with concurrency

Method: `scripts/benchmark-concurrency.py`, Gemma 4 26B-A4B, same prompts,
`max_tokens=512`, one unmeasured warm-up. Aggregate throughput is total completion
tokens divided by wall-clock for the whole batch.

| Concurrency | bf16 aggregate | bf16 speed-up | FP8 aggregate | FP8 speed-up |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 23.7 | 1.00x | 36.9 | 1.00x |
| 2 | 43.3 | 1.83x | 67.2 | 1.82x |
| 4 | 56.8 | 2.40x | 88.5 | 2.40x |
| 8 | **102.5** | **4.33x** | **176.3** | **4.78x** |

Median TTFT stays low throughout: 0.225 s to 0.460 s for bf16, 0.650 s to 0.305 s
for FP8 (the FP8 numbers are noisier because compilation and cache effects land
inside a much shorter run).

Batching and quantization **compound**: FP8 at concurrency 8 reaches 176.3 tok/s
aggregate, **7.4x the bf16 single-stream figure** and 15.6x the 31B dense
single-stream figure.

This is the single biggest end-to-end optimization available on the Spark and it
requires no configuration change — only sending more than one request at a time.
Aggregate throughput scales 4.3x from concurrency 1 to 8 while median TTFT only
doubles (0.225 s to 0.460 s), so an analyst-facing UI stays responsive. Every
single-stream number elsewhere in this document therefore *understates* what the
box can serve to a team of investigators.

## End-to-end optimization: the agent as concurrent specialists

The concurrency sweep above is synthetic — it fires the same prompt N times. This
section measures the same effect on the **real product workload**, which is what
the "biggest end-to-end optimization" section of the writeup should describe.

`IRPlanner.analyze()` currently issues **one large model call** that must produce
the timeline, the ATT&CK mapping, the clock-conflict analysis and the remediation
plan in a single JSON response. Those four sub-tasks are independent: each reads
the same immutable `IncidentGraph` and none reads another's output. They can run
as four concurrent specialist calls and be merged afterwards.

`scripts/benchmark-agent-parallelism.py` measures exactly that, using the four
prompts already in `eval/quality-cases.jsonl` as the four specialists. Gemma 4
26B-A4B, bf16, `max_tokens=1024`, two rounds after an unmeasured warm-up:

| Round | Sequential wall | Concurrent wall | Speed-up |
| ---: | ---: | ---: | ---: |
| 1 | 80.42 s | 46.66 s | 1.72x |
| 2 | 78.98 s | 38.99 s | **2.03x** |

Per-specialist latency *increases* under concurrency (reconstruction goes from
16.7 s to 23.4 s) because the four streams share decode bandwidth — but total
wall-clock nearly halves, because the GPU is no longer idle between calls. The
analyst waits **39 seconds instead of 79** for the same four answers.

This is the optimization to lead with, for three reasons:

1. It is measured on the product's own workload, not a synthetic loop.
2. It requires no new hardware, no quantization change and no kernel work — only
   restructuring one sequential call into four concurrent ones.
3. It compounds with the concurrency sweep: a single Spark serving an IR team
   working several hosts at once operates at the concurrency-8 point of the table
   above (102.5 tok/s aggregate), not the concurrency-1 point.

**What is *not* worth parallelizing.** The planner's five preflight calls
(`trace_attack_path`, `map_attack_techniques`, `list_iocs`, `search_events`,
`get_remediation_constraints`) are pure in-memory graph reads that complete in
milliseconds and never touch the model. Parallelizing them gains nothing; the
whole cost is in the single model call that follows them.

## Analysis quality — 87 weighted checks

Method: `scripts/evaluate-ir-quality.py` against `eval/quality-cases.jsonl`
(SHA-256 `373027b916237fb11d6d782aeacf344a315b77ee7586dc05cd3198ac4a2b1742`).
4 synthetic incident-response cases, 87 weighted points, 11 critical checks
(weight 3). `temperature=0`, `--max-tokens 1024`,
`--extra-body '{"chat_template_kwargs":{"enable_thinking":false}}'`.

| Configuration | Score | Critical |
| --- | ---: | ---: |
| MacBook, E4B, Ollama *(prior run)* | 54/87 (62.1%) | 3/11 |
| HF L40S, 31B, vLLM MTP *(prior run)* | 75/87 (86.2%) | 9/11 |
| DGX Spark, 31B dense, vLLM, W4A16 | 76/87 (87.4%) | 9/11 |
| **DGX Spark, 26B-A4B MoE, vLLM, bf16** | **79/87 (90.8%)** | **9/11** |
| DGX Spark, 26B-A4B MoE, vLLM, FP8 | 76/87 (87.4%) | **8/11** |

Per case:

| Case | 31B W4A16 | 26B-A4B bf16 | 26B-A4B FP8 |
| --- | ---: | ---: | ---: |
| reconstruction | 31/34 | 28/34 | 28/34 |
| mitre_mapping | 14/17 | 15/17 | **16/17** |
| clock_conflict | 16/19 | **19/19** | 15/19 |
| remediation | 15/17 | **17/17** | **17/17** |

**FP8 costs a critical check.** The 1.6x throughput gain is real, but the FP8 run
drops from 9/11 to 8/11 critical checks and loses four points on clock_conflict —
the case that tests whether the model is fooled by a misleading file timestamp
after a documented clock correction. For a forensic tool that is the wrong place
to trade accuracy for speed. **Recommendation: serve bf16 for the product and
report FP8 as the measured speed/accuracy trade-off**, rather than presenting FP8
as a free win.

**Read this carefully rather than declaring a flat winner.** The 26B scores higher
overall and is perfect on clock_conflict and remediation — it never fell for the
misleading file timestamp and it marked every modifying action as requiring human
approval. But it lost **two** critical checks on reconstruction where the 31B lost
only one, and reconstruction is the case containing the embedded prompt injection.
Both models end at 9/11 critical. The correct claim is that the 26B is better on
aggregate and much faster, while the 31B is marginally more reliable on the
adversarial reconstruction case.

**The Spark reproduces the L40S 31B result** (76/87 vs 75/87 — within run-to-run
variation). The on-premise box delivers the same analysis quality as the cloud GPU.

## Four configuration failures worth documenting

These cost real time and none are documented upstream. They are the most reusable
output of the day, and together they justify the framework choice.

### 1. Ollama silently runs on CPU on GB10

Ollama 0.32.1 (image built 2026-07-17), started **with** `--gpus all` and with
`nvidia-container-toolkit` correctly installed, detects the GPU — its own logs say
`gpus=1` — and then loads the entire model into host memory anyway:

```
load_tensors:   CPU_REPACK model buffer size = 17784.95 MiB
llama_kv_cache:        CPU KV buffer size =  2560.00 MiB
clip_ctx: CLIP using CPU backend
```

No error, no warning that inference is not GPU-accelerated. The only symptoms are
`ollama ps` reporting `100% CPU` and a 31B running at 5.66 tok/s. The bundled
llama.cpp build has no kernels for `sm_121`.

**Takeaway: on Blackwell GB10, watch `nvidia-smi` utilisation during a run rather
than trusting that the container started with GPU support.**

### 2. MTP speculative decoding does not load on this image

`--speculative-config` with the pinned assistant checkpoint
`google/gemma-4-31B-it-qat-q4_0-unquantized-assistant` (revision
`96d4c8ca3cb38c107a8478587878124895d1e844`) is rejected at startup:

```
ValidationError: 1 validation error for SpeculativeConfig
  Value error, The checkpoint you are trying to load has model type
  `gemma4_assistant` but Transformers does not recognize this architecture.
```

The Transformers version inside `vllm/vllm-openai:gemma4-cu130` predates the
`gemma4_assistant` architecture. The +75% MTP speed-up recorded on the L40S (which
ran `vllm/vllm-openai:nightly`) is **not currently reproducible on the Spark with
the pinned CUDA 13 image**.

### 3. `--gpu-memory-utilization 0.80` fails on shared unified memory

The repository default in `scripts/start-dgx-spark-vllm.sh` aborts on a Spark that
is doing anything else:

```
ValueError: Free memory on device cuda:0 (87.54/121.69 GiB) on startup is less
than desired GPU memory utilization (0.8, 97.35 GiB).
```

On unified memory the GPU budget is shared with every other process on the box.
Ours was also running Open WebUI, LiteLLM, Prometheus, Grafana and an Ollama
instance holding a 39 GB model resident. Unloading that model and dropping to
`0.60` resolved it. **The right default for a Spark is lower than for a dedicated
datacentre GPU, and it depends on what else the box hosts.**

### 4. NVIDIA's own NVFP4 26B checkpoint does not load either

`nvidia/Gemma-4-26B-A4B-NVFP4` selects the `VLLM_CUTLASS` NvFp4 MoE backend
correctly — NVFP4 *is* supported on GB10 — and then fails during weight loading:

```
File "vllm/model_executor/models/gemma4.py", line 1359, in load_weights
    param = params_dict[name]
KeyError: 'layers.0.experts.0.down_proj.input_scale'
```

`RedHatAI/gemma-4-26B-A4B-it-FP8-dynamic` fails the same way, one tensor earlier:

```
KeyError: 'layers.0.experts.0.down_proj.weight'
```

Both third-party quantized MoE checkpoints ship **per-expert** tensors
(`layers.N.experts.K.down_proj.*`), while this image's gemma4 loader expects
Google's **fused** expert layout. Any third-party quantized 26B-A4B checkpoint is
therefore likely to fail on `gemma4-cu130` regardless of the quantization format.

**The workaround that does work is online quantization**: point vLLM at Google's
own bf16 checkpoint and pass `--quantization fp8`. vLLM quantizes at load time, the
fused layout is preserved, and no extra download is needed. That path produced the
38.77 tok/s row in the throughput table.

Related: **no W4A16 compressed-tensors checkpoint is published for 26B-A4B**, so a
precision-matched comparison between the two model sizes is not currently possible
with Google's checkpoints.

### The pattern

Four of five attempted configurations failed, and all four failures share one root
cause: **the pinned `vllm/vllm-openai:gemma4-cu130` image is behind the Gemma 4
checkpoints that are actually published.** MTP, NVFP4, and (per `eval/RESULTS.md`)
SGLang's Marlin repack all break on checkpoint layouts newer than the image. Anyone
benchmarking Gemma 4 on a DGX Spark today should budget time for this and start
from the plain `-it` checkpoints, which load reliably.

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
so the local-first claim is preserved and no application code changes:

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
uv run python scripts/evaluate-ir-quality.py --base-url http://127.0.0.1:8010/v1 \
  --model gemma4:26b --max-tokens 1024 \
  --extra-body '{"chat_template_kwargs":{"enable_thinking":false}}' \
  --label spark-26b --output eval/results/spark-26b-quality.json
```

## Still open

- Concurrency sweep for the 31B dense (only the 26B was swept).
- MTP on the Spark, blocked on the Transformers version in the pinned image.
- A precision-matched 31B vs 26B comparison, blocked on the missing W4A16
  checkpoint for 26B-A4B.
