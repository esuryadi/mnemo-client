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


"""Tests for authenticating with an embed token instead of an API key or OAuth client."""

from __future__ import annotations

from mnemo_client import MnemoChatClient, MnemoError

from fake_server import FakeServerTestCase

Code = MnemoError.Code


class EmbedTokenAuthTest(FakeServerTestCase):

    def builder(self) -> MnemoChatClient.Builder:
        return MnemoChatClient.Builder().base_url(self.server.url()).tenant_id("acme").session_id("embed-anon-1") \
            .operation(MnemoChatClient.Operation.GET_HISTORY)

    def assert_refused(self, builder: MnemoChatClient.Builder, mentions: str) -> None:
        e = self.rejection(builder.build().execute)
        self.assertIs(Code.INVALID_REQUEST, e.error.code)
        self.assertIn(mentions, str(e))
        self.assertEqual(0, self.server.count())

    def test_sends_the_embed_token_as_the_api_token_header(self) -> None:
        self.server.reply(200, "{}")
        self.builder().embed_token("mnemo_embed_abc").build().execute()
        r = self.server.last()
        self.assertEqual("/mnemo/sessions/embed-anon-1/history", r.path)
        self.assertEqual("mnemo_embed_abc", r.token)
        self.assertIsNone(r.authorization)

    def test_is_mutually_exclusive_with_the_api_key(self) -> None:
        self.assert_refused(self.builder().embed_token("mnemo_embed_abc").api_key("k"), "api_key or embed_token")

    def test_is_mutually_exclusive_with_client_credentials(self) -> None:
        self.assert_refused(self.builder().embed_token("mnemo_embed_abc").client_credentials("id", "secret"),
                            "client_credentials or embed_token")

    def test_a_blank_embed_token_is_the_same_as_no_credential(self) -> None:
        e = self.rejection(self.builder().embed_token(" ").build().execute)
        self.assertIs(Code.MISSING_API_KEY, e.error.code)
        self.assertEqual(0, self.server.count())

    def test_a_rejected_embed_token_is_not_retried(self) -> None:
        self.server.reply(401, '{"error":"expired"}')
        e = self.rejection(self.builder().embed_token("mnemo_embed_abc").build().execute)
        self.assertEqual(401, e.http_status)
        self.assertEqual(1, self.server.count())
