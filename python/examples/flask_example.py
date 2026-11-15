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


"""A Flask integration, written so it imports without Flask installed: the view logic takes the request values as
parameters and returns what Flask accepts from a view, a ``(body, status, headers)`` tuple.

In a real app::

    from flask import Flask
    from flask_login import current_user   # or however you know who is signed in
    from flask_example import chat_page, embed_token

    app = Flask(__name__)

    @app.get("/mnemo/embed-token")
    def token():
        return embed_token(str(current_user.get_id()) if current_user.is_authenticated else None)

    @app.get("/chat")
    def chat():
        return chat_page()

Configuration comes from the environment: ``MNEMO_API_KEY``, ``MNEMO_TENANT_ID``, ``MNEMO_ALLOWED_ORIGIN`` and,
optionally, ``MNEMO_BASE_URL``. The API key never reaches the page.
"""

from __future__ import annotations

import json
import os
from typing import Dict, Optional, Tuple

from mnemo_client import EmbedSnippet, EmbedTokenEndpoint, MnemoClientException, MnemoEmbedClient

JSON_HEADERS = {"Content-Type": "application/json", "Cache-Control": "no-store"}


def _template() -> MnemoEmbedClient.Builder:
    """A fresh builder per request, so concurrent requests never share one."""
    builder = MnemoEmbedClient.Builder() \
        .api_key(os.environ["MNEMO_API_KEY"]) \
        .tenant_id(os.environ["MNEMO_TENANT_ID"]) \
        .allowed_origin(os.environ["MNEMO_ALLOWED_ORIGIN"])
    if os.environ.get("MNEMO_BASE_URL"):
        builder.base_url(os.environ["MNEMO_BASE_URL"])
    return builder


def embed_token(signed_in_user_id: Optional[str]) -> Tuple[str, int, Dict[str, str]]:
    """The view behind ``token-url``. ``signed_in_user_id`` is ``None`` when the visitor is not signed in, which is
    refused: this endpoint hands out a credential, so it must sit behind your own login."""
    if signed_in_user_id is None:
        return json.dumps({"error": "sign in first"}), 401, JSON_HEADERS
    try:
        return EmbedTokenEndpoint.handle(_template, signed_in_user_id), 200, JSON_HEADERS
    except MnemoClientException:
        return json.dumps({"error": "could not get a chat token"}), 502, JSON_HEADERS


def chat_page() -> str:
    """A page that embeds the component."""
    return "<!doctype html><title>Chat</title>" + EmbedSnippet.render(
        EmbedSnippet.Options(token_url="/mnemo/embed-token", width="50%", height="600"))
