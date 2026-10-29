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

"""Account settings: :class:`MnemoSettingsClient`."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from .client import MnemoClient, MnemoClientBuilder


class MnemoSettingsClient(MnemoClient):
    """Reads and updates an account's MNEMO settings::

        updated = MnemoSettingsClient.Builder() \\
            .api_key(os.environ["MNEMO_API_KEY"]) \\
            .account_id("acct-123") \\
            .operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS) \\
            .lookback_days(30) \\
            .encrypt_data(True) \\
            .build().execute()  # SettingsResponse

    Only the settings you set on the builder are changed; the rest are left as they are.
    """

    class Operation(Enum):
        """The settings calls, with the type ``execute()`` returns."""

        GET_SETTINGS = "GET_SETTINGS"
        """Reads an account's settings; needs account_id. Returns ``SettingsResponse``."""
        UPDATE_SETTINGS = "UPDATE_SETTINGS"
        """Updates the settings that were set on the builder; needs account_id. Returns ``SettingsResponse``."""
        GET_OPTIONS = "GET_OPTIONS"
        """The providers and models that can be chosen. Returns ``dict``."""

    class Builder(MnemoClientBuilder):
        """Collects the call parameters for a :class:`MnemoSettingsClient`."""

        def __init__(self) -> None:
            super().__init__()
            self._operation: Optional[MnemoSettingsClient.Operation] = MnemoSettingsClient.Operation.GET_SETTINGS
            self._account_id: Optional[str] = None
            self._provider: Optional[str] = None
            self._model: Optional[str] = None
            self._ingest_model: Optional[str] = None
            self._provider_api_key: Optional[str] = None
            self._lookback_days: Optional[int] = None
            self._encrypt_data: Optional[bool] = None
            self._shared_memory_ttl_hours: Optional[int] = None

        def operation(self, operation: MnemoSettingsClient.Operation) -> MnemoSettingsClient.Builder:
            self._operation = operation
            return self

        def account_id(self, account_id: str) -> MnemoSettingsClient.Builder:
            self._account_id = account_id
            return self

        def provider(self, provider: str) -> MnemoSettingsClient.Builder:
            """The LLM provider to use for chat and ingest."""
            self._provider = provider
            return self

        def model(self, model: str) -> MnemoSettingsClient.Builder:
            self._model = model
            return self

        def ingest_model(self, ingest_model: str) -> MnemoSettingsClient.Builder:
            self._ingest_model = ingest_model
            return self

        def provider_api_key(self, provider_api_key: str) -> MnemoSettingsClient.Builder:
            """Your own LLM provider key (bring-your-own-key); distinct from ``api_key()``, which authenticates
            to MNEMO."""
            self._provider_api_key = provider_api_key
            return self

        def lookback_days(self, lookback_days: int) -> MnemoSettingsClient.Builder:
            self._lookback_days = lookback_days
            return self

        def encrypt_data(self, encrypt_data: bool) -> MnemoSettingsClient.Builder:
            self._encrypt_data = encrypt_data
            return self

        def shared_memory_ttl_hours(self, shared_memory_ttl_hours: int) -> MnemoSettingsClient.Builder:
            self._shared_memory_ttl_hours = shared_memory_ttl_hours
            return self

        def build(self) -> MnemoSettingsClient:
            from ._settings_impl import MnemoSettingsClientImpl

            return MnemoSettingsClientImpl(self)
