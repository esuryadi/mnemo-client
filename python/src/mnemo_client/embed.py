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


"""Mints the short-lived tokens of the ``<mnemo-chat>`` web component: :class:`MnemoEmbedClient`."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from .client import MnemoClient, MnemoClientBuilder


class MnemoEmbedClient(MnemoClient):
    """Mints embed tokens for the ``<mnemo-chat>`` web component.

    It is a **server-side** call: authenticate it with a tenant API token holding the ADMIN role (or OAuth client
    credentials), never from a browser, and never hand that credential to the page, only the minted token::

        token = MnemoEmbedClient.Builder() \\
            .api_key(os.environ["MNEMO_API_KEY"]) \\
            .tenant_id("acme") \\
            .allowed_origin("https://app.example.com") \\
            .end_user_id("user-42") \\
            .build().execute()   # EmbedToken
    """

    class Operation(Enum):
        """The embed calls, with the builder parameters each one reads and the type ``execute()`` returns."""

        MINT_TOKEN = "MINT_TOKEN"
        """Mints an embed token (``POST mnemo/embed/token``); needs tenant_id and allowed_origin (exactly one origin,
        ``https://host[:port]``, or ``http://localhost[:port]`` / ``http://127.0.0.1[:port]``, no path, no
        wildcard), optional end_user_id (1 to 128 characters of ``A-Za-z0-9._@-``) and ttl_seconds (60 to 900,
        default 900). Returns ``EmbedToken``."""

    class Builder(MnemoClientBuilder):
        """Collects the call parameters for a :class:`MnemoEmbedClient` and passes itself to the client
        implementation in :meth:`build`."""

        def __init__(self) -> None:
            super().__init__()
            self._operation: Optional[MnemoEmbedClient.Operation] = MnemoEmbedClient.Operation.MINT_TOKEN
            self._end_user_id: Optional[str] = None
            self._allowed_origin: Optional[str] = None
            self._ttl_seconds: Optional[int] = None

        def operation(self, operation: MnemoEmbedClient.Operation) -> MnemoEmbedClient.Builder:
            self._operation = operation
            return self

        def end_user_id(self, end_user_id: Optional[str]) -> MnemoEmbedClient.Builder:
            """Identifies the visitor, so the same person keeps the same session prefix (and history) across tokens."""
            self._end_user_id = end_user_id
            return self

        def allowed_origin(self, allowed_origin: str) -> MnemoEmbedClient.Builder:
            """The one origin of the page that will use the token; the service only lets that origin call with it."""
            self._allowed_origin = allowed_origin
            return self

        def ttl_seconds(self, ttl_seconds: int) -> MnemoEmbedClient.Builder:
            """How long the token lives, 60 to 900 seconds."""
            self._ttl_seconds = ttl_seconds
            return self

        def build(self) -> MnemoEmbedClient:
            from ._embed_impl import MnemoEmbedClientImpl

            return MnemoEmbedClientImpl(self)
