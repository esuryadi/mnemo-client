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

"""MnemoRAG question answering: :class:`MnemoRAGClient`."""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from .client import MnemoClient, MnemoClientBuilder


class MnemoRAGClient(MnemoClient):
    """Asks questions against a MnemoRAG (Retrieval-Augmented Generation) configuration.

    MnemoRAG is stateless: each call asks one question against a RAG configuration (``rag_id``) that was created
    beforehand in Dorothy. It requires a Pro or Enterprise plan and a tenant API key (the master key cannot be
    used, since the tenant is taken from the key)::

        answer = MnemoRAGClient.Builder() \\
            .api_key(os.environ["MNEMO_API_KEY"]) \\
            .rag_id("support-kb") \\
            .query("What is the refund window for annual plans?") \\
            .build().execute()  # RagQueryResponse
        if answer.found:
            print(f"{answer.answer} ({answer.confidence})")
    """

    class Operation(Enum):
        """The RAG calls, with the type ``execute()`` returns."""

        QUERY = "QUERY"
        """Asks ``query`` against the configuration ``rag_id``; needs rag_id, query. Returns ``RagQueryResponse``."""

    class Builder(MnemoClientBuilder):
        """Collects the call parameters for a :class:`MnemoRAGClient`. The operation defaults to ``QUERY``."""

        def __init__(self) -> None:
            super().__init__()
            self._operation: Optional[MnemoRAGClient.Operation] = MnemoRAGClient.Operation.QUERY
            self._rag_id: Optional[str] = None
            self._query: Optional[str] = None
            self._additional_context: Optional[List[str]] = None

        def operation(self, operation: MnemoRAGClient.Operation) -> MnemoRAGClient.Builder:
            self._operation = operation
            return self

        def rag_id(self, rag_id: str) -> MnemoRAGClient.Builder:
            """The id of the RAG configuration to query."""
            self._rag_id = rag_id
            return self

        def query(self, query: str) -> MnemoRAGClient.Builder:
            """The question to answer."""
            self._query = query
            return self

        def additional_context(self, additional_context: List[str]) -> MnemoRAGClient.Builder:
            """Optional extra context passages the caller supplies along with the question."""
            self._additional_context = additional_context
            return self

        def build(self) -> MnemoRAGClient:
            from ._rag_impl import MnemoRAGClientImpl

            return MnemoRAGClientImpl(self)
