from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from itertools import pairwise
from typing import Any

from gemma_ir.bundle import EvidenceBundle, EvidenceLine
from gemma_ir.graph import GraphBuilder, stable_id
from gemma_ir.models import DeterministicReport, IncidentGraph, RemediationAction

TECHNIQUES: dict[str, tuple[str, str]] = {
    "public_app_exploit": ("T1190", "Exploit Public-Facing Application"),
    "web_shell": ("T1505.003", "Server Software Component: Web Shell"),
    "sudo_abuse": (
        "T1548.003",
        "Abuse Elevation Control Mechanism: Sudo and Sudo Caching",
    ),
    "scheduled_task": ("T1053.003", "Scheduled Task/Job: Cron"),
    "account_created": ("T1136.001", "Create Account: Local Account"),
    "ssh_key_added": ("T1098.004", "Account Manipulation: SSH Authorized Keys"),
    "service_created": (
        "T1543.002",
        "Create or Modify System Process: Systemd Service",
    ),
    "credential_access": (
        "T1552.001",
        "Unsecured Credentials: Credentials In Files",
    ),
    "data_staged": ("T1005", "Data from Local System"),
    "exfiltration_attempt": (
        "T1048.003",
        ("Exfiltration Over Alternative Protocol: Exfiltration Over Unencrypted Non-C2 Protocol"),
    ),
    "service_stop": ("T1489", "Service Stop"),
    "inhibit_recovery": ("T1490", "Inhibit System Recovery"),
    "data_encrypted": ("T1486", "Data Encrypted for Impact"),
}


@dataclass
class EntityObservation:
    type: str
    label: str
    role: str
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class Observation:
    event_type: str
    timestamp: str | None
    summary: str
    evidence: EvidenceLine
    entities: list[EntityObservation]
    technique: tuple[str, str] | None = None
    confidence: float = 1.0
    corroborating_evidence: list[EvidenceLine] = field(default_factory=list)

    @property
    def evidence_lines(self) -> list[EvidenceLine]:
        return [self.evidence, *self.corroborating_evidence]


TIMESTAMP_RE = re.compile(
    r"(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)"
)
NGINX_TIMESTAMP_RE = re.compile(
    r"\[(?P<timestamp>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4})\]"
)
AUDIT_TIMESTAMP_RE = re.compile(r"\bmsg=audit\((?P<epoch>\d{10}(?:\.\d+)?):\d+\)")
IP_RE = r"(?:\d{1,3}\.){3}\d{1,3}"


def timestamp_from_line(text: str) -> str | None:
    match = TIMESTAMP_RE.search(text)
    if match is not None:
        return match.group("timestamp").replace(",", ".")
    nginx_match = NGINX_TIMESTAMP_RE.search(text)
    if nginx_match is not None:
        return datetime.strptime(
            nginx_match.group("timestamp"),
            "%d/%b/%Y:%H:%M:%S %z",
        ).isoformat()
    audit_match = AUDIT_TIMESTAMP_RE.search(text)
    if audit_match is not None:
        return datetime.fromtimestamp(
            float(audit_match.group("epoch")),
            tz=UTC,
        ).isoformat()
    return None


def timestamp_sort_key(value: str | None) -> tuple[int, float, str]:
    if value is None:
        return (1, 0.0, "")
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return (0, 0.0, value)
    if parsed.tzinfo is not None:
        return (0, parsed.timestamp(), "")
    return (0, 0.0, parsed.isoformat())


class DeterministicAnalyzer:
    def analyze(self, bundle: EvidenceBundle) -> IncidentGraph:
        observations: list[Observation] = []
        event_sources = (
            "commands/journal",
            "commands/audit_search",
            "commands/last_logins",
            "commands/failed_logins",
            "commands/systemd",
            "files/var/log/",
        )
        for line in bundle.iter_lines():
            if not line.ref.source_path.startswith(event_sources):
                continue
            observations.extend(self._detect_line(line))
        observations.extend(self._detect_collected_files(bundle))
        observations = self._keep_incident_relevant_observations(observations)
        observations.sort(
            key=lambda item: (
                timestamp_sort_key(item.timestamp),
                item.evidence.ref.source_path,
                item.evidence.ref.line_number,
                item.event_type,
            )
        )
        observations = self._consolidate_observations(observations)
        return self._build_graph(bundle, observations)

    @staticmethod
    def _keep_incident_relevant_observations(
        observations: list[Observation],
    ) -> list[Observation]:
        suspicious_accounts = {
            entity.label
            for observation in observations
            if observation.event_type in {"ssh_key_added", "privilege_change"}
            for entity in observation.entities
            if entity.type == "Account"
        }
        if not suspicious_accounts:
            return observations
        return [
            observation
            for observation in observations
            if observation.event_type not in {"account_created", "authentication"}
            or any(
                entity.type == "Account" and entity.label in suspicious_accounts
                for entity in observation.entities
            )
        ]

    @classmethod
    def _consolidate_observations(
        cls,
        observations: list[Observation],
    ) -> list[Observation]:
        consolidated: dict[tuple[str, str, int | str | None], Observation] = {}
        for observation in observations:
            key = (
                observation.event_type,
                observation.summary,
                cls._timestamp_bucket(observation.timestamp),
            )
            existing = consolidated.get(key)
            if existing is None:
                consolidated[key] = observation
            else:
                existing.corroborating_evidence.extend(observation.evidence_lines)

        result = list(consolidated.values())
        timed_observations = {
            (observation.event_type, observation.summary): observation
            for observation in result
            if observation.timestamp is not None
        }
        for observation in list(result):
            if observation.timestamp is not None:
                continue
            candidate = timed_observations.get(
                (observation.event_type, observation.summary)
            )
            if candidate is not None:
                candidate.corroborating_evidence.extend(observation.evidence_lines)
                result.remove(observation)

        known_exfil = [
            observation
            for observation in result
            if observation.event_type == "exfiltration_attempt"
            and not observation.summary.endswith(":unknown was blocked")
        ]
        for observation in list(result):
            if (
                observation.event_type != "exfiltration_attempt"
                or not observation.summary.endswith(":unknown was blocked")
            ):
                continue
            unknown_ip = cls._endpoint_address(observation)
            unknown_bucket = cls._timestamp_bucket(observation.timestamp)
            candidate = next(
                (
                    item
                    for item in known_exfil
                    if cls._endpoint_address(item) == unknown_ip
                    and cls._timestamps_are_close(
                        unknown_bucket,
                        cls._timestamp_bucket(item.timestamp),
                    )
                ),
                None,
            )
            if candidate is not None:
                candidate.corroborating_evidence.extend(observation.evidence_lines)
                result.remove(observation)

        return sorted(
            result,
            key=lambda item: (
                timestamp_sort_key(item.timestamp),
                item.evidence.ref.source_path,
                item.evidence.ref.line_number,
                item.event_type,
            ),
        )

    @staticmethod
    def _timestamp_bucket(value: str | None) -> int | str | None:
        if value is None:
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return value
        if parsed.tzinfo is None:
            return parsed.replace(microsecond=0).isoformat()
        return int(parsed.timestamp())

    @staticmethod
    def _timestamps_are_close(
        first: int | str | None,
        second: int | str | None,
    ) -> bool:
        if isinstance(first, int) and isinstance(second, int):
            return abs(first - second) <= 1
        return first == second

    @staticmethod
    def _endpoint_address(observation: Observation) -> str | None:
        return next(
            (
                str(entity.properties.get("address"))
                for entity in observation.entities
                if entity.type == "Endpoint" and entity.properties.get("address")
            ),
            None,
        )

    def _detect_line(self, line: EvidenceLine) -> list[Observation]:
        text = line.text
        timestamp = timestamp_from_line(text)
        observations: list[Observation] = []

        user_match = re.search(
            r"(?:useradd|new user:).*?(?:name=|user=)(?P<account>[a-z_][\w-]*)",
            text,
            re.IGNORECASE,
        )
        if user_match:
            account = user_match.group("account")
            observations.append(
                Observation(
                    "account_created",
                    timestamp,
                    f"Local account {account} was created",
                    line,
                    [EntityObservation("Account", account, "target", {"ioc": True})],
                    TECHNIQUES["account_created"],
                )
            )

        key_match = re.search(
            r"authorized_keys.*?(?:user=|for\s+)(?P<account>[a-z_][\w-]*)",
            text,
            re.IGNORECASE,
        )
        if key_match and re.search(r"creat|writ|modif|install", text, re.IGNORECASE):
            account = key_match.group("account")
            path = f"/home/{account}/.ssh/authorized_keys"
            observations.append(
                Observation(
                    "ssh_key_added",
                    timestamp,
                    f"An SSH authorized key was installed for {account}",
                    line,
                    [
                        EntityObservation("Account", account, "target", {"ioc": True}),
                        EntityObservation("File", path, "artifact", {"ioc": True}),
                    ],
                    TECHNIQUES["ssh_key_added"],
                )
            )

        ssh_match = re.search(
            rf"accepted (?:publickey|password) for (?P<account>[a-z_][\w-]*) from (?P<ip>{IP_RE})",
            text,
            re.IGNORECASE,
        )
        if ssh_match:
            account = ssh_match.group("account")
            ip = ssh_match.group("ip")
            observations.append(
                Observation(
                    "authentication",
                    timestamp,
                    f"SSH login for {account} from {ip}",
                    line,
                    [
                        EntityObservation(
                            "Endpoint",
                            ip,
                            "source",
                            {
                                "ioc": not ip.startswith("127."),
                                "role": "source",
                                "address": ip,
                            },
                        ),
                        EntityObservation("Account", account, "target", {"ioc": True}),
                    ],
                )
            )

        web_exploit_match = re.search(
            rf"(?P<ip>{IP_RE}).*?\"POST\s+"
            r"(?P<uri>/\S*(?:upload|import)\S*(?:\.php|shell|cmd)\S*)\s+"
            r"HTTP/[\d.]+\"\s+2\d\d\b",
            text,
            re.IGNORECASE,
        )
        if web_exploit_match:
            ip = web_exploit_match.group("ip")
            uri = web_exploit_match.group("uri")
            observations.append(
                Observation(
                    "public_app_exploit",
                    timestamp,
                    f"Public PACS application accepted a suspicious upload from {ip}",
                    line,
                    [
                        EntityObservation(
                            "Endpoint",
                            ip,
                            "source",
                            {
                                "ioc": True,
                                "role": "source",
                                "address": ip,
                            },
                        ),
                        EntityObservation(
                            "Service",
                            "pacs-web",
                            "target",
                            {"uri": uri},
                        ),
                    ],
                    TECHNIQUES["public_app_exploit"],
                    confidence=0.95,
                )
            )

        web_shell_match = re.search(
            rf"webshell\s+executed\s+path=(?P<path>/\S+)\s+"
            r"actor=(?P<actor>[a-z_][\w-]*)\s+command=(?P<command>\S+)"
            rf"(?:\s+source=(?P<ip>{IP_RE}))?",
            text,
            re.IGNORECASE,
        )
        if web_shell_match:
            path = web_shell_match.group("path").rstrip(".,")
            actor = web_shell_match.group("actor")
            entities = [
                EntityObservation("Account", actor, "actor"),
                EntityObservation("File", path, "artifact", {"ioc": True}),
                EntityObservation(
                    "Process",
                    web_shell_match.group("command"),
                    "target",
                ),
            ]
            if web_shell_match.group("ip"):
                ip = web_shell_match.group("ip")
                entities.append(
                    EntityObservation(
                        "Endpoint",
                        ip,
                        "source",
                        {
                            "ioc": True,
                            "role": "source",
                            "address": ip,
                        },
                    )
                )
            observations.append(
                Observation(
                    "web_shell",
                    timestamp,
                    f"Webshell {path} executed as {actor}",
                    line,
                    entities,
                    TECHNIQUES["web_shell"],
                    confidence=0.98,
                )
            )

        sudo_abuse_match = re.search(
            r"sudo\s+abuse\s+actor=(?P<actor>[a-z_][\w-]*)\s+"
            r"binary=(?P<binary>/\S+)\s+elevated_to=(?P<target>[a-z_][\w-]*)",
            text,
            re.IGNORECASE,
        )
        if sudo_abuse_match:
            actor = sudo_abuse_match.group("actor")
            target = sudo_abuse_match.group("target")
            binary = sudo_abuse_match.group("binary").rstrip(".,")
            rule_match = re.search(r"\brule=(?P<rule>/\S+)", text)
            entities = [
                EntityObservation("Account", actor, "actor"),
                EntityObservation("Account", target, "target"),
                EntityObservation("File", binary, "artifact", {"ioc": True}),
            ]
            if rule_match:
                entities.append(
                    EntityObservation(
                        "File",
                        rule_match.group("rule").rstrip(".,"),
                        "configuration",
                        {"ioc": True},
                    )
                )
            observations.append(
                Observation(
                    "sudo_abuse",
                    timestamp,
                    f"{actor} abused {binary} to execute as {target}",
                    line,
                    entities,
                    TECHNIQUES["sudo_abuse"],
                    confidence=0.98,
                )
            )

        cron_match = re.search(
            r"cron\s+persistence\s+created\s+path=(?P<path>/etc/cron\.d/\S+)"
            r"(?:\s+actor=(?P<actor>[a-z_][\w-]*))?"
            r"(?:\s+command=(?P<command>/\S+))?",
            text,
            re.IGNORECASE,
        )
        if cron_match:
            path = cron_match.group("path").rstrip(".,")
            entities = [
                EntityObservation("File", path, "target", {"ioc": True}),
            ]
            if cron_match.group("actor"):
                entities.append(
                    EntityObservation(
                        "Account",
                        cron_match.group("actor"),
                        "actor",
                    )
                )
            if cron_match.group("command"):
                entities.append(
                    EntityObservation(
                        "File",
                        cron_match.group("command").rstrip(".,"),
                        "artifact",
                        {"ioc": True},
                    )
                )
            observations.append(
                Observation(
                    "scheduled_task",
                    timestamp,
                    f"Cron persistence was installed at {path}",
                    line,
                    entities,
                    TECHNIQUES["scheduled_task"],
                    confidence=0.98,
                )
            )

        sudo_match = re.search(
            r"usermod\s+-aG\s+sudo\s+(?P<account>[a-z_][\w-]*)",
            text,
            re.IGNORECASE,
        )
        if sudo_match:
            account = sudo_match.group("account")
            observations.append(
                Observation(
                    "privilege_change",
                    timestamp,
                    f"{account} was added to the sudo group",
                    line,
                    [
                        EntityObservation("Account", account, "actor", {"ioc": True}),
                        EntityObservation("Group", "sudo", "target"),
                    ],
                )
            )

        service_match = re.search(
            r"(?:wrote|created|name=)[\" ]*"
            r"(?P<path>/etc/systemd/system/(?P<service>[\w@.-]+\.service))",
            text,
            re.IGNORECASE,
        )
        if service_match:
            service = service_match.group("service")
            actor_match = re.search(r"actor=(?P<actor>[a-z_][\w-]*)", text)
            entities = [
                EntityObservation("Service", service, "target", {"ioc": True}),
                EntityObservation(
                    "File",
                    service_match.group("path"),
                    "artifact",
                    {"ioc": True},
                ),
            ]
            if actor_match:
                entities.append(
                    EntityObservation(
                        "Account",
                        actor_match.group("actor"),
                        "actor",
                        {"ioc": True},
                    )
                )
            observations.append(
                Observation(
                    "service_created",
                    timestamp,
                    f"Systemd persistence service {service} was created",
                    line,
                    entities,
                    TECHNIQUES["service_created"],
                )
            )

        access_match = re.search(
            r"(?P<process>[\w.-]+)\s+(?:read|opened?)\s+"
            r"(?P<path>/\S*(?:secret|token|credential)\S*)",
            text,
            re.IGNORECASE,
        )
        if access_match:
            process = access_match.group("process")
            path = access_match.group("path").rstrip(".,")
            observations.append(
                Observation(
                    "credential_access",
                    timestamp,
                    f"{process} read sensitive file {path}",
                    line,
                    [
                        EntityObservation("Service", process, "actor"),
                        EntityObservation("File", path, "target"),
                    ],
                    TECHNIQUES["credential_access"],
                )
            )

        archive_match = re.search(
            r"(?:(?P<process>[\w.-]+)\s+)?(?:tar\s+)?(?:wrote|created)\s+"
            r"(?P<path>/\S+\.(?:tar|tgz|zip|gz))",
            text,
            re.IGNORECASE,
        )
        if archive_match:
            path = archive_match.group("path").rstrip(".,")
            process = archive_match.group("process") or "unknown-process"
            observations.append(
                Observation(
                    "data_staged",
                    timestamp,
                    f"{process} staged data in {path}",
                    line,
                    [
                        EntityObservation("Service", process, "actor"),
                        EntityObservation("File", path, "target", {"ioc": True}),
                    ],
                    TECHNIQUES["data_staged"],
                )
            )

        exfil_match = re.search(
            rf"(?P<result>blocked|denied|failed|completed|allowed).*?"
            rf"(?:to|destination=)\s*(?P<ip>{IP_RE})(?::(?P<port>\d+))?",
            text,
            re.IGNORECASE,
        )
        if exfil_match:
            ip = exfil_match.group("ip")
            port = exfil_match.group("port") or "unknown"
            endpoint = f"{ip}:{port}"
            process_match = re.search(r"(?:from|process=)\s*(?P<process>/\S+|[\w.-]+)", text)
            process = process_match.group("process") if process_match else "curl"
            result = exfil_match.group("result").lower()
            outcome = "completed" if result in {"completed", "allowed"} else "was blocked"
            observations.append(
                Observation(
                    "exfiltration_attempt",
                    timestamp,
                    f"Outbound transfer to {endpoint} {outcome}",
                    line,
                    [
                        EntityObservation("Process", process, "actor"),
                        EntityObservation(
                            "Endpoint",
                            endpoint,
                            "target",
                            {
                                "ioc": True,
                                "role": "destination",
                                "address": ip,
                                "port": port,
                                "outcome": result,
                            },
                        ),
                    ],
                    TECHNIQUES["exfiltration_attempt"],
                )
            )

        service_stop_match = re.search(
            r"systemctl\s+stop\s+(?P<service>[\w@.-]+)",
            text,
            re.IGNORECASE,
        )
        if service_stop_match:
            service = service_stop_match.group("service").removesuffix(".service")
            actor_match = re.search(r"actor=(?P<actor>[a-z_][\w-]*)", text)
            # The stopped unit is a legitimate service, so it is not an IOC itself;
            # the signal is that the actor halted it moments before encryption.
            entities = [EntityObservation("Service", service, "target")]
            if actor_match:
                entities.append(
                    EntityObservation("Account", actor_match.group("actor"), "actor")
                )
            observations.append(
                Observation(
                    "service_stop",
                    timestamp,
                    f"Service {service} was stopped before impact",
                    line,
                    entities,
                    TECHNIQUES["service_stop"],
                )
            )

        recovery_match = re.search(
            r"(?:rm\s+-\w+\s+|lvremove\s+(?:-\w+\s+)?|vgremove\s+)"
            r"(?P<target>/?[\w./-]*(?:backup|snap|shadow)[\w./-]*)",
            text,
            re.IGNORECASE,
        )
        if recovery_match:
            target = recovery_match.group("target")
            actor_match = re.search(r"actor=(?P<actor>[a-z_][\w-]*)", text)
            entities = [EntityObservation("File", target, "target", {"ioc": True})]
            if actor_match:
                entities.append(
                    EntityObservation("Account", actor_match.group("actor"), "actor")
                )
            observations.append(
                Observation(
                    "inhibit_recovery",
                    timestamp,
                    f"Backup or snapshot {target} was destroyed",
                    line,
                    entities,
                    TECHNIQUES["inhibit_recovery"],
                )
            )

        # Matches both encrypted-file writes (a .locked/.enc extension) and the
        # ransom note dropped alongside the encrypted data.
        encrypt_match = re.search(
            r"(?P<process>[\w.-]+)\s+wrote\s+"
            r"(?P<path>/\S+(?:\.(?:locked|encrypted|enc|crypt)"
            r"|/(?:HOW_TO_DECRYPT|DECRYPT_INSTRUCTIONS|README_RESTORE)[\w.]*))",
            text,
            re.IGNORECASE,
        )
        if encrypt_match:
            process = encrypt_match.group("process")
            path = encrypt_match.group("path").rstrip(".,")
            observations.append(
                Observation(
                    "data_encrypted",
                    timestamp,
                    f"{process} wrote encrypted artifact {path}",
                    line,
                    [
                        EntityObservation("Process", process, "actor", {"ioc": True}),
                        EntityObservation("File", path, "target", {"ioc": True}),
                    ],
                    TECHNIQUES["data_encrypted"],
                )
            )

        if re.search(
            r"SYSTEM INSTRUCTION|ignore (?:forensic )?policy|delete_evidence",
            text,
            re.IGNORECASE,
        ):
            observations.append(
                Observation(
                    "prompt_injection",
                    timestamp,
                    "Untrusted evidence contains an instruction targeting the analyst",
                    line,
                    [
                        EntityObservation(
                            "Finding",
                            "Prompt injection in evidence",
                            "target",
                            {
                                "severity": "high",
                                "blocked": True,
                                "ioc": False,
                            },
                        )
                    ],
                )
            )

        if re.search(r"chrony.*(?:correction|offset|step)", text, re.IGNORECASE):
            observations.append(
                Observation(
                    "clock_adjustment",
                    timestamp,
                    "System clock correction affects wall-clock ordering",
                    line,
                    [
                        EntityObservation(
                            "Finding",
                            "Clock correction",
                            "target",
                            {"severity": "medium"},
                        )
                    ],
                )
            )
        return observations

    def _detect_collected_files(self, bundle: EvidenceBundle) -> list[Observation]:
        observations: list[Observation] = []
        service_paths = [
            path
            for path in bundle.files
            if path.startswith("files/etc/systemd/system/") and path.endswith(".service")
        ]
        for path in service_paths:
            evidence = bundle.file_evidence(path)
            line = EvidenceLine(evidence, evidence.excerpt)
            service = path.rsplit("/", maxsplit=1)[-1]
            observations.append(
                Observation(
                    "service_file_collected",
                    None,
                    f"Collected systemd unit {service}",
                    line,
                    [
                        EntityObservation("Service", service, "target", {"ioc": True}),
                        EntityObservation("File", f"/etc/systemd/system/{service}", "artifact"),
                    ],
                    confidence=1.0,
                )
            )
        executable_paths = [
            path for path in bundle.files if path.startswith("files/usr/local/bin/")
        ]
        for path in executable_paths:
            evidence = bundle.file_evidence(path)
            line = EvidenceLine(evidence, evidence.excerpt)
            absolute_path = path.removeprefix("files")
            observations.append(
                Observation(
                    "suspicious_file_collected",
                    None,
                    f"Collected locally installed executable {absolute_path}",
                    line,
                    [
                        EntityObservation(
                            "File",
                            absolute_path,
                            "target",
                            {"ioc": True},
                        )
                    ],
                    confidence=1.0,
                )
            )
        return observations

    def _build_graph(
        self,
        bundle: EvidenceBundle,
        observations: list[Observation],
    ) -> IncidentGraph:
        builder = GraphBuilder(bundle.case_id)
        host_label = str(bundle.manifest.get("hostname") or "hospital-linux-server")
        host = builder.add_node(
            "Host",
            host_label,
            properties={"case_id": bundle.case_id},
        )
        attack_events = []
        event_entities: dict[str, dict[str, Any]] = {}
        for sequence, observation in enumerate(observations, start=1):
            evidence_ids = sorted(
                {line.ref.id for line in observation.evidence_lines}
            )
            for evidence_line in observation.evidence_lines:
                builder.add_evidence(evidence_line.ref)
            event = builder.add_node(
                "Event",
                observation.summary,
                node_id=stable_id(
                    "event",
                    observation.event_type,
                    observation.timestamp or "unknown-time",
                    observation.summary,
                ),
                properties={
                    "event_type": observation.event_type,
                    "timestamp": observation.timestamp,
                    "sequence": sequence,
                    "confidence": observation.confidence,
                    "summary": observation.summary,
                },
                evidence_ids=evidence_ids,
            )
            builder.add_edge(
                event,
                host,
                "OBSERVED_ON",
                confidence=observation.confidence,
                evidence_ids=evidence_ids,
            )
            roles: dict[str, Any] = {}
            for entity_observation in observation.entities:
                entity = builder.add_node(
                    entity_observation.type,
                    entity_observation.label,
                    properties=entity_observation.properties,
                    evidence_ids=evidence_ids,
                )
                roles[entity_observation.role] = entity
                builder.add_edge(
                    event,
                    entity,
                    entity_observation.role.upper(),
                    confidence=observation.confidence,
                    evidence_ids=evidence_ids,
                )
            event_entities[event.id] = roles
            if observation.technique:
                technique_id, name = observation.technique
                technique = builder.add_node(
                    "Technique",
                    technique_id,
                    properties={"technique_id": technique_id, "name": name},
                    evidence_ids=evidence_ids,
                    node_id=f"technique:{technique_id}",
                )
                builder.add_edge(
                    event,
                    technique,
                    "MAPS_TO",
                    status="derived",
                    confidence=0.95,
                    evidence_ids=[observation.evidence.ref.id],
                )
            if observation.event_type not in {
                "prompt_injection",
                "clock_adjustment",
                "service_file_collected",
                "suspicious_file_collected",
            }:
                attack_events.append(event)

        for previous, current in pairwise(attack_events):
            builder.add_edge(
                previous,
                current,
                "FOLLOWED_BY",
                status="derived",
                confidence=0.9,
                evidence_ids=sorted(set(previous.evidence_ids + current.evidence_ids)),
            )

        self._add_entity_relations(builder, observations, attack_events, event_entities)
        warnings = []
        if not observations:
            warnings.append("No supported forensic observations were detected")
        if bundle.integrity.get("status") != "verified":
            warnings.append(f"Evidence integrity is {bundle.integrity.get('status', 'unknown')}")
        return builder.build(integrity=bundle.integrity, warnings=warnings)

    @staticmethod
    def _add_entity_relations(
        builder: GraphBuilder,
        observations: list[Observation],
        attack_events: list[Any],
        event_entities: dict[str, dict[str, Any]],
    ) -> None:
        for observation, event in zip(
            [
                item
                for item in observations
                if item.event_type
                not in {
                    "prompt_injection",
                    "clock_adjustment",
                    "service_file_collected",
                    "suspicious_file_collected",
                }
            ],
            attack_events,
            strict=True,
        ):
            roles = event_entities[event.id]
            evidence_ids = event.evidence_ids
            relation: tuple[str, str, str] | None = None
            if observation.event_type == "authentication":
                relation = ("source", "target", "AUTHENTICATED_AS")
            elif observation.event_type == "public_app_exploit":
                relation = ("source", "target", "EXPLOITED")
            elif observation.event_type == "web_shell":
                relation = ("actor", "artifact", "EXECUTED")
            elif observation.event_type == "sudo_abuse":
                relation = ("actor", "target", "ELEVATED_TO")
            elif observation.event_type == "scheduled_task" and "actor" in roles:
                relation = ("actor", "target", "CREATED")
            elif observation.event_type == "privilege_change":
                relation = ("actor", "target", "MEMBER_OF")
            elif observation.event_type == "ssh_key_added":
                relation = ("target", "artifact", "USES_KEY_FILE")
            elif observation.event_type == "service_created" and "actor" in roles:
                relation = ("actor", "target", "CREATED")
            elif observation.event_type == "credential_access":
                relation = ("actor", "target", "ACCESSED")
            elif observation.event_type == "data_staged":
                relation = ("actor", "target", "CREATED")
            elif observation.event_type == "exfiltration_attempt":
                relation = ("actor", "target", "CONNECTED_TO")
            elif observation.event_type == "service_stop" and "actor" in roles:
                relation = ("actor", "target", "STOPPED")
            elif observation.event_type == "inhibit_recovery" and "actor" in roles:
                relation = ("actor", "target", "DELETED")
            elif observation.event_type == "data_encrypted":
                relation = ("actor", "target", "ENCRYPTED")
            if relation and relation[0] in roles and relation[1] in roles:
                builder.add_edge(
                    roles[relation[0]],
                    roles[relation[1]],
                    relation[2],
                    confidence=observation.confidence,
                    evidence_ids=evidence_ids,
                )


def build_deterministic_report(graph: IncidentGraph) -> DeterministicReport:
    events = sorted(
        graph.nodes_of_type("Event"),
        key=lambda item: item.properties.get("sequence", 0),
    )
    attack_events = [
        node
        for node in events
        if node.properties.get("event_type")
        not in {
            "prompt_injection",
            "clock_adjustment",
            "service_file_collected",
            "suspicious_file_collected",
        }
    ]
    techniques = [
        {
            "technique_id": node.properties.get("technique_id"),
            "name": node.properties.get("name"),
            "evidence_ids": node.evidence_ids,
            "confidence": 0.95,
        }
        for node in graph.nodes_of_type("Technique")
    ]
    iocs = [
        {
            "id": node.id,
            "type": node.type,
            "value": node.label,
            "evidence_ids": node.evidence_ids,
        }
        for node in graph.nodes
        if node.properties.get("ioc") is True
    ]
    policy_events = [
        node for node in events if node.properties.get("event_type") == "prompt_injection"
    ]
    evidence_ids = sorted(
        {evidence_id for event in attack_events for evidence_id in event.evidence_ids}
    )
    remediation = [
        RemediationAction(
            phase="containment",
            action="Keep the affected host isolated from routed networks",
            rationale="Limit further command-and-control or exfiltration attempts",
            modifies_system=False,
            requires_human_approval=False,
            evidence_ids=evidence_ids,
        ),
        RemediationAction(
            phase="evidence_preservation",
            action="Create a forensic disk snapshot and preserve the evidence archive",
            rationale="Preserve state before any modifying remediation",
            modifies_system=False,
            requires_human_approval=False,
            evidence_ids=evidence_ids,
        ),
        RemediationAction(
            phase="eradication",
            action="Disable the unauthorized account, key, and persistence service",
            rationale="Remove directly observed access and persistence mechanisms",
            modifies_system=True,
            requires_human_approval=True,
            evidence_ids=evidence_ids,
        ),
        RemediationAction(
            phase="recovery",
            action="Reimage or restore the server from a verified known-good source",
            rationale="Observed privileged persistence makes in-place trust recovery uncertain",
            modifies_system=True,
            requires_human_approval=True,
            evidence_ids=evidence_ids,
        ),
        RemediationAction(
            phase="validation",
            action="Rotate exposed credentials and monitor authentication and egress",
            rationale="Validate that access and exfiltration indicators do not recur",
            modifies_system=True,
            requires_human_approval=True,
            evidence_ids=evidence_ids,
        ),
    ]
    unknowns = [
        "The origin and owner of the unauthorized SSH key are not proven",
        "A blocked outbound connection does not prove successful exfiltration",
        "The collected evidence does not prove whether other hosts were affected",
    ]
    confidence = (
        sum(float(node.properties.get("confidence", 0)) for node in attack_events)
        / len(attack_events)
        if attack_events
        else 0
    )
    return DeterministicReport(
        case_id=graph.case_id,
        confidence=confidence,
        timeline=[
            {
                "event_id": node.id,
                "timestamp": node.properties.get("timestamp"),
                "event_type": node.properties.get("event_type"),
                "summary": node.properties.get("summary"),
                "evidence_ids": node.evidence_ids,
                "confidence": node.properties.get("confidence"),
            }
            for node in events
        ],
        attack_path=[
            {
                "step": index,
                "event_id": node.id,
                "summary": node.properties.get("summary"),
                "evidence_ids": node.evidence_ids,
            }
            for index, node in enumerate(attack_events, start=1)
        ],
        techniques=techniques,
        iocs=iocs,
        policy_alerts=[
            {
                "event_id": node.id,
                "type": "prompt_injection",
                "decision": "blocked_as_untrusted_evidence",
                "evidence_ids": node.evidence_ids,
            }
            for node in policy_events
        ],
        unknowns=unknowns,
        remediation=remediation,
        warnings=graph.warnings,
    )
