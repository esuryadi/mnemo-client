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

"""Tests for authenticating with an OAuth client id and secret instead of an API key."""

from __future__ import annotations

import base64
import threading

from mnemo_client import MnemoError, MnemoNetworkClient

from fake_server import FakeServerTestCase

TOKEN_PATH = "/oauth/token"
LIST_PATH = "/mnemo/network/sharing/private"
OP = MnemoNetworkClient.Operation.LIST_PRIVATE_GRANTS


def token(value: str, expires_in: int = 3600) -> str:
    return '{"access_token":"%s","token_type":"Bearer","expires_in":%d}' % (value, expires_in)


class ClientCredentialsTest(FakeServerTestCase):

    def builder(self) -> MnemoNetworkClient.Builder:
        return MnemoNetworkClient.Builder().client_credentials("mnemo_cid_1", "mnemo_cs_1") \
            .base_url(self.server.url()).tenant_id("acme").operation(OP)

    def api_calls(self):
        return [r for r in self.server.requests if r.path != TOKEN_PATH]

    def test_exchanges_the_credentials_and_sends_the_bearer_token(self) -> None:
        self.server.reply_on(TOKEN_PATH, (200, token("tok-a"))).reply(200, "[]")
        self.builder().build().execute()
        first = self.server.requests[0]
        self.assertEqual(("POST", TOKEN_PATH), (first.method, first.path))
        self.assertEqual("grant_type=client_credentials", first.body)
        expected = "Basic " + base64.b64encode(b"mnemo_cid_1:mnemo_cs_1").decode()
        self.assertEqual(expected, first.authorization)
        call = self.api_calls()[0]
        self.assertEqual("Bearer tok-a", call.authorization)
        self.assertIsNone(call.token)

    def test_reuses_the_token_across_calls(self) -> None:
        self.server.reply_on(TOKEN_PATH, (200, token("tok-a"))).reply(200, "[]")
        client = self.builder().build()
        client.execute()
        client.execute()
        self.assertEqual(1, sum(1 for r in self.server.requests if r.path == TOKEN_PATH))
        self.assertEqual(2, len(self.api_calls()))

    def test_fetches_a_new_token_when_the_old_one_is_about_to_expire(self) -> None:
        self.server.reply_on(TOKEN_PATH, (200, token("tok-a", 30)), (200, token("tok-b"))).reply(200, "[]")
        client = self.builder().build()
        client.execute()
        client.execute()
        self.assertEqual(["Bearer tok-a", "Bearer tok-b"], [r.authorization for r in self.api_calls()])

    def test_fetches_a_new_token_and_retries_once_when_the_service_rejects_it(self) -> None:
        self.server.reply_on(TOKEN_PATH, (200, token("tok-a")), (200, token("tok-b")))
        self.server.reply_on(LIST_PATH, (401, '{"error":"Unauthorized"}'), (200, "[]"))
        self.builder().build().execute()
        self.assertEqual(["Bearer tok-a", "Bearer tok-b"], [r.authorization for r in self.api_calls()])

    def test_gives_up_after_one_retry(self) -> None:
        self.server.reply_on(TOKEN_PATH, (200, token("tok-a")))
        self.server.reply_on(LIST_PATH, (401, '{"error":"Unauthorized"}'))
        e = self.rejection(self.builder().build().execute)
        self.assertEqual(401, e.http_status)
        self.assertEqual(2, len(self.api_calls()))

    def test_wrong_secret_is_unauthorized(self) -> None:
        self.server.reply_on(TOKEN_PATH, (401, '{"error":"invalid_client"}'))
        e = self.rejection(self.builder().build().execute)
        self.assertEqual(MnemoError.Code.UNAUTHORIZED, e.error.code)
        self.assertEqual([], self.api_calls())

    def test_locked_client_is_rate_limited(self) -> None:
        self.server.reply_on(TOKEN_PATH, (429, '{"error":"too_many_attempts"}'))
        e = self.rejection(self.builder().build().execute)
        self.assertEqual(MnemoError.Code.RATE_LIMITED, e.error.code)

    def test_a_token_reply_without_a_token_is_a_serialization_error(self) -> None:
        self.server.reply_on(TOKEN_PATH, (200, "{}"))
        e = self.rejection(self.builder().build().execute)
        self.assertEqual(MnemoError.Code.SERIALIZATION_ERROR, e.error.code)

    def test_api_key_and_credentials_together_are_refused_before_any_request(self) -> None:
        e = self.rejection(self.builder().api_key("tok-1").build().execute)
        self.assertEqual(MnemoError.Code.INVALID_REQUEST, e.error.code)
        self.assertEqual(0, self.server.count())

    def test_an_id_without_a_secret_is_refused(self) -> None:
        b = MnemoNetworkClient.Builder().client_credentials("mnemo_cid_1", " ").base_url(self.server.url())
        e = self.rejection(b.tenant_id("acme").operation(OP).build().execute)
        self.assertEqual(MnemoError.Code.INVALID_REQUEST, e.error.code)
        self.assertEqual(0, self.server.count())

    def test_an_api_key_still_uses_the_token_header_and_no_exchange(self) -> None:
        self.server.reply(200, "[]")
        MnemoNetworkClient.Builder().api_key("tok-1").base_url(self.server.url()).tenant_id("acme") \
            .operation(OP).build().execute()
        self.assertEqual("tok-1", self.server.last().token)
        self.assertIsNone(self.server.last().authorization)
        self.assertEqual(1, self.server.count())

    def test_concurrent_calls_share_one_exchange(self) -> None:
        self.server.reply_on(TOKEN_PATH, (200, token("tok-a"))).reply(200, "[]")
        client = self.builder().build()
        threads = [threading.Thread(target=client.execute) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(1, sum(1 for r in self.server.requests if r.path == TOKEN_PATH))
        self.assertEqual(3, len(self.api_calls()))
