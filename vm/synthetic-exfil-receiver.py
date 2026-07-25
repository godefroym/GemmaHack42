#!/usr/bin/env python3
"""Receive one synthetic upload and emit external-style proxy telemetry."""

from __future__ import annotations

import argparse
import hashlib
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=9443)
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--destination", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    class UploadHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            length = int(self.headers.get("Content-Length", "0"))
            content = self.rfile.read(length)
            args.log.parent.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now(UTC).isoformat()
            digest = hashlib.sha256(content).hexdigest()
            args.log.write_text(
                (
                    f"{timestamp} proxy allowed completed bytes_out={length} "
                    f"source=hospital-linux-server destination={args.destination} "
                    f"process=curl path={self.path} sha256={digest}\n"
                ),
                encoding="utf-8",
            )
            self.send_response(201)
            self.end_headers()
            self.wfile.write(b"synthetic upload received\n")

        def log_message(self, format: str, *args: object) -> None:
            return

    server = HTTPServer((args.bind, args.port), UploadHandler)
    server.timeout = 30
    server.handle_request()


if __name__ == "__main__":
    main()
