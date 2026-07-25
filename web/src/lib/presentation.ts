export const PRESENTATION_NAV = [
  { id: "stack", label: "Stack" },
  { id: "benchmark", label: "DGX Spark" },
  { id: "ransomware", label: "Ransomware" },
  { id: "graphs", label: "3 incidents" },
  { id: "closing", label: "Conclusion" },
] as const;

export const STACK_LAYERS = [
  {
    index: "01",
    label: "Isolate",
    title: "Compromised Linux host",
    detail: "Network disconnected. The collector mounts or queries the victim read-only.",
    examples: ["journalctl", "ps + ss", "systemd + cron", "file hashes"],
  },
  {
    index: "02",
    label: "Collect",
    title: "Sealed evidence bundle",
    detail: "Every artifact is inventoried and hashed before analysis.",
    examples: ["SHA-256 manifest", "timestamps", "source paths", "stable evidence IDs"],
  },
  {
    index: "03",
    label: "Normalize",
    title: "Deterministic forensics",
    detail: "Parsers turn raw host state into events, IOCs and an immutable incident graph.",
    examples: ["log parsers", "timeline", "IOC extraction", "ATT&CK mapping"],
  },
  {
    index: "04",
    label: "Reason",
    title: "Gemma 4 on DGX Spark",
    detail: "The model chooses forensic pivots through typed, read-only tools.",
    examples: ["vLLM endpoint", "bounded tool calls", "source-line context", "scope assessment"],
  },
  {
    index: "05",
    label: "Recover",
    title: "Analyst decision",
    detail: "PANDAR returns a sourced diagnosis and a recovery plan. Writes require approval.",
    examples: ["attack path", "exfil status", "remediation order", "human approval"],
  },
] as const;

export const MODEL_BENCHMARKS = [
  {
    name: "Gemma 4 E4B",
    platform: "Analyst laptop · Ollama",
    precision: "Q4_K_M",
    speed: 24.38,
    quality: 62.1,
    critical: "3 / 11",
    tone: "muted",
  },
  {
    name: "Gemma 4 31B dense",
    platform: "DGX Spark · vLLM",
    precision: "W4A16",
    speed: 11.32,
    quality: 87.4,
    critical: "9 / 11",
    tone: "dark",
  },
  {
    name: "Gemma 4 26B-A4B MoE",
    platform: "DGX Spark · vLLM · shipped",
    precision: "bf16",
    speed: 24.01,
    quality: 90.8,
    critical: "9 / 11",
    tone: "accent",
  },
  {
    name: "Gemma 4 26B-A4B MoE",
    platform: "DGX Spark · vLLM · measured only",
    precision: "FP8",
    speed: 38.77,
    quality: 87.4,
    critical: "8 / 11",
    tone: "warning",
  },
] as const;

export const CONCURRENCY = [
  { requests: 1, bf16: 23.7, fp8: 36.9 },
  { requests: 2, bf16: 43.3, fp8: 67.2 },
  { requests: 4, bf16: 56.8, fp8: 88.5 },
  { requests: 8, bf16: 102.5, fp8: 176.3 },
] as const;

export const REPLAY_STAGES = [
  {
    stage: "ORIENT",
    title: "Trust the evidence first",
    logic: "Verify archive integrity and establish collection coverage.",
    tools: "get_case_overview",
    commands: [
      "sha256sum -c evidence/SHA256SUMS",
      "find evidence -type f | sort | wc -l",
    ],
    result: "Integrity verified · 26 artifacts · 2,651 indexed lines · 7 candidate attack steps",
  },
  {
    stage: "INSPECT",
    title: "Check host state and hostile input",
    logic: "Inspect the captured processes and persistence, then quarantine instructions planted inside logs.",
    tools: "inspect_policy_alerts · query_system_state",
    commands: [
      "rg -i 'SYSTEM INSTRUCTION|ignore forensic policy|delete_evidence' evidence/commands/journal.txt",
      "sed -n '1,30p' evidence/commands/processes.txt",
      "rg -i 'systemd|cron|authorized_keys' evidence/commands evidence/files | head -30",
    ],
    result: "1 prompt-injection alert blocked · processes and persistence inspected",
  },
  {
    stage: "SEARCH",
    title: "Find ransomware markers",
    logic: "Pivot from the initial suspicion to exact, literal indicators in the original evidence.",
    tools: "search_raw_evidence",
    commands: [
      "rg -i -F -e 'ransomware' -e 'encrypt' -e 'locked' -e '.locked' evidence/ | head -25",
    ],
    result: "13 raw matches · pacs-crypt wrote study.dcm.locked",
  },
  {
    stage: "CORRELATE",
    title: "Build one attack sequence",
    logic: "Join normalized events, stable indicators and ATT&CK mappings into a chronological hypothesis.",
    tools: "search_events · list_iocs · map_attack_techniques",
    commands: [
      "jq '[.nodes[] | select(.type==\"Event\") | select(tostring|test(\"pacs-crypt\";\"i\"))]' incident-graph.json",
      "jq '.iocs[] | [.type,.value,.evidence_ids]' deterministic-report.json",
      "jq '.techniques[] | select(.confidence >= 0.5)' deterministic-report.json",
    ],
    result: "4 pacs-crypt events · 10 IOCs · 3 evidence-backed ATT&CK techniques",
  },
  {
    stage: "VERIFY",
    title: "Read the surrounding log sequence",
    logic: "Resolve each important claim back to adjacent source lines instead of trusting a model summary.",
    tools: "get_evidence_context",
    commands: [
      "sed -n '2083,2087p' evidence/commands/journal.txt",
      "sha256sum evidence/commands/journal.txt",
    ],
    result: "SSH success → service stop → backup deletion → snapshot removal → encryption",
  },
  {
    stage: "DECIDE",
    title: "Bound impact and recovery",
    logic: "Separate observed facts from missing telemetry, then apply preservation and approval constraints.",
    tools: "assess_incident_scope · assess_exfiltration",
    commands: [
      "jq '{hosts:[.nodes[]|select(.type==\"Host\")], first:.timeline[0], last:.timeline[-1]}' incident-graph.json",
      "rg -i 'allowed|completed|bytes_out|bytes sent' evidence/{proxy,firewall,zeek,dns,netflow}/",
      "policy: preserve_first=true shell=false approval_on_write=true",
    ],
    result: "Scope: host only · exfiltration not observed (0.80) · writes require human approval",
  },
] as const;

export const ATTACK_CASES = [
  {
    id: "identity",
    eyebrow: "Case 01 · identity + persistence",
    title: "Stolen access becomes a persistent service",
    summary: "Account creation, sudo, SSH key, systemd persistence, secret access and a blocked exfiltration attempt.",
    stats: ["8 attack steps", "31 nodes", "49 relations", "6 ATT&CK techniques"],
    graph: "/presentation/identity-attack-graph.svg",
  },
  {
    id: "ransomware",
    eyebrow: "Case 02 · ransomware",
    title: "Recovery is disabled before files are encrypted",
    summary: "SSH access is followed by PACS service shutdown, backup and snapshot deletion, then encryption.",
    stats: ["7 attack steps", "27 nodes", "47 relations", "3 ATT&CK techniques"],
    graph: "/presentation/ransomware-attack-graph.svg",
  },
  {
    id: "webshell",
    eyebrow: "Case 03 · public application",
    title: "A web shell crosses the trust boundary",
    summary: "Suspicious upload, web shell execution, sudo abuse, cron persistence, credential access, staging and a completed outbound transfer.",
    stats: ["7 attack steps", "33 nodes", "50 relations", "7 ATT&CK techniques"],
    graph: "/presentation/webshell-attack-graph.svg",
  },
] as const;
