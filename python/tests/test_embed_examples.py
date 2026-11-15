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


"""The examples under python/examples import without Flask or Django and work, so the documentation built on
them cannot rot."""

from __future__ import annotations

import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "examples"))

import django_example  # noqa: E402
import flask_example  # noqa: E402
import http_server_example  # noqa: E402

from fake_server import FakeServerTestCase  # noqa: E402
from test_embed import MINTED  # noqa: E402


class EmbedExamplesTest(FakeServerTestCase):

    def environment(self) -> "mock._patch_dict":
        return mock.patch.dict(os.environ, {"MNEMO_API_KEY": "k", "MNEMO_TENANT_ID": "acme",
                                            "MNEMO_ALLOWED_ORIGIN": "https://app.example.com",
                                            "MNEMO_BASE_URL": self.server.url()})

    def test_the_flask_view_returns_the_token_json_and_the_page(self) -> None:
        self.server.reply(200, MINTED)
        with self.environment():
            body, status, headers = flask_example.embed_token("user-42")
            self.assertEqual(200, status)
            self.assertEqual("application/json", headers["Content-Type"])
            self.assertEqual({"token", "expiresAt", "tenantId", "sessionPrefix"}, set(json.loads(body)))
            self.assertEqual("user-42", json.loads(self.server.last().body)["endUserId"])

            self.assertEqual(401, flask_example.embed_token(None)[1])
            self.assertEqual(1, self.server.count())
        self.assertIn('<mnemo-chat token-url="/mnemo/embed-token" width="50%" height="600"></mnemo-chat>',
                      flask_example.chat_page())

    def test_the_django_view_returns_the_token_json_and_the_page(self) -> None:
        self.server.reply(200, MINTED)
        with self.environment():
            status, content_type, body = django_example.embed_token("user-42")
            self.assertEqual((200, "application/json"), (status, content_type))
            self.assertEqual({"token", "expiresAt", "tenantId", "sessionPrefix"}, set(json.loads(body)))

            self.assertEqual(401, django_example.embed_token(None)[0])
            self.assertEqual(1, self.server.count())
        self.assertIn('<mnemo-chat token-url="/mnemo/embed-token" width="50%" height="600"></mnemo-chat>',
                      django_example.chat_page())

    def test_a_refused_mint_becomes_a_502_not_a_leak(self) -> None:
        self.server.reply(403, '{"error":"not an ADMIN token"}')
        with self.environment():
            body, status, _ = flask_example.embed_token("user-42")
        self.assertEqual(502, status)
        self.assertNotIn("ADMIN", body)

    def test_the_http_server_serves_the_page_and_the_token(self) -> None:
        self.server.reply(200, MINTED)
        example = http_server_example.make_server(0, "k", self.server.url(), "acme", "https://app.example.com")
        thread = threading.Thread(target=example.serve_forever, args=(0.01,), daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{example.server_address[1]}"
            with urllib.request.urlopen(base + "/chat") as page:
                self.assertEqual(200, page.status)
                self.assertIn('<mnemo-chat token-url="/mnemo/embed-token" height="600">', page.read().decode())

            with self.assertRaises(urllib.error.HTTPError) as signed_out:
                urllib.request.urlopen(base + "/mnemo/embed-token")
            self.assertEqual(401, signed_out.exception.code)
            signed_out.exception.close()
            self.assertEqual(0, self.server.count())

            request = urllib.request.Request(base + "/mnemo/embed-token", headers={"X-User": "user-42"})
            with urllib.request.urlopen(request) as token:
                self.assertEqual(200, token.status)
                self.assertEqual({"token", "expiresAt", "tenantId", "sessionPrefix"}, set(json.loads(token.read())))
        finally:
            example.shutdown()
            example.server_close()


if __name__ == "__main__":
    unittest.main()
