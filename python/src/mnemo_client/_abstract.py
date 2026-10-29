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

"""The plumbing shared by every client implementation (not part of the public API)."""

from __future__ import annotations

import http.client
import json
import re
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, NamedTuple, Optional, TypeVar
from urllib.parse import quote

from .client import MnemoClient, MnemoClientBuilder
from .exception import MnemoClientException, MnemoError

TOKEN_HEADER = "X-Mnemo-Api-Token"

T = TypeVar("T")


class SseEvent(NamedTuple):
    """One server-sent event: its name (``message`` when none was given) and its data."""

    name: str
    data: str


class AbstractMnemoClient(MnemoClient):
    """Validates the builder settings, calls the MNEMO REST API through ``urllib`` and translates HTTP failures
    into :class:`MnemoClientException`. Nothing is kept between calls, so instances hold no connections and are
    thread-safe.
    """

    def __init__(self, builder: MnemoClientBuilder) -> None:
        self._settings = builder

    def _with_target(self, call: Callable[[str], T]) -> T:
        """Runs ``call`` with the service base URL after validating the builder settings."""
        settings = self._settings
        if _is_blank(settings._api_key):
            raise MnemoClientException(MnemoError(MnemoError.Code.MISSING_API_KEY))
        if _is_blank(settings._base_url):
            raise _invalid("base_url is required")
        timeout = settings._timeout
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not timeout >= 0:
            raise _invalid("timeout must be zero or positive")
        return call(str(settings._base_url).rstrip("/"))

    def _send(self, method: str, url: str, body: Optional[Dict[str, Any]] = None,
              convert: Optional[Callable[[Any], Any]] = None, expect_body: bool = True) -> Any:
        """Sends one request and parses the JSON reply, passed through ``convert`` when given.

        Returns ``None`` when ``expect_body`` is false, for a 204, or for an empty body.
        """
        text = self._request(method, url, "application/json", body)
        if not expect_body or not text:
            return None
        parsed = _parse_json(text)
        if convert is None:
            return parsed
        try:
            return convert(parsed)
        except (AttributeError, TypeError, ValueError) as e:
            raise MnemoClientException(MnemoError(MnemoError.Code.SERIALIZATION_ERROR)) from e

    def _send_event_stream(self, method: str, url: str, body: Dict[str, Any]) -> List[SseEvent]:
        """Sends one request that answers with a server-sent event stream and reads the stream to its end.

        The stream is finite for the calls that use this (it ends after a final event), so it is read whole.
        """
        return parse_events(self._request(method, url, "text/event-stream", body))

    def _request(self, method: str, url: str, accept: str, body: Optional[Dict[str, Any]]) -> str:
        headers = {"Accept": accept, TOKEN_HEADER: str(self._settings._api_key)}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        timeout = self._settings._timeout or None
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                if response.status == 204:
                    return ""
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            raise _failure(e.code, _read_error_body(e)) from None
        except (urllib.error.URLError, http.client.HTTPException, OSError) as e:
            raise MnemoClientException(MnemoError(MnemoError.Code.IO_ERROR)) from e

    def _tenant_id(self) -> Optional[str]:
        return self._settings._tenant_id


def parse_events(text: str) -> List[SseEvent]:
    events: List[SseEvent] = []
    name: Optional[str] = None
    data: List[str] = []
    is_open = False
    for line in re.split(r"\r?\n", text):
        if not line:
            if is_open:
                events.append(SseEvent(name or "message", "\n".join(data)))
            name, data, is_open = None, [], False
        elif not line.startswith(":"):
            field, colon, value = line.partition(":")
            if colon and value.startswith(" "):
                value = value[1:]
            if field == "event":
                name = value
                is_open = True
            elif field == "data":
                data.append(value)
                is_open = True
    if is_open:
        events.append(SseEvent(name or "message", "\n".join(data)))
    return events


def _parse_json(text: str) -> Any:
    try:
        return json.loads(text)
    except ValueError as e:
        raise MnemoClientException(MnemoError(MnemoError.Code.SERIALIZATION_ERROR)) from e


def _read_error_body(error: urllib.error.HTTPError) -> str:
    try:
        return error.read().decode("utf-8", errors="replace")
    except (OSError, http.client.HTTPException):
        return ""
    finally:
        error.close()


def _failure(status: int, text: str) -> MnemoClientException:
    if status == 401:
        code = MnemoError.Code.UNAUTHORIZED
    elif status == 403:
        code = MnemoError.Code.FORBIDDEN
    elif status == 404:
        code = MnemoError.Code.NOT_FOUND
    elif status == 429:
        code = MnemoError.Code.RATE_LIMITED
    elif status >= 500:
        code = MnemoError.Code.SERVER_ERROR
    else:
        code = MnemoError.Code.INVALID_REQUEST
    detail = None
    try:
        error = json.loads(text).get("error")
        detail = None if error is None else str(error)
    except (ValueError, AttributeError):
        pass  # the body was not the usual {"error": "..."} JSON; fall back to the code's default message
    return MnemoClientException(MnemoError(code, detail), status)


def _is_blank(value: Optional[str]) -> bool:
    return value is None or not str(value).strip()


def _require(value: Optional[str], name: str) -> str:
    if _is_blank(value):
        raise _invalid(f"{name} is required")
    return str(value)


def _invalid(message: str) -> MnemoClientException:
    return MnemoClientException(MnemoError(MnemoError.Code.INVALID_REQUEST, message))


def _body(**values: Any) -> Dict[str, Any]:
    """Builds a body dict that skips ``None`` values, so only the parameters the caller set are sent."""
    return {key: value for key, value in values.items() if value is not None}


def _query_value(value: Any) -> str:
    # str(True) is "True"; the service expects JSON-style booleans
    if isinstance(value, bool):
        return "true" if value else "false"
    return quote(str(value), safe="")


def _query(url: str, **params: Any) -> str:
    """Appends the query parameters whose value is not ``None``, in the order given."""
    parts = [f"{quote(key, safe='')}={_query_value(value)}" for key, value in params.items() if value is not None]
    return url if not parts else f"{url}?{'&'.join(parts)}"


def _path(base: str, template: str, **values: str) -> str:
    """Resolves the ``{name}`` placeholders of a path template, encoding each value as one path segment."""
    return base + "/" + re.sub(r"\{(\w+)}", lambda m: quote(values[m.group(1)], safe=""), template)
