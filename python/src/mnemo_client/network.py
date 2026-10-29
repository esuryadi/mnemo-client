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

"""Memory sharing between tenants: :class:`MnemoNetworkClient`."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from .client import MnemoClient, MnemoClientBuilder


class MnemoNetworkClient(MnemoClient):
    """Shares memory subjects with other tenants: private grants to a named tenant, public publishing and
    subscribing, and affiliations between tenants.

    ``tenant_id`` on the builder is always the tenant making the call; ``counterpart_tenant_id`` is the other
    party, where the operation has one::

        MnemoNetworkClient.Builder() \\
            .api_key(os.environ["MNEMO_API_KEY"]) \\
            .tenant_id("acme") \\
            .counterpart_tenant_id("globex") \\
            .subject("Q3 Roadmap") \\
            .description("Roadmap shared with our partner") \\
            .operation(MnemoNetworkClient.Operation.GRANT_PRIVATE) \\
            .build().execute()

    The list and browse operations return a ``dict`` whose entries are under a key such as ``grants``,
    ``subscriptions``, ``affiliations`` or ``content``. The other operations return the service's parsed JSON, or
    ``None`` when it replies with no body.
    """

    class Operation(Enum):
        """The network calls. Each lists the builder parameters it needs besides api_key."""

        LIST_PRIVATE_GRANTS = "LIST_PRIVATE_GRANTS"
        """tenant_id (owner)."""
        GRANT_PRIVATE = "GRANT_PRIVATE"
        """tenant_id (owner), counterpart_tenant_id (grantee), subject; optional description."""
        REVOKE_PRIVATE = "REVOKE_PRIVATE"
        """tenant_id (owner), counterpart_tenant_id (grantee), subject."""
        LIST_INBOUND_GRANTS = "LIST_INBOUND_GRANTS"
        """tenant_id (borrower)."""
        ACCEPT_INBOUND_GRANT = "ACCEPT_INBOUND_GRANT"
        """tenant_id (borrower), counterpart_tenant_id (owner), subject."""
        REMOVE_INBOUND_GRANT = "REMOVE_INBOUND_GRANT"
        """tenant_id (borrower), counterpart_tenant_id (owner), subject."""
        PUBLISH = "PUBLISH"
        """tenant_id (owner), subject; optional description, affiliated_only."""
        UNPUBLISH = "UNPUBLISH"
        """tenant_id (owner), subject."""
        BROWSE_PUBLIC_REGISTRY = "BROWSE_PUBLIC_REGISTRY"
        """Optional subject filter, counterpart_tenant_id (owner filter), tenant_id (caller), page, size."""
        SUBSCRIBE = "SUBSCRIBE"
        """tenant_id (subscriber), counterpart_tenant_id (owner), subject."""
        UNSUBSCRIBE = "UNSUBSCRIBE"
        """tenant_id (subscriber), counterpart_tenant_id (owner), subject."""
        LIST_SUBSCRIPTIONS = "LIST_SUBSCRIPTIONS"
        """tenant_id."""
        SEARCH_TENANTS = "SEARCH_TENANTS"
        """query; optional page, size."""
        REQUEST_AFFILIATION = "REQUEST_AFFILIATION"
        """tenant_id (requester), counterpart_tenant_id (target)."""
        APPROVE_AFFILIATION = "APPROVE_AFFILIATION"
        """tenant_id (target), counterpart_tenant_id (requester)."""
        REJECT_AFFILIATION = "REJECT_AFFILIATION"
        """tenant_id (target), counterpart_tenant_id (requester)."""
        LIST_OUTGOING_AFFILIATIONS = "LIST_OUTGOING_AFFILIATIONS"
        """tenant_id."""
        LIST_INCOMING_AFFILIATIONS = "LIST_INCOMING_AFFILIATIONS"
        """tenant_id."""

    class Builder(MnemoClientBuilder):
        """Collects the call parameters for a :class:`MnemoNetworkClient`. The operation is required."""

        def __init__(self) -> None:
            super().__init__()
            self._operation: Optional[MnemoNetworkClient.Operation] = None
            self._counterpart_tenant_id: Optional[str] = None
            self._subject: Optional[str] = None
            self._description: Optional[str] = None
            self._affiliated_only: Optional[bool] = None
            self._query: Optional[str] = None
            self._page: Optional[int] = None
            self._size: Optional[int] = None

        def operation(self, operation: MnemoNetworkClient.Operation) -> MnemoNetworkClient.Builder:
            self._operation = operation
            return self

        def counterpart_tenant_id(self, counterpart_tenant_id: str) -> MnemoNetworkClient.Builder:
            self._counterpart_tenant_id = counterpart_tenant_id
            return self

        def subject(self, subject: str) -> MnemoNetworkClient.Builder:
            self._subject = subject
            return self

        def description(self, description: str) -> MnemoNetworkClient.Builder:
            self._description = description
            return self

        def affiliated_only(self, affiliated_only: bool) -> MnemoNetworkClient.Builder:
            """For ``PUBLISH``: only affiliated tenants may subscribe."""
            self._affiliated_only = affiliated_only
            return self

        def query(self, query: str) -> MnemoNetworkClient.Builder:
            self._query = query
            return self

        def page(self, page: int) -> MnemoNetworkClient.Builder:
            self._page = page
            return self

        def size(self, size: int) -> MnemoNetworkClient.Builder:
            self._size = size
            return self

        def build(self) -> MnemoNetworkClient:
            from ._network_impl import MnemoNetworkClientImpl

            return MnemoNetworkClientImpl(self)
