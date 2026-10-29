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

"""Tests for MnemoNetworkClient."""

from __future__ import annotations

import json

from mnemo_client import MnemoError, MnemoNetworkClient

from fake_server import FakeServerTestCase

Op = MnemoNetworkClient.Operation


class MnemoNetworkClientTest(FakeServerTestCase):

    def builder(self) -> MnemoNetworkClient.Builder:
        return MnemoNetworkClient.Builder().api_key("tok-1").base_url(self.server.url()).tenant_id("acme")

    def test_operation_is_required(self) -> None:
        self.rejection(lambda: self.builder().build().execute())
        self.assertEqual(0, self.server.count())

    def test_grant_private_posts_the_grant(self) -> None:
        self.server.reply(200, '{"status":"PENDING"}')
        r = self.builder().operation(Op.GRANT_PRIVATE).counterpart_tenant_id("globex") \
            .subject("Roadmap").description("shared").build().execute()
        self.assertEqual("PENDING", r["status"])
        self.assertEqual("/mnemo/network/sharing/private", self.server.last().path)
        self.assertEqual({"ownerTenantId": "acme", "subject": "Roadmap", "targetTenantId": "globex",
                          "description": "shared"}, json.loads(self.server.last().body))

    def test_revoke_private_is_a_delete_with_owner_and_target(self) -> None:
        self.server.reply(204, "")
        self.assertIsNone(self.builder().operation(Op.REVOKE_PRIVATE).counterpart_tenant_id("globex")
                          .subject("Road map").build().execute())
        self.assertEqual("DELETE", self.server.last().method)
        self.assertEqual("/mnemo/network/sharing/private/Road%20map", self.server.last().raw_path)
        self.assertEqual("ownerTenantId=acme&targetTenantId=globex", self.server.last().query)

    def test_accept_inbound_grant_maps_borrower_and_owner(self) -> None:
        self.server.reply(200, "{}")
        self.builder().operation(Op.ACCEPT_INBOUND_GRANT).counterpart_tenant_id("globex").subject("Roadmap") \
            .build().execute()
        self.assertEqual("POST", self.server.last().method)
        self.assertEqual("/mnemo/network/sharing/private/inbound/Roadmap/accept", self.server.last().path)
        self.assertEqual("borrowerTenantId=acme&ownerTenantId=globex", self.server.last().query)

    def test_publish_sends_the_visibility_in_the_body(self) -> None:
        self.server.reply(200, "{}")
        self.builder().operation(Op.PUBLISH).subject("Roadmap").description("d").affiliated_only(True) \
            .build().execute()
        self.assertEqual("/mnemo/network/sharing/public/Roadmap", self.server.last().path)
        self.assertEqual("ownerTenantId=acme", self.server.last().query)
        self.assertEqual({"description": "d", "affiliatedOnly": True}, json.loads(self.server.last().body))

    def test_browse_registry_returns_a_page_and_sends_only_the_filters_set(self) -> None:
        self.server.reply(200, '{"content":[{"subject":"Roadmap"}],"totalElements":1}')
        page = self.builder().operation(Op.BROWSE_PUBLIC_REGISTRY).page(1).build().execute()
        self.assertEqual("Roadmap", page["content"][0]["subject"])
        self.assertEqual("callerTenantId=acme&page=1", self.server.last().query)

    def test_subscribe_and_unsubscribe(self) -> None:
        self.server.reply(200, "{}")
        self.builder().operation(Op.SUBSCRIBE).counterpart_tenant_id("globex").subject("Roadmap").build().execute()
        self.assertEqual({"subscriberTenantId": "acme", "ownerTenantId": "globex", "subject": "Roadmap"},
                         json.loads(self.server.last().body))

        self.server.reply(204, "")
        self.builder().operation(Op.UNSUBSCRIBE).counterpart_tenant_id("globex").subject("Roadmap").build().execute()
        self.assertEqual("/mnemo/network/sharing/subscriptions/globex/Roadmap", self.server.last().path)
        self.assertEqual("subscriberTenantId=acme", self.server.last().query)

    def test_approve_affiliation_puts_the_requester_in_the_path(self) -> None:
        self.server.reply(200, "{}")
        self.builder().operation(Op.APPROVE_AFFILIATION).counterpart_tenant_id("globex").build().execute()
        self.assertEqual("/mnemo/network/affiliates/requests/globex/approve", self.server.last().path)
        self.assertEqual("targetTenantId=acme", self.server.last().query)

    def test_counterpart_is_required_where_the_operation_has_one(self) -> None:
        e = self.rejection(lambda: self.builder().operation(Op.REQUEST_AFFILIATION).build().execute())
        self.assertIs(MnemoError.Code.INVALID_REQUEST, e.error.code)
        self.assertIn("counterpart_tenant_id", str(e))
        self.assertEqual(0, self.server.count())

    def test_every_operation_is_wired(self) -> None:
        self.server.reply(200, "{}")
        for op in Op:
            with self.subTest(op=op.name):
                self.builder().operation(op).counterpart_tenant_id("globex").subject("S").query("q") \
                    .build().execute()
        self.assertEqual(len(Op), self.server.count())
