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

"""Python client for the MNEMO API, the multi-tenant AI memory service from Panaxon AI.

Every client works the same way: a builder collects the parameters, ``build()`` gives you a client, and
``execute()`` makes the call and returns the result.
"""

from .chat import MnemoChatClient
from .client import MnemoClient, MnemoClientBuilder
from .exception import MnemoClientException, MnemoError
from .factory import MnemoClientFactory
from .model import (
    Attachment,
    ChatMessageResponse,
    RagQueryResponse,
    ResponseTiming,
    SettingsResponse,
    TokenUsage,
)
from .network import MnemoNetworkClient
from .rag import MnemoRAGClient
from .settings import MnemoSettingsClient

__version__ = "1.0.0"

__all__ = [
    "Attachment",
    "ChatMessageResponse",
    "MnemoChatClient",
    "MnemoClient",
    "MnemoClientBuilder",
    "MnemoClientException",
    "MnemoClientFactory",
    "MnemoError",
    "MnemoNetworkClient",
    "MnemoRAGClient",
    "MnemoSettingsClient",
    "RagQueryResponse",
    "ResponseTiming",
    "SettingsResponse",
    "TokenUsage",
]
