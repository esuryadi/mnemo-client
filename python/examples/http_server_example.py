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


"""The whole integration on the standard library's ``http.server``: a page that embeds the component, and the token
endpoint it calls. The visitor id is read from an ``X-User`` header, standing in for your own login session; a real
endpoint must refuse a request that is not signed in.

Run it with ``MNEMO_API_KEY=... python3 http_server_example.py`` and open http://localhost:8080/chat.
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from mnemo_client import EmbedSnippet, EmbedTokenEndpoint, MnemoClientException, MnemoEmbedClient


def make_server(port: int, api_key: str, base_url: str, tenant_id: str, allowed_origin: str) -> HTTPServer:
    def template() -> MnemoEmbedClient.Builder:
        return MnemoEmbedClient.Builder().api_key(api_key).base_url(base_url).tenant_id(tenant_id) \
            .allowed_origin(allowed_origin)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 (the name http.server looks for)
            if self.path == "/chat":
                page = "<!doctype html><title>Chat</title>" + EmbedSnippet.render(
                    EmbedSnippet.Options(token_url="/mnemo/embed-token", height="600"))
                self._send(200, "text/html; charset=utf-8", page)
            elif self.path == "/mnemo/embed-token":
                user = self.headers.get("X-User")
                if user is None:
                    self._send(401, "application/json", json.dumps({"error": "sign in first"}))
                    return
                try:
                    self._send(200, "application/json", EmbedTokenEndpoint.handle(template, user))
                except MnemoClientException:
                    self._send(502, "application/json", json.dumps({"error": "could not get a chat token"}))
            else:
                self._send(404, "text/plain", "not found")

        def _send(self, status: int, content_type: str, body: str) -> None:
            data = body.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, format: str, *args: object) -> None:
            pass

    return HTTPServer(("127.0.0.1", port), Handler)


if __name__ == "__main__":
    server = make_server(8080, os.environ["MNEMO_API_KEY"], "https://mnemo-api.panaxon.ai/api", "acme",
                         "http://localhost:8080")
    print("open http://localhost:8080/chat")
    server.serve_forever()
