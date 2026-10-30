# Copyright (c) 2026, PANAXON.AI, LLC. All rights reserved.
# DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Multi-Dimensional Neural Elastic Memory Organization (MNEMO) - Python client.
#
# Inventor: Edward Suryadi
# Assignee: PANAXON.AI, LLC
#
# Author: edward.suryadi
# Since: Oct-2026

"""A throwaway HTTP server on a random port that records every request and answers with a canned reply, so the
clients can be tested end to end through the real urllib stack without the MNEMO service."""

from __future__ import annotations

import socketserver
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable, Dict, List, NamedTuple, Optional, Tuple
from urllib.parse import unquote

from mnemo_client import MnemoClientException


class Received(NamedTuple):
    method: str
    path: str
    raw_path: str
    query: Optional[str]
    token: Optional[str]
    accept: Optional[str]
    body: str
    authorization: Optional[str] = None


class _QuickBindServer(ThreadingHTTPServer):
    def server_bind(self) -> None:
        # HTTPServer.server_bind resolves the host's FQDN, which can stall for seconds; the name is never used here
        socketserver.TCPServer.server_bind(self)
        self.server_name, self.server_port = self.server_address[:2]


class FakeMnemoServer:
    def __init__(self) -> None:
        self.requests: List[Received] = []
        self.status = 200
        self.reply_body = "{}"
        self.content_type = "application/json"
        self.routes: Dict[str, List[Tuple[int, str]]] = {}
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def handle_any(self) -> None:
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length).decode("utf-8") if length else ""
                raw_path, _, query = self.path.partition("?")
                fake.requests.append(Received(self.command, unquote(raw_path), raw_path, query or None,
                                              self.headers.get("X-Mnemo-Api-Token"), self.headers.get("Accept"),
                                              body, self.headers.get("Authorization")))
                queued = fake.routes.get(raw_path)
                status, reply = queued.pop(0) if queued and len(queued) > 1 else \
                    (queued[0] if queued else (fake.status, fake.reply_body))
                self.send_response(status)
                self.send_header("Content-Type", fake.content_type)
                if status == 204:
                    self.end_headers()
                    return
                data = reply.encode("utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = handle_any

            def log_message(self, format: str, *args: object) -> None:
                pass

        self._server = _QuickBindServer(("127.0.0.1", 0), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, args=(0.01,), daemon=True)
        self._thread.start()

    def reply(self, status: int, body: str, content_type: str = "application/json") -> FakeMnemoServer:
        self.status = status
        self.reply_body = body
        self.content_type = content_type
        return self

    def reply_on(self, path: str, *replies: Tuple[int, str]) -> FakeMnemoServer:
        """Answers requests to ``path`` with ``replies`` in turn; the last one repeats."""
        self.routes[path] = list(replies)
        return self

    def url(self) -> str:
        return f"http://127.0.0.1:{self._server.server_address[1]}"

    def last(self) -> Received:
        return self.requests[-1]

    def count(self) -> int:
        return len(self.requests)

    def close(self) -> None:
        self._server.shutdown()
        self._server.server_close()


class FakeServerTestCase(unittest.TestCase):
    """Starts a fresh :class:`FakeMnemoServer` for every test."""

    def setUp(self) -> None:
        self.server = FakeMnemoServer()

    def tearDown(self) -> None:
        self.server.close()

    def rejection(self, call: Callable[[], object]) -> MnemoClientException:
        """Runs ``call``, expecting it to raise a MnemoClientException, and returns that exception."""
        with self.assertRaises(MnemoClientException) as raised:
            call()
        return raised.exception
