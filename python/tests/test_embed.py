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


"""Tests for MnemoEmbedClient (minting an embed token)."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from mnemo_client import EmbedToken, MnemoClientFactory, MnemoEmbedClient, MnemoError

from fake_server import FakeServerTestCase

Code = MnemoError.Code
MINTED = ('{"token":"mnemo_embed_abc","expiresAt":"2026-11-14T18:00:00Z","tenantId":"acme",'
          '"sessionPrefix":"embed-0123456789abcdef-","extra":1}')


class MnemoEmbedClientTest(FakeServerTestCase):

    def builder(self) -> MnemoEmbedClient.Builder:
        return MnemoEmbedClient.Builder().api_key("tok-1").base_url(self.server.url()).tenant_id("acme") \
            .allowed_origin("https://app.example.com")

    def assert_refused(self, builder: MnemoEmbedClient.Builder, mentions: str) -> None:
        e = self.rejection(builder.build().execute)
        self.assertIs(Code.INVALID_REQUEST, e.error.code)
        self.assertIn(mentions, str(e))
        self.assertEqual(0, self.server.count())

    def test_mint_token_posts_the_body_and_returns_the_token(self) -> None:
        self.server.reply(200, MINTED)
        token = self.builder().end_user_id("user-42").ttl_seconds(600).build().execute()

        self.assertEqual(EmbedToken("mnemo_embed_abc", datetime(2026, 11, 14, 18, 0, tzinfo=timezone.utc), "acme",
                                    "embed-0123456789abcdef-"), token)
        r = self.server.last()
        self.assertEqual("POST", r.method)
        self.assertEqual("/mnemo/embed/token", r.path)
        self.assertEqual("tok-1", r.token)
        self.assertEqual({"tenantId": "acme", "allowedOrigin": "https://app.example.com", "endUserId": "user-42",
                          "ttlSeconds": 600}, json.loads(r.body))

    def test_optional_fields_are_omitted_when_not_set(self) -> None:
        self.server.reply(200, MINTED)
        self.builder().build().execute()
        self.assertEqual({"tenantId": "acme", "allowedOrigin": "https://app.example.com"},
                         json.loads(self.server.last().body))

    def test_localhost_origins_are_accepted(self) -> None:
        self.server.reply(200, MINTED)
        self.builder().allowed_origin("http://localhost:3000").build().execute()
        self.builder().allowed_origin("http://127.0.0.1").build().execute()
        self.builder().allowed_origin("https://app.example.com:8443").build().execute()
        self.assertEqual(3, self.server.count())

    def test_validates_before_sending(self) -> None:
        self.assert_refused(self.builder().tenant_id(None), "tenant_id")  # type: ignore[arg-type]
        self.assert_refused(self.builder().allowed_origin(None), "allowed_origin")  # type: ignore[arg-type]
        for origin in ["https://app.example.com/", "https://app.example.com/path", "*", "https://*.example.com",
                       "http://app.example.com", "app.example.com", "ftp://app.example.com", "https://",
                       "https://a.com,https://b.com", "https://app.example.com:abc"]:
            self.assert_refused(self.builder().allowed_origin(origin), "allowed_origin")
        self.assert_refused(self.builder().ttl_seconds(59), "ttl_seconds")
        self.assert_refused(self.builder().ttl_seconds(901), "ttl_seconds")
        self.assert_refused(self.builder().end_user_id(""), "end_user_id")
        self.assert_refused(self.builder().end_user_id("a b"), "end_user_id")
        self.assert_refused(self.builder().end_user_id("x" * 129), "end_user_id")

    def test_boundary_values_are_accepted(self) -> None:
        self.server.reply(200, MINTED)
        self.builder().ttl_seconds(60).end_user_id("x" * 128).build().execute()
        self.builder().ttl_seconds(900).end_user_id("a.b_c@d-e").build().execute()
        self.assertEqual(2, self.server.count())

    def test_an_embed_token_cannot_mint(self) -> None:
        self.assert_refused(MnemoEmbedClient.Builder().embed_token("mnemo_embed_x").base_url(self.server.url())
                            .tenant_id("acme").allowed_origin("https://app.example.com"), "cannot mint")

    def test_an_error_answer_carries_the_status_and_message(self) -> None:
        self.server.reply(403, '{"error":"not an ADMIN token"}')
        e = self.rejection(self.builder().build().execute)
        self.assertIs(Code.FORBIDDEN, e.error.code)
        self.assertEqual(403, e.http_status)
        self.assertEqual("not an ADMIN token", str(e))

    def test_a_reply_without_a_token_is_a_serialization_error(self) -> None:
        self.server.reply(200, '{"tenantId":"acme"}')
        e = self.rejection(self.builder().build().execute)
        self.assertIs(Code.SERIALIZATION_ERROR, e.error.code)

    def test_factory_builds_the_client(self) -> None:
        self.assertIsInstance(MnemoClientFactory.create(self.builder()), MnemoEmbedClient)
