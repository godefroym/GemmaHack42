# Pandar — a forensic incident-response analyst that never leaves the building

**Track: Edge / On-Device.**
Repository: https://github.com/godefroym/GemmaHack42

> Draft for the Kaggle writeup. Paste as-is or trim. Every number in it is
> measured and reproducible from `eval/results/` — nothing here is an estimate.
> Sections marked TODO need the team to fill in a link or a screenshot.

---

## The problem

A hospital imaging server (PACS) gets compromised. Someone has to reconstruct
what happened: which account, which files, what left the network, what to do
next. That work is slow, it is done under pressure, and it is done badly when
done by hand.

The obvious fix is to hand the logs to a large model. In a hospital you cannot.
Patient-adjacent system logs contain hostnames, account names, file paths and
directory structures from systems holding medical data. In most European
hospital IT policies that material cannot be sent to a third-party inference
provider, and the question is not whether a cloud model would answer better —
it is that the evidence is not allowed to leave the building.

So the constraint comes first and the architecture follows from it. That is the
Edge / On-Device track question — *does running locally actually buy you
something?* — and our answer is not "it is nice to be private". It is that
**the cloud version of this product is not deployable at all**, and we measured
what running locally costs.

## What we built

`gemma-ir` takes an evidence bundle collected from a compromised Linux host and
produces a sourced post-mortem: a timeline, an attack path, MITRE ATT&CK
techniques, indicators of compromise and a remediation plan — where **every
single claim carries a citation to a specific line of a specific evidence file**,
identified by content hash.

It runs entirely on hardware the hospital owns. No API key, no egress.

The demo case is a synthetic hospital compromise: an attacker creates a
`backup-admin` account, installs an SSH key, escalates to sudo, plants a systemd
persistence service disguised as `pacs-health-sync`, reads a secrets file, stages
data in a tar archive, and attempts an outbound transfer that the firewall
blocks.

## How it is architected

Three layers, in strict order of trust.

**1. A deterministic core that never calls a model.** It loads the bundle,
verifies SHA-256 hashes, parses logs line by line, and builds an immutable
`IncidentGraph` — 31 nodes and 51 edges on the demo case. Every evidence line
gets an ID derived from `sha256(path:line:text)`, rendered as `EV-` plus twelve
hex characters. Graph edges are labelled `observed` (seen in a log) or `derived`
(inferred, e.g. an ATT&CK mapping), so the interface can show which is which.
This layer runs in **5 milliseconds** and produces a complete, if unsophisticated,
report on its own.

**2. A bounded Gemma planner.** Gemma 4 reads the graph through eight typed,
read-only tools (`search_events`, `get_evidence`, `trace_attack_path`,
`list_iocs`, `map_attack_techniques`, `get_remediation_constraints`,
`get_entity`, `check_action_policy`). It cannot reach a shell, write a file, or
touch the compromised host. Any tool name outside that allowlist returns
`{ok: false, blocked: true}`.

Its output is then *validated before being trusted*: at least two resolvable
`EV-` citations, a non-empty attack path, techniques present, the prompt
injection acknowledged. If any check fails — or the model exceeds its 75-second
deadline, or emits invalid JSON — the system falls back to the deterministic
report. **The model can improve the answer; it cannot break the product.**

**3. A policy gate.** Every action that would modify a system is marked
`requires_human_approval`. The tool surface is read-only by construction, so the
product cannot execute remediation even if asked to.

## How Gemma 4 is used, and why it is load-bearing

Gemma is not a formatting step bolted onto a deterministic pipeline. The
deterministic core produces a *timeline*; Gemma produces the *investigation* —
it decides which entities matter, connects the persistence service to the
staging directory to the blocked transfer, distinguishes an attempt from a
success, and writes the remediation plan.

The measurement that proves the model is doing the work: on our 87-check
incident-response suite, the deterministic engine alone cannot score at all (it
does not produce prose findings), while the same evidence and the same policy
given to different Gemma variants produces **62.1% to 90.8%**. That 28-point
spread across model tiers is the model doing the reasoning. Swap it for a weaker
one and the product visibly degrades; that is what load-bearing means.

One result we want to highlight because it is the whole point of the track:

| Where it runs | Model | Quality (87 checks) | Critical checks | Decode |
| --- | --- | ---: | ---: | ---: |
| Analyst laptop | Gemma 4 E4B | 54/87 (62.1%) | 3/11 | 24.4 tok/s |
| **On-prem DGX Spark** | **Gemma 4 26B-A4B** | **79/87 (90.8%)** | **9/11** | **24.0 tok/s** |
| Cloud | any | — | — | not deployable |

**The on-premise appliance runs a 26B model at the same speed the laptop runs an
8B one, and answers far better — without a byte of evidence leaving the site.**
The laptop tier still works air-gapped, degraded but honest, which is what you
want when the appliance is unavailable.

## What broke

**The local E4B path hits its deadline.** On the analyst laptop the planner
regularly exceeds its 75-second budget and falls back to the deterministic
report. We did not hide this — we made it a first-class state in the UI, with the
fallback reason shown verbatim, because an investigator needs to know whether
they are reading model output or the deterministic baseline.

**Ollama silently ran on CPU on the DGX Spark.** Started with `--gpus all`, with
the NVIDIA container toolkit installed, and reporting `gpus=1` in its own logs —
and it loaded the entire model into host memory anyway (`CPU_REPACK model buffer
size = 17784.95 MiB`). No error, no warning. A 31B ran at 5.66 tok/s. The
bundled llama.cpp has no kernels for `sm_121`. This cost us an hour and a
misleading benchmark.

**Three of four attempted vLLM configurations failed to load.** Details in the
NVIDIA section below.

**Our own claims did not survive review.** Auditing the repository against its
code, we found the README credited the model with five tool calls that are
actually hard-coded orchestrator preflight calls, and softened a benchmark
finding relative to what `eval/RESULTS.md` recorded. Both are corrected. We also
found that evidence files absent from `SHA256SUMS` are ingested without warning —
a real integrity gap, now documented.

## Results summary

- Deterministic core: 100% of fixture assertions in 5 ms, zero model calls.
- Quality suite: 87 weighted checks, 11 critical, across 4 synthetic cases.
- Best on-prem configuration: Gemma 4 26B-A4B bf16 on DGX Spark —
  **79/87 (90.8%)**, 9/11 critical, 24.0 tok/s single stream, 102.5 tok/s
  aggregate under batching.
- Laptop fallback: Gemma 4 E4B — 54/87 (62.1%), 3/11 critical, 24.4 tok/s.

Full methodology, raw JSON and reproduction commands:
[`eval/SPARK-RESULTS.md`](eval/SPARK-RESULTS.md).

---

# NVIDIA GPU Challenge

## Framework choice, justified

**We chose vLLM**, and we can justify it by what did *not* work.

We attempted five serving configurations on a physical DGX Spark (GB10,
`sm_121`, 121.7 GB unified memory, arm64, Ubuntu 24.04, driver 580.126.09):

| Configuration | Outcome |
| --- | --- |
| Ollama 0.32.1, Gemma 4 31B | Loads, but silently on CPU — 5.66 tok/s, no error |
| SGLang, `gemma-4-31B-it-qat-w4a16-ct` | Marlin repack rejects the layer dimension |
| vLLM + MTP speculative decoding | `gemma4_assistant` architecture unknown to Transformers in the image |
| vLLM + `nvidia/Gemma-4-26B-A4B-NVFP4` | `KeyError: layers.0.experts.0.down_proj.input_scale` |
| **vLLM + Google `-it` checkpoints** | **Works, including online FP8** |

vLLM was the only framework that served Gemma 4 on this hardware at all, and the
only one where a quantization path existed that actually loaded. It also gave us
`--enable-auto-tool-choice` with a `gemma4` tool-call parser, which the product
needs for its eight-tool forensic surface.

## Biggest end-to-end optimization

Not quantization — **restructuring the agent to exploit continuous batching.**

`IRPlanner.analyze()` issued one large model call that had to produce the
timeline, the ATT&CK mapping, the clock-conflict analysis and the remediation
plan in a single JSON response. Those four sub-tasks are independent: each reads
the same immutable graph, none reads another's output. We ran them as four
concurrent specialist calls instead.

| | Sequential | Concurrent | Speed-up |
| --- | ---: | ---: | ---: |
| Wall-clock, 4 specialists | 78.98 s | 38.99 s | **2.03x** |

Per-specialist latency *rises* under concurrency — reconstruction goes from 16.7 s
to 23.4 s — because the streams share decode bandwidth. But total wall-clock
nearly halves, because the GPU is no longer idle between calls. The analyst waits
39 seconds instead of 79 for the same four answers. No new hardware, no
quantization change, no kernel work.

Three further optimizations, all measured, all compounding:

**Model choice (2.1x, free).** Gemma 4 26B-A4B (MoE) beats Gemma 4 31B (dense)
on *both* axes at once: 24.01 vs 11.32 tok/s **and** 79/87 vs 76/87 on quality.
The Spark's ~273 GB/s of unified bandwidth predicts this almost exactly — the
dense 31B must read ~17 GB of weights per token (ceiling ~16 tok/s, measured
11.3), the MoE reads only its ~4B active parameters at bf16, roughly 8 GB
(ceiling ~34 tok/s, measured 24.0). Same 70% efficiency, half the bytes.
**On a bandwidth-bound machine, choose by active parameters, not parameter count.**

**Continuous batching (4.8x aggregate).**

| Concurrency | bf16 | FP8 |
| ---: | ---: | ---: |
| 1 | 23.7 tok/s | 36.9 tok/s |
| 2 | 43.3 | 67.2 |
| 4 | 56.8 | 88.5 |
| 8 | **102.5** | **176.3** |

Median TTFT stays under 0.5 s throughout, so an analyst-facing UI stays
responsive while the box serves a whole IR team.

**Online FP8 quantization (1.6x — but it costs accuracy).** `--quantization fp8`
against Google's bf16 checkpoint raises decode from 24.01 to **38.77 tok/s**,
putting the Spark ahead of an L40S on the 31B. It also drops the quality suite
from 79/87 to 76/87 and from **9/11 to 8/11 critical checks**, with
`clock_conflict` falling 19/19 to 15/19 — the case that tests whether the model
is fooled by a misleading file timestamp after a documented clock correction.

For a forensic tool that is the wrong trade. **We ship bf16 and report FP8 as a
measured option**, rather than quoting the faster number and staying quiet about
what it broke.

## What the experience was like

The hard part was not performance tuning. It was that **the pinned
`vllm/vllm-openai:gemma4-cu130` image lags the Gemma 4 checkpoints that are
actually published.** Four of five configurations failed, and every failure
traced back to that one gap: MTP needs a Transformers build that knows
`gemma4_assistant`; NVIDIA's own NVFP4 26B and RedHatAI's FP8-dynamic 26B both
ship **per-expert** tensors (`layers.N.experts.K.down_proj.*`) where the image's
gemma4 loader expects Google's **fused** expert layout.

Debugging this was slow because the failures are late and cryptic — a
`KeyError` on a tensor name, thirty seconds into weight loading, after a 19 GB
download.

DGX Spark specifics worth knowing: `--gpu-memory-utilization 0.80` fails outright
if the box is doing anything else, because on unified memory the GPU budget is
shared with every other process (ours also ran Open WebUI, LiteLLM, Prometheus,
Grafana). `0.60` worked. And the Spark is not a fast GPU — it is roughly 1.5x
slower than an L40S on the same 31B. What it buys is 128 GB of unified memory in
a box you can put in a hospital, which for this product is the entire point.

## An insight the community can use

Two, both costly to discover and neither documented upstream:

**1. On Blackwell GB10, Ollama detects the GPU and runs on CPU anyway.** It
reports `gpus=1`, starts cleanly, and silently repacks the model to host memory
because its bundled llama.cpp has no `sm_121` kernels. There is no error. If you
benchmark Gemma on a DGX Spark through Ollama you will publish a number that is
roughly 2x too low and 18x too slow on TTFT, and nothing will tell you.
**Watch `nvidia-smi` utilisation during a run; do not trust that the container
started with GPU support.**

**2. Third-party quantized Gemma 4 MoE checkpoints do not load on
`gemma4-cu130`, regardless of format.** NVFP4 and FP8-dynamic fail identically
because both ship per-expert tensors against a loader expecting fused experts.
**The workaround is online quantization**: point vLLM at Google's own bf16
checkpoint and pass `--quantization fp8`. The fused layout is preserved, no extra
download is needed, and you get the speed-up anyway.

## Reproducing

Everything is in the repository. Hardware, model variant, precision and
concurrency are documented for every number in
[`eval/SPARK-RESULTS.md`](eval/SPARK-RESULTS.md); raw JSON is committed under
`eval/results/`.

```bash
docker run --rm --gpus all --ipc host --shm-size 16g \
  --publish 127.0.0.1:8000:8000 --env HF_TOKEN="$HF_TOKEN" \
  --volume "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  vllm/vllm-openai:gemma4-cu130 google/gemma-4-26B-A4B-it \
  --revision 4d7ae4984b7db7de8f8457170b3f1a419ee76d52 \
  --served-model-name gemma4:26b --host 0.0.0.0 --port 8000 \
  --max-model-len 8192 --gpu-memory-utilization 0.60 \
  --enable-auto-tool-choice --tool-call-parser gemma4 --reasoning-parser gemma4
```

```bash
uv run python scripts/benchmark-concurrency.py --base-url http://127.0.0.1:8010/v1 --model gemma4:26b --levels 1,2,4,8
```

```bash
uv run python scripts/benchmark-agent-parallelism.py --base-url http://127.0.0.1:8010/v1 --model gemma4:26b --repeats 2
```

---

## TODO before submitting

- [ ] Live demo link or video — must be reachable by someone who is not us.
- [ ] Confirm the Kaggle closing time on the 42AI Discord.
- [ ] Screenshot: the quarantined prompt injection in the dashboard.
- [ ] Screenshot: `delete_evidence` returning a live `blocked` response.
- [ ] Screenshot: the evidence drawer showing path, line number and SHA-256.
- [ ] Team member names / Kaggle handles.
