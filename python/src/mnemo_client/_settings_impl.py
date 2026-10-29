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

"""The implementation of :class:`~mnemo_client.MnemoSettingsClient` (not part of the public API)."""

from __future__ import annotations

from typing import Any, Callable, Dict

from ._abstract import AbstractMnemoClient, _body, _invalid, _path, _require
from .model import SettingsResponse
from .settings import MnemoSettingsClient

Op = MnemoSettingsClient.Operation


class MnemoSettingsClientImpl(AbstractMnemoClient, MnemoSettingsClient):
    """Implements :class:`MnemoSettingsClient`: one private method per operation."""

    def __init__(self, builder: MnemoSettingsClient.Builder) -> None:
        super().__init__(builder)
        self._builder = builder

    def execute(self) -> Any:
        """Dispatches to the method that implements the operation chosen on the builder."""
        operation = self._builder._operation
        if operation is None:
            raise _invalid("operation is required")
        dispatch: Dict[MnemoSettingsClient.Operation, Callable[[str], Any]] = {
            Op.GET_SETTINGS: self._get_settings,
            Op.UPDATE_SETTINGS: self._update_settings,
            Op.GET_OPTIONS: self._get_options,
        }
        if operation not in dispatch:
            raise _invalid(f"unknown operation {operation}")
        return self._with_target(dispatch[operation])

    def _get_settings(self, base: str) -> SettingsResponse:
        return self._send("GET", _path(base, "mnemo/account/{id}/settings",
                                       id=_require(self._builder._account_id, "account_id")),
                          convert=SettingsResponse.from_dict)

    def _update_settings(self, base: str) -> SettingsResponse:
        b = self._builder
        return self._send("PUT", _path(base, "mnemo/account/{id}/settings", id=_require(b._account_id, "account_id")),
                          _body(provider=b._provider, model=b._model, ingestModel=b._ingest_model,
                                apiKey=b._provider_api_key, lookbackDays=b._lookback_days,
                                encryptData=b._encrypt_data, sharedMemoryTtlHours=b._shared_memory_ttl_hours),
                          convert=SettingsResponse.from_dict)

    def _get_options(self, base: str) -> Dict[str, Any]:
        return self._send("GET", _path(base, "mnemo/account/settings/options"))
