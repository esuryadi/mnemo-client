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

"""The error raised by every client: :class:`MnemoClientException`, carrying a :class:`MnemoError`."""

from __future__ import annotations

from enum import Enum
from typing import Optional


class MnemoError:
    """A structured client error: a :class:`MnemoError.Code` and the message to show.

    When no message is given, the code's default message is used.
    """

    class Code(Enum):
        """The error codes. ``code`` is the stable ``MNERR-xxxx`` identifier."""

        UNDEFINED_ERROR = ("MNERR-0000", "Undefined error")
        INVALID_REQUEST = ("MNERR-0001", "Invalid request")
        MISSING_API_KEY = ("MNERR-0002", "API key is required")
        UNAUTHORIZED = ("MNERR-0401", "Missing or invalid API key")
        FORBIDDEN = ("MNERR-0403", "Access denied or plan does not include this feature")
        NOT_FOUND = ("MNERR-0404", "Resource not found")
        RATE_LIMITED = ("MNERR-0429", "Rate limit or quota exceeded")
        SERVER_ERROR = ("MNERR-0500", "MNEMO server error")
        IO_ERROR = ("MNERR-0600", "Unable to reach the MNEMO service")
        SERIALIZATION_ERROR = ("MNERR-0601", "Unable to read the MNEMO response")
        INIT_FAILED = ("MNERR-0700", "Session initialization failed")

        def __init__(self, code: str, default_message: str) -> None:
            self.code = code
            self.default_message = default_message

    def __init__(self, code: MnemoError.Code, message: Optional[str] = None) -> None:
        self.code = code
        self.message = code.default_message if message is None else message

    def __repr__(self) -> str:
        return f"MnemoError({self.code.name}, {self.message!r})"


class MnemoClientException(Exception):
    """Raised for every client failure.

    ``error`` is the structured :class:`MnemoError`; ``http_status`` is the HTTP status returned by the MNEMO
    service, or ``0`` when no response was received.
    """

    def __init__(self, error: MnemoError, http_status: int = 0) -> None:
        super().__init__(error.message)
        self.error = error
        self.http_status = http_status

    @property
    def message(self) -> str:
        return self.error.message
