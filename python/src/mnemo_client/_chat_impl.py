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

"""The implementation of :class:`~mnemo_client.MnemoChatClient` (not part of the public API)."""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from ._abstract import AbstractMnemoClient, _body, _invalid, _parse_json, _path, _query, _require
from .chat import MnemoChatClient
from .exception import MnemoClientException, MnemoError
from .model import ChatMessageResponse

Op = MnemoChatClient.Operation


class MnemoChatClientImpl(AbstractMnemoClient, MnemoChatClient):
    """Implements :class:`MnemoChatClient`: one private method per operation."""

    def __init__(self, builder: MnemoChatClient.Builder) -> None:
        super().__init__(builder)
        self._builder = builder

    def execute(self) -> Any:
        """Dispatches to the method that implements the operation chosen on the builder."""
        operation = self._builder._operation
        if operation is None:
            raise _invalid("operation is required")
        dispatch: Dict[MnemoChatClient.Operation, Callable[[str], Any]] = {
            Op.INIT_SESSION: self._init_session,
            Op.CHAT: self._chat,
            Op.LIST_SESSIONS: self._list_sessions,
            Op.GET_HISTORY: self._get_history,
            Op.RENAME_SESSION: self._rename_session,
            Op.CLOSE_SESSION: self._close_session,
            Op.LIST_SUBJECTS: self._list_subjects,
            Op.DELETE_SUBJECT: self._delete_subject,
            Op.UPDATE_SUBJECT_DESCRIPTION: self._update_subject_description,
            Op.GET_PLAN: self._get_plan,
            Op.HEALTH: self._health,
        }
        if operation not in dispatch:
            raise _invalid(f"unknown operation {operation}")
        return self._with_target(dispatch[operation])

    def _init_session(self, base: str) -> Dict[str, Any]:
        b = self._builder
        events = self._send_event_stream("POST", _path(base, "mnemo/init/stream"),
                                         _body(tenantId=_require(self._tenant_id(), "tenant_id"),
                                               sessionId=_require(b._session_id, "session_id"),
                                               sessionName=b._session_name))
        stages: List[Dict[str, Any]] = []
        complete: Optional[Dict[str, Any]] = None
        for event in events:
            if event.name == "init-stage":
                stages.append(_parse_json(event.data))
            elif event.name == "complete":
                complete = _parse_json(event.data)
            elif event.name == "error":
                parsed = _parse_json(event.data)
                error = parsed.get("error") if isinstance(parsed, dict) else None
                raise MnemoClientException(MnemoError(MnemoError.Code.INIT_FAILED,
                                                      event.data if error is None else str(error)))
        if complete is None:
            raise MnemoClientException(MnemoError(MnemoError.Code.INIT_FAILED,
                                                  "The service ended the stream before initialization completed"))
        return {**complete, "ready": True, "stages": stages}

    def _chat(self, base: str) -> ChatMessageResponse:
        b = self._builder
        return self._send("POST", _path(base, "mnemo/chat"),
                          _body(tenantId=_require(self._tenant_id(), "tenant_id"),
                                sessionId=_require(b._session_id, "session_id"),
                                message=_require(b._message, "message")),
                          convert=ChatMessageResponse.from_dict)

    def _list_sessions(self, base: str) -> Dict[str, Any]:
        b = self._builder
        return self._send("GET", _query(_path(base, "mnemo/sessions"),
                                        tenantId=_require(self._tenant_id(), "tenant_id"), q=b._query,
                                        page=b._page, size=b._size))

    def _get_history(self, base: str) -> Dict[str, Any]:
        b = self._builder
        return self._send("GET", _query(_path(base, "mnemo/sessions/{id}/history",
                                              id=_require(b._session_id, "session_id")),
                                        tenantId=_require(self._tenant_id(), "tenant_id"), before=b._before,
                                        size=b._size))

    def _rename_session(self, base: str) -> Dict[str, Any]:
        b = self._builder
        return self._send("PATCH", _path(base, "mnemo/sessions/{id}/name", id=_require(b._session_id, "session_id")),
                          _body(tenantId=_require(self._tenant_id(), "tenant_id"),
                                sessionName=_require(b._session_name, "session_name")))

    def _close_session(self, base: str) -> None:
        b = self._builder
        return self._send("DELETE", _query(_path(base, "mnemo/sessions/{id}", id=_require(b._session_id, "session_id")),
                                           tenantId=_require(self._tenant_id(), "tenant_id"),
                                           permanent=bool(b._permanent)),
                          expect_body=False)

    def _list_subjects(self, base: str) -> List[Dict[str, Any]]:
        return self._send("GET", _query(_path(base, "mnemo/subjects"),
                                        tenantId=_require(self._tenant_id(), "tenant_id")))

    def _delete_subject(self, base: str) -> None:
        return self._send("DELETE", _query(_path(base, "mnemo/subject/{name}",
                                                 name=_require(self._builder._subject_name, "subject_name")),
                                           tenantId=_require(self._tenant_id(), "tenant_id")),
                          expect_body=False)

    def _update_subject_description(self, base: str) -> Dict[str, Any]:
        return self._send("PATCH", _path(base, "mnemo/subject/{name}/description",
                                         name=_require(self._builder._subject_name, "subject_name")),
                          _body(tenantId=_require(self._tenant_id(), "tenant_id"),
                                description=self._builder._description))

    def _get_plan(self, base: str) -> Dict[str, Any]:
        return self._send("GET", _query(_path(base, "mnemo/plan"), tenantId=_require(self._tenant_id(), "tenant_id")))

    def _health(self, base: str) -> Dict[str, Any]:
        return self._send("GET", _path(base, "mnemo/health"))
