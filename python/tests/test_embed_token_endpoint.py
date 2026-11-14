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


"""Tests for EmbedTokenEndpoint."""

from __future__ import annotations

import json

from mnemo_client import EmbedTokenEndpoint, MnemoClientException, MnemoEmbedClient, MnemoError

from fake_server import FakeServerTestCase
from test_embed import MINTED


class EmbedTokenEndpointTest(FakeServerTestCase):

    def template(self) -> MnemoEmbedClient.Builder:
        return MnemoEmbedClient.Builder().api_key("secret-api-key").base_url(self.server.url()).tenant_id("acme") \
            .allowed_origin("https://app.example.com")

    def test_returns_only_token_expires_at_and_session_prefix(self) -> None:
        self.server.reply(200, MINTED)

        text = EmbedTokenEndpoint.handle(self.template(), "user-42")

        parsed = json.loads(text)
        self.assertEqual({"token", "expiresAt", "tenantId", "sessionPrefix"}, set(parsed))
        self.assertEqual("mnemo_embed_abc", parsed["token"])
        self.assertEqual("2026-11-14T18:00:00Z", parsed["expiresAt"])
        self.assertEqual("embed-0123456789abcdef-", parsed["sessionPrefix"])
        self.assertNotIn("secret-api-key", text)
        self.assertEqual("user-42", json.loads(self.server.last().body)["endUserId"])
        self.assertEqual("secret-api-key", self.server.last().token)

    def test_an_anonymous_visitor_sends_no_end_user_id(self) -> None:
        self.server.reply(200, MINTED)
        EmbedTokenEndpoint.handle(self.template, None)
        self.assertNotIn("endUserId", json.loads(self.server.last().body))

    def test_a_failure_is_raised_not_turned_into_json(self) -> None:
        self.server.reply(403, '{"error":"not an ADMIN token"}')
        e = self.rejection(lambda: EmbedTokenEndpoint.handle(self.template(), "u"))
        self.assertIs(MnemoError.Code.FORBIDDEN, e.error.code)

    def test_an_invalid_end_user_id_is_refused_before_sending(self) -> None:
        self.rejection(lambda: EmbedTokenEndpoint.handle(self.template(), "has space"))
        self.assertEqual(0, self.server.count())

    def test_the_template_is_required(self) -> None:
        with self.assertRaises(MnemoClientException):
            EmbedTokenEndpoint.handle(None, "u")  # type: ignore[arg-type]

    def test_escapes_json_special_characters_in_the_values(self) -> None:
        self.server.reply(200, '{"token":"a\\"b</script>","expiresAt":"2026-11-14T18:00:00Z",'
                               '"tenantId":"acme","sessionPrefix":"embed-x-"}')
        text = EmbedTokenEndpoint.handle(self.template(), "u")
        self.assertEqual('a"b</script>', json.loads(text)["token"])
        self.assertNotIn("</script>", text)
