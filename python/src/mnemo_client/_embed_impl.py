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


"""The implementation of :class:`~mnemo_client.MnemoEmbedClient` (not part of the public API)."""

from __future__ import annotations

import re
from typing import Any, Callable, Dict

from ._abstract import AbstractMnemoClient, _body, _invalid, _is_blank, _path, _require
from .embed import MnemoEmbedClient
from .exception import MnemoClientException, MnemoError
from .model import EmbedToken

Op = MnemoEmbedClient.Operation

ORIGIN = re.compile(r"(https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|http://(localhost|127\.0\.0\.1))(:[0-9]{1,5})?")
END_USER_ID = re.compile(r"[A-Za-z0-9._@-]{1,128}")


class MnemoEmbedClientImpl(AbstractMnemoClient, MnemoEmbedClient):
    """Implements :class:`MnemoEmbedClient`: one private method per operation."""

    def __init__(self, builder: MnemoEmbedClient.Builder) -> None:
        super().__init__(builder)
        self._builder = builder

    def execute(self) -> Any:
        """Dispatches to the method that implements the operation chosen on the builder."""
        operation = self._builder._operation
        if operation is None:
            raise _invalid("operation is required")
        dispatch: Dict[MnemoEmbedClient.Operation, Callable[[str], Any]] = {
            Op.MINT_TOKEN: self._mint_token,
        }
        if operation not in dispatch:
            raise _invalid(f"unknown operation {operation}")
        return self._with_target(dispatch[operation])

    def _mint_token(self, base: str) -> EmbedToken:
        b = self._builder
        if not _is_blank(b._embed_token):
            raise _invalid("an embed token cannot mint tokens; use api_key or client_credentials")
        tenant_id = _require(self._tenant_id(), "tenant_id")
        origin = _require(b._allowed_origin, "allowed_origin")
        if not ORIGIN.fullmatch(origin):
            raise _invalid("allowed_origin must be one origin, https://host[:port] "
                           "(http only for localhost and 127.0.0.1), with no path and no wildcard")
        if b._end_user_id is not None and not END_USER_ID.fullmatch(b._end_user_id):
            raise _invalid("end_user_id must be 1 to 128 characters of A-Z a-z 0-9 . _ @ -")
        ttl = b._ttl_seconds
        if ttl is not None and (isinstance(ttl, bool) or not isinstance(ttl, int) or ttl < 60 or ttl > 900):
            raise _invalid("ttl_seconds must be between 60 and 900")
        return self._send("POST", _path(base, "mnemo/embed/token"),
                          _body(tenantId=tenant_id, allowedOrigin=origin, endUserId=b._end_user_id, ttlSeconds=ttl),
                          convert=lambda parsed: _token(parsed, tenant_id))


def _token(parsed: Any, tenant_id: str) -> EmbedToken:
    if not isinstance(parsed, dict):
        raise MnemoClientException(MnemoError(MnemoError.Code.SERIALIZATION_ERROR))
    try:
        return EmbedToken.from_dict({"tenantId": tenant_id, **parsed})
    except KeyError as e:
        raise TypeError("embed token reply is missing a field") from e
