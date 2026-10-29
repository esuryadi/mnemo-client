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

"""Chat, sessions, history, memory subjects, plan and health: :class:`MnemoChatClient`."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from .client import MnemoClient, MnemoClientBuilder


class MnemoChatClient(MnemoClient):
    """Handles conversational interactions with MNEMO.

    A client performs one :class:`MnemoChatClient.Operation`, chosen on the builder (default ``CHAT``). The builder
    holds the parameters; ``execute()`` sends the call and returns the result. A new session is initialized once,
    then chatted in as often as needed::

        MnemoChatClient.Builder() \\
            .api_key(os.environ["MNEMO_API_KEY"]) \\
            .tenant_id("acme") \\
            .session_id("session-1") \\
            .operation(MnemoChatClient.Operation.INIT_SESSION) \\
            .build().execute()

        client = MnemoChatClient.Builder() \\
            .api_key(os.environ["MNEMO_API_KEY"]) \\
            .tenant_id("acme") \\
            .session_id("session-1") \\
            .message("What did I eat on Monday?") \\
            .build()
        reply = client.execute()  # ChatMessageResponse
        print(reply.message)

    Failures are raised as :class:`~mnemo_client.MnemoClientException`; use its ``http_status`` to tell a bad key
    (401) from a quota limit (429).
    """

    class Operation(Enum):
        """The chat-related calls, with the builder parameters each one reads and the type ``execute()`` returns."""

        INIT_SESSION = "INIT_SESSION"
        """Prepares a new session so it can be chatted in; needs tenant_id, session_id, optional session_name. A
        session must be initialized once before its first ``CHAT``: the service refuses a chat on an uninitialized
        session with HTTP 409. Waits for initialization to finish (it can take ten seconds or more) and returns a
        ``dict`` with ``ready``, ``message``, ``totalMs`` and the ``stages`` that ran; raises ``INIT_FAILED`` if
        initialization fails."""
        CHAT = "CHAT"
        """Sends ``message`` in ``session_id``; needs tenant_id, session_id, message. Returns ``ChatMessageResponse``."""
        LIST_SESSIONS = "LIST_SESSIONS"
        """Lists sessions; needs tenant_id, optional query/page/size. The query must equal a session's name exactly;
        it is not a partial-text search. Returns ``dict`` (a page)."""
        GET_HISTORY = "GET_HISTORY"
        """One page of a session's history, newest first; needs tenant_id, session_id, optional before/size.
        Returns ``dict``."""
        RENAME_SESSION = "RENAME_SESSION"
        """Renames a session; needs tenant_id, session_id, session_name. Returns ``dict``."""
        CLOSE_SESSION = "CLOSE_SESSION"
        """Closes a session, or deletes it when ``permanent``; needs tenant_id, session_id. Returns ``None``."""
        LIST_SUBJECTS = "LIST_SUBJECTS"
        """Lists the tenant's memory subjects; needs tenant_id. Returns ``list`` of ``dict``."""
        DELETE_SUBJECT = "DELETE_SUBJECT"
        """Deletes a subject and all its memory; needs tenant_id, subject_name. Returns ``None``."""
        UPDATE_SUBJECT_DESCRIPTION = "UPDATE_SUBJECT_DESCRIPTION"
        """Sets (or re-synthesizes, when blank) a subject's description; needs tenant_id, subject_name.
        Returns ``dict``."""
        GET_PLAN = "GET_PLAN"
        """The tenant's plan and quota usage; needs tenant_id. Returns ``dict``."""
        HEALTH = "HEALTH"
        """Service health check. Returns ``dict``."""

    class Builder(MnemoClientBuilder):
        """Collects the call parameters for a :class:`MnemoChatClient` and passes itself to the client
        implementation in :meth:`build`."""

        def __init__(self) -> None:
            super().__init__()
            self._operation: Optional[MnemoChatClient.Operation] = MnemoChatClient.Operation.CHAT
            self._session_id: Optional[str] = None
            self._message: Optional[str] = None
            self._session_name: Optional[str] = None
            self._subject_name: Optional[str] = None
            self._description: Optional[str] = None
            self._query: Optional[str] = None
            self._page: Optional[int] = None
            self._size: Optional[int] = None
            self._before: Optional[int] = None
            self._permanent = False

        def operation(self, operation: MnemoChatClient.Operation) -> MnemoChatClient.Builder:
            self._operation = operation
            return self

        def session_id(self, session_id: str) -> MnemoChatClient.Builder:
            self._session_id = session_id
            return self

        def message(self, message: str) -> MnemoChatClient.Builder:
            """The user message for ``CHAT``."""
            self._message = message
            return self

        def session_name(self, session_name: str) -> MnemoChatClient.Builder:
            """The name for ``INIT_SESSION`` (optional), or the new name for ``RENAME_SESSION``."""
            self._session_name = session_name
            return self

        def subject_name(self, subject_name: str) -> MnemoChatClient.Builder:
            self._subject_name = subject_name
            return self

        def description(self, description: str) -> MnemoChatClient.Builder:
            """The subject description for ``UPDATE_SUBJECT_DESCRIPTION``; blank asks MNEMO to write one."""
            self._description = description
            return self

        def query(self, query: str) -> MnemoChatClient.Builder:
            """For ``LIST_SESSIONS``: return only sessions whose name equals this text exactly."""
            self._query = query
            return self

        def page(self, page: int) -> MnemoChatClient.Builder:
            self._page = page
            return self

        def size(self, size: int) -> MnemoChatClient.Builder:
            self._size = size
            return self

        def before(self, before_epoch_millis: int) -> MnemoChatClient.Builder:
            """Epoch-millis cursor for ``GET_HISTORY``: only messages before it are returned."""
            self._before = before_epoch_millis
            return self

        def permanent(self, permanent: bool) -> MnemoChatClient.Builder:
            """For ``CLOSE_SESSION``: delete the session permanently instead of just closing it."""
            self._permanent = permanent
            return self

        def build(self) -> MnemoChatClient:
            from ._chat_impl import MnemoChatClientImpl

            return MnemoChatClientImpl(self)
