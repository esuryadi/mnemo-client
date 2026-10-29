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

"""Tests for MnemoSettingsClient."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from mnemo_client import MnemoSettingsClient, SettingsResponse

from fake_server import FakeServerTestCase

SETTINGS = """{"accountId":"acct-1","provider":"anthropic","model":"m","ingestModel":"i","hasApiKey":true,
    "lookbackDays":30,"encryptData":true,"sharedMemoryTtlHours":24,"updatedAt":"2026-10-01T00:00:00Z"}"""


class MnemoSettingsClientTest(FakeServerTestCase):

    def builder(self) -> MnemoSettingsClient.Builder:
        return MnemoSettingsClient.Builder().api_key("tok-1").base_url(self.server.url())

    def test_get_settings_is_the_default_operation(self) -> None:
        self.server.reply(200, SETTINGS)
        s = self.builder().account_id("acct-1").build().execute()
        self.assertIsInstance(s, SettingsResponse)
        self.assertEqual(30, s.lookback_days)
        self.assertTrue(s.has_api_key)
        self.assertEqual(datetime(2026, 10, 1, tzinfo=timezone.utc), s.updated_at)
        self.assertEqual("GET", self.server.last().method)
        self.assertEqual("/mnemo/account/acct-1/settings", self.server.last().path)

    def test_update_sends_only_the_settings_that_were_set(self) -> None:
        self.server.reply(200, SETTINGS)
        self.builder().account_id("acct-1").operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS) \
            .lookback_days(30).encrypt_data(False).provider_api_key("sk-own").build().execute()
        self.assertEqual("PUT", self.server.last().method)
        self.assertEqual({"apiKey": "sk-own", "lookbackDays": 30, "encryptData": False},
                         json.loads(self.server.last().body))

    def test_options_do_not_need_an_account(self) -> None:
        self.server.reply(200, '{"providers":["anthropic"]}')
        options = self.builder().operation(MnemoSettingsClient.Operation.GET_OPTIONS).build().execute()
        self.assertIn("providers", options)
        self.assertEqual("/mnemo/account/settings/options", self.server.last().path)

    def test_account_id_is_required(self) -> None:
        self.rejection(lambda: self.builder().build().execute())
        self.assertEqual(0, self.server.count())
