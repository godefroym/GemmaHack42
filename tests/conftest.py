from __future__ import annotations

from pathlib import Path

import pytest

from gemma_ir.bundle import EvidenceBundle
from gemma_ir.deterministic import DeterministicAnalyzer
from gemma_ir.models import IncidentGraph

FIXTURE = Path("eval/fixtures/hospital-demo")


@pytest.fixture(scope="session")
def incident_graph() -> IncidentGraph:
    return DeterministicAnalyzer().analyze(EvidenceBundle.load(FIXTURE))
