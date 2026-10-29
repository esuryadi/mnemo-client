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

"""Tests for MnemoRAGClient."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from mnemo_client import MnemoError, MnemoRAGClient

from fake_server import FakeServerTestCase


class MnemoRAGClientTest(FakeServerTestCase):

    def builder(self) -> MnemoRAGClient.Builder:
        return MnemoRAGClient.Builder().api_key("tok-1").base_url(self.server.url())

    def test_query_posts_to_rag_id_and_parses_answer(self) -> None:
        self.server.reply(200, """{"answer":"30 days","found":true,"source":"policy.pdf","authority":"HIGH",
            "confidence":"HIGH","lastUpdated":"2026-09-01T10:15:30Z","retrievalTier":"TARGETED",
            "subjectsUsed":["Refunds"],"tokenUsage":{"inputTokens":50,"outputTokens":9}}""")

        r = self.builder().rag_id("support-kb").query("Refund window?") \
            .additional_context(["annual plans"]).build().execute()

        self.assertTrue(r.found)
        self.assertEqual("30 days", r.answer)
        self.assertEqual(datetime(2026, 9, 1, 10, 15, 30, tzinfo=timezone.utc), r.last_updated)
        self.assertEqual(["Refunds"], r.subjects_used)
        self.assertEqual(9, r.token_usage.output_tokens)
        req = self.server.last()
        self.assertEqual("POST", req.method)
        self.assertEqual("/mnemo/rag/support-kb", req.path)
        self.assertEqual("tok-1", req.token)
        self.assertEqual({"query": "Refund window?", "additionalContext": ["annual plans"]}, json.loads(req.body))

    def test_additional_context_is_omitted_when_not_set(self) -> None:
        self.server.reply(200, '{"answer":"x","found":false}')
        r = self.builder().rag_id("kb").query("q").build().execute()
        self.assertFalse(r.found)
        self.assertIsNone(r.last_updated)
        self.assertEqual({"query": "q"}, json.loads(self.server.last().body))

    def test_rag_id_and_query_are_required(self) -> None:
        self.assertIs(MnemoError.Code.INVALID_REQUEST,
                      self.rejection(lambda: self.builder().query("q").build().execute()).error.code)
        self.assertIs(MnemoError.Code.INVALID_REQUEST,
                      self.rejection(lambda: self.builder().rag_id("kb").build().execute()).error.code)
        self.assertEqual(0, self.server.count())

    def test_plan_gated_tenant_gets_forbidden(self) -> None:
        self.server.reply(403, '{"error":"MnemoRAG requires a Pro plan"}')
        e = self.rejection(lambda: self.builder().rag_id("kb").query("q").build().execute())
        self.assertIs(MnemoError.Code.FORBIDDEN, e.error.code)
        self.assertEqual("MnemoRAG requires a Pro plan", str(e))
