from __future__ import annotations

from pathlib import Path

import pytest

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.deterministic import DeterministicAnalyzer
from gemma_ir.models import IncidentGraph

FIXTURE = Path("eval/fixtures/hospital-demo")


@pytest.fixture(scope="session")
def evidence_bundle() -> EvidenceBundle:
    return EvidenceBundle.load(FIXTURE)


@pytest.fixture(scope="session")
def incident_graph(evidence_bundle: EvidenceBundle) -> IncidentGraph:
    return DeterministicAnalyzer().analyze(evidence_bundle)
