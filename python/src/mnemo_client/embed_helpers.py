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


"""Server-side helpers for the ``<mnemo-chat>`` component: :class:`EmbedSnippet` and :class:`EmbedTokenEndpoint`.

Both are framework-neutral and need nothing but the standard library: call them from a Flask or Django view, or any
other handler.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from html import escape
from typing import Callable, Optional, Union

from .embed import MnemoEmbedClient
from .exception import MnemoClientException
from ._abstract import _invalid, _is_blank


def default_script_url() -> str:
    """The jsDelivr URL of the component script of this exact client version."""
    from . import __version__

    return f"https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@{__version__}/embed/mnemo-chat.js"


class EmbedSnippet:
    """Renders the two lines of HTML that put a ``<mnemo-chat>`` on a page.

    Every attribute value is HTML-escaped, so a value that came from a request or a configuration file cannot break
    out of its attribute. Put the returned string in a template without escaping it again (``|safe`` in Django and
    Jinja, ``Markup`` in Flask).
    """

    @dataclass(frozen=True)
    class Options:
        """The snippet options. ``token_url`` (the page's own endpoint that returns the embed token, see
        :class:`EmbedTokenEndpoint`) is required; everything else is optional and left out when ``None``.
        ``width`` and ``height`` are a bare number (pixels, read by the component) or a CSS length such as ``50%``."""

        token_url: str
        script_url: Optional[str] = None
        base_url: Optional[str] = None
        width: Optional[str] = None
        height: Optional[str] = None
        theme: Optional[str] = None
        placeholder: Optional[str] = None
        session_id: Optional[str] = None
        locale: Optional[str] = None

    @staticmethod
    def render(options: Optional[EmbedSnippet.Options]) -> str:
        """Returns ``<script src="..." async></script>`` followed by ``<mnemo-chat ...></mnemo-chat>``.

        :raises MnemoClientException: ``INVALID_REQUEST`` when ``options`` or its token URL is missing
        """
        if options is None:
            raise _invalid("options is required")
        if _is_blank(options.token_url):
            raise _invalid("token_url is required")
        script_url = default_script_url() if _is_blank(options.script_url) else str(options.script_url)
        attributes = [("token-url", options.token_url), ("base-url", options.base_url), ("width", options.width),
                      ("height", options.height), ("theme", options.theme), ("placeholder", options.placeholder),
                      ("session-id", options.session_id), ("locale", options.locale)]
        parts = "".join(f' {name}="{_escape(str(value))}"' for name, value in attributes if value is not None)
        return f'<script src="{_escape(script_url)}" async></script>\n<mnemo-chat{parts}></mnemo-chat>'


def _escape(value: str) -> str:
    return escape(value, quote=True).replace("&#x27;", "&#39;")


class EmbedTokenEndpoint:
    """The framework-neutral body of the "give the page a token" endpoint that ``<mnemo-chat token-url="...">`` calls.

    The caller (a Flask or Django view, any handler) authenticates its own visitor first, then passes the visitor's
    id here and returns the string as ``application/json``. The result holds only ``token``, ``expiresAt``, ``tenantId`` and
    ``sessionPrefix``: never the API key and nothing else.
    """

    @staticmethod
    def handle(template: Union[MnemoEmbedClient.Builder, Callable[[], MnemoEmbedClient.Builder]],
               end_user_id: Optional[str]) -> str:
        """Mints a token for ``end_user_id`` (``None`` for an anonymous visitor) and returns the JSON the component
        expects.

        ``template`` is a builder with the credential, tenant_id and allowed_origin set, or a function that returns a
        fresh one (the safe form when requests are handled on several threads, since the end user is set on the
        builder).

        :raises MnemoClientException: when the call is invalid or the service refuses it
        """
        if template is None:
            raise _invalid("template is required")
        builder = template() if callable(template) else template
        token = builder.end_user_id(end_user_id).operation(MnemoEmbedClient.Operation.MINT_TOKEN).build().execute()
        expires_at = token.expires_at.isoformat().replace("+00:00", "Z")
        return json.dumps({"token": token.token, "expiresAt": expires_at, "tenantId": token.tenant_id, "sessionPrefix": token.session_prefix},
                          separators=(",", ":")).replace("<", "\\u003c").replace(">", "\\u003e") \
            .replace("&", "\\u0026")


def bundled_script() -> bytes:
    """The bytes of the ``<mnemo-chat>`` web component, shipped in this package as ``mnemo_client/embed/mnemo-chat.js``
    (the same file as the npm package's ``embed/mnemo-chat.js``; a test checks the hashes match). Serve it from your
    own server instead of a CDN when you prefer, with content type ``text/javascript``, and point
    ``EmbedSnippet.Options(script_url=...)`` at that URL."""
    from importlib import resources
    return resources.files("mnemo_client").joinpath("embed", "mnemo-chat.js").read_bytes()
