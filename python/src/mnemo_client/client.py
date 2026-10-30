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

"""The base types every client shares: :class:`MnemoClient` and :class:`MnemoClientBuilder`."""

from __future__ import annotations

import threading
from abc import ABC, abstractmethod
from typing import Any, Optional, Tuple, TypeVar

B = TypeVar("B", bound="MnemoClientBuilder")


class MnemoClient(ABC):
    """The main interface for interacting with the MNEMO system.

    A client performs the one operation chosen on its builder; :meth:`execute` sends the call and returns the
    result, or raises :class:`~mnemo_client.MnemoClientException`.
    """

    @abstractmethod
    def execute(self) -> Any:
        ...


class MnemoClientBuilder(ABC):
    """The base of every client builder.

    It collects the credentials (an API key, or an OAuth client id and secret) and the optional service endpoint and timeout. The
    builder only collects parameters: ``build()`` hands the builder to the client implementation, which reads every
    parameter from it when :meth:`MnemoClient.execute` is called. Setters return the builder, so they chain.
    """

    DEFAULT_BASE_URL = "https://mnemo-api.panaxon.ai/api"
    """The public MNEMO service endpoint, used unless :meth:`base_url` is set."""

    def __init__(self) -> None:
        self._api_key: Optional[str] = None
        self._client_id: Optional[str] = None
        self._client_secret: Optional[str] = None
        self._token_lock = threading.Lock()
        self._token: Optional[Tuple[str, float]] = None  # (access token, time.monotonic() it expires at)
        self._base_url: Optional[str] = MnemoClientBuilder.DEFAULT_BASE_URL
        self._tenant_id: Optional[str] = None
        self._timeout: Optional[float] = 120.0

    def api_key(self: B, api_key: str) -> B:
        """Sets the MNEMO API token, sent as the ``X-Mnemo-Api-Token`` header."""
        self._api_key = api_key
        return self

    def client_credentials(self: B, client_id: str, client_secret: str) -> B:
        """Authenticates with an OAuth client instead of an API key.

        The client id and secret (created in Dorothy under Security, OAuth Clients) are exchanged at
        ``{base_url}/oauth/token`` for a one-hour bearer token. The token is fetched on first use, reused, and
        fetched again shortly before it expires, or after the service rejects it. Set this or :meth:`api_key`,
        not both.
        """
        self._client_id = client_id
        self._client_secret = client_secret
        return self

    def base_url(self: B, base_url: str) -> B:
        """Overrides the service endpoint, e.g. for a self-hosted or test deployment."""
        self._base_url = base_url
        return self

    def tenant_id(self: B, tenant_id: str) -> B:
        """Sets the tenant the call is made for. Required by operations that act on a tenant's memory."""
        self._tenant_id = tenant_id
        return self

    def timeout(self: B, seconds: float) -> B:
        """Sets the request timeout in seconds; ``0`` means no timeout.

        Chat calls run an LLM, so the default is generous (120s).
        """
        self._timeout = seconds
        return self

    @abstractmethod
    def build(self) -> MnemoClient:
        ...
