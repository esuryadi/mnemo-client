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

"""The implementation of :class:`~mnemo_client.MnemoNetworkClient` (not part of the public API)."""

from __future__ import annotations

from typing import Any, Callable, Dict

from ._abstract import AbstractMnemoClient, _body, _invalid, _path, _query, _require
from .network import MnemoNetworkClient

Op = MnemoNetworkClient.Operation


class MnemoNetworkClientImpl(AbstractMnemoClient, MnemoNetworkClient):
    """Implements :class:`MnemoNetworkClient`: one private method per operation."""

    def __init__(self, builder: MnemoNetworkClient.Builder) -> None:
        super().__init__(builder)
        self._builder = builder

    def execute(self) -> Any:
        """Dispatches to the method that implements the operation chosen on the builder."""
        operation = self._builder._operation
        if operation is None:
            raise _invalid("operation is required")
        dispatch: Dict[MnemoNetworkClient.Operation, Callable[[str], Any]] = {
            Op.LIST_PRIVATE_GRANTS: self._list_private_grants,
            Op.GRANT_PRIVATE: self._grant_private,
            Op.REVOKE_PRIVATE: self._revoke_private,
            Op.LIST_INBOUND_GRANTS: self._list_inbound_grants,
            Op.ACCEPT_INBOUND_GRANT: self._accept_inbound_grant,
            Op.REMOVE_INBOUND_GRANT: self._remove_inbound_grant,
            Op.PUBLISH: self._publish,
            Op.UNPUBLISH: self._unpublish,
            Op.BROWSE_PUBLIC_REGISTRY: self._browse_public_registry,
            Op.SUBSCRIBE: self._subscribe,
            Op.UNSUBSCRIBE: self._unsubscribe,
            Op.LIST_SUBSCRIPTIONS: self._list_subscriptions,
            Op.SEARCH_TENANTS: self._search_tenants,
            Op.REQUEST_AFFILIATION: self._request_affiliation,
            Op.APPROVE_AFFILIATION: self._approve_affiliation,
            Op.REJECT_AFFILIATION: self._reject_affiliation,
            Op.LIST_OUTGOING_AFFILIATIONS: self._list_outgoing_affiliations,
            Op.LIST_INCOMING_AFFILIATIONS: self._list_incoming_affiliations,
        }
        if operation not in dispatch:
            raise _invalid(f"unknown operation {operation}")
        return self._with_target(dispatch[operation])

    def _list_private_grants(self, base: str) -> Dict[str, Any]:
        return self._send("GET", _query(_path(base, "mnemo/network/sharing/private"), ownerTenantId=self._tenant()))

    def _grant_private(self, base: str) -> Any:
        return self._send("POST", _path(base, "mnemo/network/sharing/private"),
                          _body(ownerTenantId=self._tenant(), subject=self._subject(),
                                targetTenantId=self._counterpart(), description=self._builder._description))

    def _revoke_private(self, base: str) -> None:
        return self._send("DELETE", _query(self._subject_path(base, "sharing/private/{subject}"),
                                           ownerTenantId=self._tenant(), targetTenantId=self._counterpart()),
                          expect_body=False)

    def _list_inbound_grants(self, base: str) -> Dict[str, Any]:
        return self._send("GET", _query(_path(base, "mnemo/network/sharing/private/inbound"),
                                        borrowerTenantId=self._tenant()))

    def _accept_inbound_grant(self, base: str) -> Any:
        return self._send("POST", _query(self._subject_path(base, "sharing/private/inbound/{subject}/accept"),
                                         borrowerTenantId=self._tenant(), ownerTenantId=self._counterpart()))

    def _remove_inbound_grant(self, base: str) -> None:
        return self._send("DELETE", _query(self._subject_path(base, "sharing/private/inbound/{subject}"),
                                           borrowerTenantId=self._tenant(), ownerTenantId=self._counterpart()),
                          expect_body=False)

    def _publish(self, base: str) -> Any:
        return self._send("POST", _query(self._subject_path(base, "sharing/public/{subject}"),
                                         ownerTenantId=self._tenant()),
                          _body(description=self._builder._description,
                                affiliatedOnly=self._builder._affiliated_only))

    def _unpublish(self, base: str) -> None:
        return self._send("DELETE", _query(self._subject_path(base, "sharing/public/{subject}"),
                                           ownerTenantId=self._tenant()),
                          expect_body=False)

    def _browse_public_registry(self, base: str) -> Dict[str, Any]:
        b = self._builder
        return self._send("GET", _query(_path(base, "mnemo/network/sharing/public/registry"),
                                        subject=b._subject, ownerTenantId=b._counterpart_tenant_id,
                                        callerTenantId=self._tenant_id(), page=b._page, size=b._size))

    def _subscribe(self, base: str) -> Any:
        return self._send("POST", _path(base, "mnemo/network/sharing/subscriptions"),
                          _body(subscriberTenantId=self._tenant(), ownerTenantId=self._counterpart(),
                                subject=self._subject()))

    def _unsubscribe(self, base: str) -> None:
        return self._send("DELETE", _query(_path(base, "mnemo/network/sharing/subscriptions/{owner}/{subject}",
                                                 owner=self._counterpart(), subject=self._subject()),
                                           subscriberTenantId=self._tenant()),
                          expect_body=False)

    def _list_subscriptions(self, base: str) -> Dict[str, Any]:
        return self._send("GET", _query(_path(base, "mnemo/network/sharing/subscriptions"), tenantId=self._tenant()))

    def _search_tenants(self, base: str) -> Dict[str, Any]:
        b = self._builder
        return self._send("GET", _query(_path(base, "mnemo/network/tenants/search"),
                                        q=_require(b._query, "query"), page=b._page, size=b._size))

    def _request_affiliation(self, base: str) -> Any:
        return self._send("POST", _path(base, "mnemo/network/affiliates/requests"),
                          _body(requesterTenantId=self._tenant(), targetTenantId=self._counterpart()))

    def _approve_affiliation(self, base: str) -> Any:
        return self._send("POST", _query(_path(base, "mnemo/network/affiliates/requests/{requester}/approve",
                                               requester=self._counterpart()), targetTenantId=self._tenant()))

    def _reject_affiliation(self, base: str) -> Any:
        return self._send("POST", _query(_path(base, "mnemo/network/affiliates/requests/{requester}/reject",
                                               requester=self._counterpart()), targetTenantId=self._tenant()))

    def _list_outgoing_affiliations(self, base: str) -> Dict[str, Any]:
        return self._send("GET", _query(_path(base, "mnemo/network/affiliates/outgoing"), tenantId=self._tenant()))

    def _list_incoming_affiliations(self, base: str) -> Dict[str, Any]:
        return self._send("GET", _query(_path(base, "mnemo/network/affiliates/incoming"), tenantId=self._tenant()))

    def _tenant(self) -> str:
        return _require(self._tenant_id(), "tenant_id")

    def _counterpart(self) -> str:
        return _require(self._builder._counterpart_tenant_id, "counterpart_tenant_id")

    def _subject(self) -> str:
        return _require(self._builder._subject, "subject")

    def _subject_path(self, base: str, template: str) -> str:
        return _path(base, "mnemo/network/" + template, subject=self._subject())
