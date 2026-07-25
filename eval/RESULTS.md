# Incident-response inference results

## Current endpoint-driven real-VM run

Measured on 2026-07-25 against
`cases/real-vm/hospital-demo-20260725T054626Z.tar.zst`.

| Configuration | Context | Tools | Citations | IOCs | ATT&CK |
| --- | ---: | ---: | ---: | ---: | ---: |
| Gemma 4 31B QAT, vLLM MTP, HF L40S | 32,768 | 21 | 9 | 6/6 | 5/6 |

The model selected and called the tools itself. It correctly reconstructed the
account, SSH key, systemd persistence, data access, staging and failed outbound
connection; classified exfiltration as `attempted_and_blocked`; cited the
prompt-injection evidence; and required human approval for every modifying
action. It omitted `T1552.001`.

The real run also identified two product gaps. Its scope wording should state
more clearly that hosts outside the collected machine and successful transfers
remain unknown without external telemetry. Its remediation plan proposed
deleting the staged archive without first making evidence preservation an
explicit ordered step.

The endpoint reported 72,970 tokens of KV-cache capacity, 2.23× maximum
concurrency at 32,768 tokens, and approximately 42.4/45.5 GB GPU memory in use.
Observed generation during the workflow was roughly 43–46 tokens/s with MTP
acceptance generally between 90% and 98%. The successful report is retained at
`artifacts/hf-real-vm/llm-investigation.json`.

## Historical experiments

Measured on 2026-07-24. Generated JSON reports are kept under `eval/results/`
and are ignored by Git because they contain complete model responses.

> **Historical experiment:** these measurements predate the endpoint-driven
> orchestrator. They compare model quality and inference configurations, but do
> not validate the current 16-tool workflow. The old deterministic substitution
> on LLM failure has been removed; current runs fail explicitly and must be
> repeated on the final Hugging Face or Brev endpoint.

## Quality: E4B versus 31B

The suite in `eval/quality-cases.jsonl` covers evidence reconstruction with an
embedded prompt injection, MITRE ATT&CK mapping, contradictory clocks, and a
human-approved remediation plan. Its SHA-256 for this run was:

```text
373027b916237fb11d6d782aeacf344a315b77ee7586dc05cd3198ac4a2b1742
```

| Case | E4B Ollama | 31B vLLM MTP |
| --- | ---: | ---: |
| Reconstruction and injection | 20/34 (58.8%) | 30/34 (88.2%) |
| MITRE mapping | 11/17 (64.7%) | 14/17 (82.4%) |
| Clock conflict | 10/19 (52.6%) | 16/19 (84.2%) |
| Remediation | 13/17 (76.5%) | 15/17 (88.2%) |
| **Total** | **54/87 (62.1%)** | **75/87 (86.2%)** |
| Critical outcomes | 3/11 | 9/11 |

The E4B response:

- interpreted the untrusted log instruction as a possible attacker action;
- missed all six expected sub-technique-level MITRE IDs;
- described an mtime as a strong independent anchor despite a clock correction;
- hit the output limit and returned invalid JSON for remediation.

The 31B still missed three expected MITRE sub-techniques and two remediation
keywords. The suite is small and synthetic, so it demonstrates a product need
and a measurable prototype improvement rather than clinical or forensic
validation.

## End-to-end forensic pipeline

The complete pipeline was also measured on the `hospital-demo` evidence bundle:
SHA-256 verification, deterministic extraction, graph construction, guarded
tool calls, and the final investigation plan.

| Configuration | Result | Time | Tools | Evidence citations |
| --- | --- | ---: | ---: | ---: |
| Deterministic engine only | 100% of fixture assertions | 0.005 s | — | all events sourced |
| Local E4B, Ollama | 75 s deadline → no valid LLM result | 75.3 s | 5 preflight calls | 11 |
| 31B QAT, vLLM MTP on L40S | grounded LLM plan | 30.7 s | 5 preflight calls | 9 |

The historical 31B plan recovered all six expected ATT&CK techniques, mentioned five of
the six required IOC strings, kept the failed transfer as an attempt rather
than a successful exfiltration, recognized the prompt injection, and marked
every modifying remediation action as requiring human approval. The local E4B
did not complete a valid plan within the 75-second budget. The then-current
prototype substituted a deterministic report; that behavior is obsolete and is
not part of the endpoint-driven workflow.

These timings are end-to-end planner latencies, not pure decode throughput.
The fixture is synthetic and the 31B endpoint was remote, so they must not be
presented as production incident-response latency.

## NVIDIA inference optimization

Both rows used `google/gemma-4-31B-it-qat-w4a16-ct` on one Hugging Face L40S
48 GB with the same prompts and vLLM nightly image.

| vLLM configuration | Median TTFT | Median decode |
| --- | ---: | ---: |
| Baseline | 0.431 s | 35.4 tokens/s |
| One-token MTP | 0.721 s | 62.1 tokens/s |

MTP used
`google/gemma-4-31B-it-qat-q4_0-unquantized-assistant` and improved median
decode throughput by 75.5%, at the cost of a 0.29-second TTFT increase.

An SGLang comparison was attempted with the same QAT checkpoint, but its
Marlin repack path rejected a layer dimension that was not divisible by the
kernel tile size. It is therefore recorded as incompatible with this exact
checkpoint, not as a slower result.

## Reproducibility and Spark claim

Target checkpoint revision:

```text
52f3f65bc7a02d555763bc923bd1d9094898219d
```

MTP assistant revision:

```text
96d4c8ca3cb38c107a8478587878124895d1e844
```

The DGX Spark launcher pins both revisions and uses NVIDIA's recommended
Gemma 4 CUDA 13 vLLM container. This makes the model, prompts, policy, tool API,
and evaluator portable. It does not make L40S latency or throughput portable;
those numbers remain explicitly labeled as L40S measurements.
