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

"""Every operation of every client, called with an API key and endpoint but no other parameter: each one that has
a required parameter must refuse with INVALID_REQUEST before any request is sent. Guards against a new operation
being added without its validation."""

from __future__ import annotations

from mnemo_client import MnemoChatClient, MnemoClient, MnemoError, MnemoNetworkClient, MnemoRAGClient, MnemoSettingsClient

from fake_server import FakeServerTestCase


class MnemoOperationValidationTest(FakeServerTestCase):

    def assert_refused_before_sending(self, what: str, client: MnemoClient) -> None:
        before = self.server.count()
        e = self.rejection(client.execute)
        self.assertIs(MnemoError.Code.INVALID_REQUEST, e.error.code, f"{what}: {e}")
        self.assertEqual(before, self.server.count(), f"{what} sent a request")

    def assert_sends(self, what: str, client: MnemoClient) -> None:
        before = self.server.count()
        client.execute()
        self.assertEqual(before + 1, self.server.count(), what)

    def test_every_chat_operation_checks_its_required_parameters(self) -> None:
        need_nothing = {MnemoChatClient.Operation.HEALTH}
        for op in MnemoChatClient.Operation:
            client = MnemoChatClient.Builder().api_key("k").base_url(self.server.url()).operation(op).build()
            if op in need_nothing:
                self.assert_sends(f"chat {op.name}", client)
            else:
                self.assert_refused_before_sending(f"chat {op.name}", client)

    def test_every_settings_operation_checks_its_required_parameters(self) -> None:
        need_nothing = {MnemoSettingsClient.Operation.GET_OPTIONS}
        for op in MnemoSettingsClient.Operation:
            client = MnemoSettingsClient.Builder().api_key("k").base_url(self.server.url()).operation(op).build()
            if op in need_nothing:
                self.assert_sends(f"settings {op.name}", client)
            else:
                self.assert_refused_before_sending(f"settings {op.name}", client)

    def test_every_network_operation_checks_its_required_parameters(self) -> None:
        need_nothing = {MnemoNetworkClient.Operation.BROWSE_PUBLIC_REGISTRY}
        for op in MnemoNetworkClient.Operation:
            client = MnemoNetworkClient.Builder().api_key("k").base_url(self.server.url()).operation(op).build()
            if op in need_nothing:
                self.assert_sends(f"network {op.name}", client)
            else:
                self.assert_refused_before_sending(f"network {op.name}", client)

    def test_rag_query_checks_its_required_parameters(self) -> None:
        self.assert_refused_before_sending("rag QUERY",
                                           MnemoRAGClient.Builder().api_key("k").base_url(self.server.url()).build())

    def test_blank_required_values_are_refused_like_missing_ones(self) -> None:
        self.assert_refused_before_sending("blank session_id", MnemoChatClient.Builder().api_key("k")
                                           .base_url(self.server.url()).tenant_id("acme").session_id("   ")
                                           .message("hi").build())

    def test_a_missing_or_blank_api_key_or_endpoint_is_refused_for_every_client(self) -> None:
        clients = [
            MnemoChatClient.Builder().base_url(self.server.url()).operation(MnemoChatClient.Operation.HEALTH).build(),
            MnemoRAGClient.Builder().api_key(" ").base_url(self.server.url()).rag_id("r").query("q").build(),
            MnemoSettingsClient.Builder().base_url(self.server.url())
            .operation(MnemoSettingsClient.Operation.GET_OPTIONS).build(),
            MnemoNetworkClient.Builder().base_url(self.server.url())
            .operation(MnemoNetworkClient.Operation.BROWSE_PUBLIC_REGISTRY).build(),
        ]
        for client in clients:
            self.assertIs(MnemoError.Code.MISSING_API_KEY, self.rejection(client.execute).error.code)
        self.assert_refused_before_sending("no endpoint", MnemoChatClient.Builder().api_key("k").base_url(" ")
                                           .operation(MnemoChatClient.Operation.HEALTH).build())
        self.assertEqual(0, self.server.count())

    def test_a_bad_timeout_is_refused_and_zero_means_none(self) -> None:
        for bad in (None, -1, float("nan"), True, "5"):
            with self.subTest(timeout=bad):
                self.assert_refused_before_sending(f"timeout {bad!r}", MnemoChatClient.Builder().api_key("k")
                                                   .base_url(self.server.url()).timeout(bad)  # type: ignore[arg-type]
                                                   .operation(MnemoChatClient.Operation.HEALTH).build())
        for good in (0, 5, 2.5):
            self.assert_sends(f"timeout {good}", MnemoChatClient.Builder().api_key("k").base_url(self.server.url())
                              .timeout(good).operation(MnemoChatClient.Operation.HEALTH).build())
