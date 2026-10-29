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

"""The implementation of :class:`~mnemo_client.MnemoRAGClient` (not part of the public API)."""

from __future__ import annotations

from typing import Any, Callable, Dict

from ._abstract import AbstractMnemoClient, _body, _invalid, _path, _require
from .model import RagQueryResponse
from .rag import MnemoRAGClient

Op = MnemoRAGClient.Operation


class MnemoRAGClientImpl(AbstractMnemoClient, MnemoRAGClient):
    """Implements :class:`MnemoRAGClient`: one private method per operation."""

    def __init__(self, builder: MnemoRAGClient.Builder) -> None:
        super().__init__(builder)
        self._builder = builder

    def execute(self) -> Any:
        """Dispatches to the method that implements the operation chosen on the builder."""
        operation = self._builder._operation
        if operation is None:
            raise _invalid("operation is required")
        dispatch: Dict[MnemoRAGClient.Operation, Callable[[str], Any]] = {
            Op.QUERY: self._query,
        }
        if operation not in dispatch:
            raise _invalid(f"unknown operation {operation}")
        return self._with_target(dispatch[operation])

    def _query(self, base: str) -> RagQueryResponse:
        b = self._builder
        return self._send("POST", _path(base, "mnemo/rag/{ragId}", ragId=_require(b._rag_id, "rag_id")),
                          _body(query=_require(b._query, "query"), additionalContext=b._additional_context),
                          convert=RagQueryResponse.from_dict)
