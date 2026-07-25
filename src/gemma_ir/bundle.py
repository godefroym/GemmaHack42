from __future__ import annotations

import hashlib
import json
import tarfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

import zstandard

from gemma_ir.models import EvidenceRef

MAX_EVIDENCE_FILE_BYTES = 50 * 1024 * 1024


@dataclass(frozen=True)
class EvidenceLine:
    ref: EvidenceRef
    text: str


class EvidenceBundle:
    def __init__(self, files: dict[str, bytes], source: str) -> None:
        self.files = self._strip_common_root(files)
        self.source = source
        self.file_hashes = {
            path: hashlib.sha256(content).hexdigest() for path, content in self.files.items()
        }
        self.manifest = self._load_manifest()
        self.case_id = str(self.manifest.get("case_id") or "unknown-case")
        self.integrity = self._verify_manifest_hashes()

    @classmethod
    def load(cls, path: Path) -> EvidenceBundle:
        resolved = path.expanduser().resolve()
        if resolved.is_dir():
            files = {
                item.relative_to(resolved).as_posix(): item.read_bytes()
                for item in sorted(resolved.rglob("*"))
                if item.is_file()
            }
            return cls(files, str(resolved))
        if resolved.name.endswith((".tar.zst", ".tzst")):
            return cls(cls._read_tar_zst(resolved), str(resolved))
        if resolved.suffix == ".tar":
            with tarfile.open(resolved, "r:") as archive:
                return cls(cls._read_tar_members(archive), str(resolved))
        raise ValueError(f"Unsupported evidence input: {resolved}")

    @staticmethod
    def _safe_member_name(name: str) -> str:
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError(f"Unsafe archive member: {name}")
        rendered = path.as_posix()
        while rendered.startswith("./"):
            rendered = rendered[2:]
        return rendered

    @classmethod
    def _read_tar_members(cls, archive: tarfile.TarFile) -> dict[str, bytes]:
        files: dict[str, bytes] = {}
        for member in archive:
            if not member.isfile():
                continue
            if member.size > MAX_EVIDENCE_FILE_BYTES:
                raise ValueError(f"Evidence member is too large: {member.name}")
            name = cls._safe_member_name(member.name)
            name_parts = PurePosixPath(name).parts
            if "__MACOSX" in name_parts or any(part.startswith("._") for part in name_parts):
                continue
            extracted = archive.extractfile(member)
            if extracted is not None:
                files[name] = extracted.read()
        return files

    @classmethod
    def _read_tar_zst(cls, path: Path) -> dict[str, bytes]:
        decompressor = zstandard.ZstdDecompressor()
        with (
            path.open("rb") as compressed,
            decompressor.stream_reader(compressed) as reader,
            tarfile.open(fileobj=reader, mode="r|") as archive,
        ):
            return cls._read_tar_members(archive)

    @staticmethod
    def _strip_common_root(files: dict[str, bytes]) -> dict[str, bytes]:
        if not files:
            raise ValueError("Evidence bundle is empty")
        parts = [PurePosixPath(path).parts for path in files]
        first_components = {item[0] for item in parts if item}
        has_root_manifest = "manifest.json" in files
        if len(first_components) == 1 and not has_root_manifest:
            return {
                PurePosixPath(*path_parts[1:]).as_posix(): files[path]
                for path, path_parts in zip(files, parts, strict=True)
                if len(path_parts) > 1
            }
        return files

    def _load_manifest(self) -> dict[str, object]:
        content = self.files.get("manifest.json")
        if content is None:
            return {}
        try:
            loaded = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid evidence manifest: {exc}") from exc
        if not isinstance(loaded, dict):
            raise TypeError("Evidence manifest must be a JSON object")
        return loaded

    def _verify_manifest_hashes(self) -> dict[str, object]:
        sums = self.files.get("SHA256SUMS")
        if sums is None:
            return {
                "status": "unverified",
                "checked": 0,
                "failed": [],
                "reason": "SHA256SUMS is missing",
            }
        checked = 0
        failed: list[str] = []
        for raw_line in sums.decode("utf-8", errors="replace").splitlines():
            if not raw_line.strip():
                continue
            expected, raw_path = raw_line.split(maxsplit=1)
            relative_path = raw_path.strip().lstrip("*").removeprefix("./")
            checked += 1
            if self.file_hashes.get(relative_path) != expected:
                failed.append(relative_path)
        return {
            "status": "verified" if not failed else "failed",
            "checked": checked,
            "failed": failed,
        }

    def text(self, path: str) -> str:
        return self.files[path].decode("utf-8", errors="replace")

    def iter_lines(self, prefix: str | None = None) -> Iterator[EvidenceLine]:
        for path in sorted(self.files):
            if prefix is not None and not path.startswith(prefix):
                continue
            if path in {"manifest.json", "SHA256SUMS"}:
                continue
            content = self.text(path)
            for line_number, text in enumerate(content.splitlines(), start=1):
                if not text.strip():
                    continue
                evidence_digest = hashlib.sha256(
                    f"{path}:{line_number}:{text}".encode()
                ).hexdigest()
                ref = EvidenceRef(
                    id=f"EV-{evidence_digest[:12].upper()}",
                    source_path=path,
                    line_number=line_number,
                    sha256=self.file_hashes[path],
                    excerpt=text[:500],
                )
                yield EvidenceLine(ref=ref, text=text)

    def file_evidence(self, path: str) -> EvidenceRef:
        digest = hashlib.sha256(f"{path}:file".encode()).hexdigest()
        return EvidenceRef(
            id=f"EV-{digest[:12].upper()}",
            source_path=path,
            line_number=0,
            sha256=self.file_hashes[path],
            excerpt=f"Collected file: {path}",
        )
