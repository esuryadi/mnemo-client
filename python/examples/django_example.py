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


"""A Django integration, written so it imports without Django installed: the view logic takes the request values as
parameters and returns ``(status, content_type, body)``, which a two-line view turns into an ``HttpResponse``.

In a real project::

    from django.http import HttpResponse
    from django_example import chat_page, embed_token

    def token_view(request):
        user_id = str(request.user.pk) if request.user.is_authenticated else None
        status, content_type, body = embed_token(user_id)
        return HttpResponse(body, status=status, content_type=content_type)

    def chat_view(request):
        return HttpResponse(chat_page())   # already HTML; do not run it through an auto-escaping template

    # urls.py: path("mnemo/embed-token", token_view), path("chat", chat_view)

Configuration comes from the Django settings in a real project; here from the environment (``MNEMO_API_KEY``,
``MNEMO_TENANT_ID``, ``MNEMO_ALLOWED_ORIGIN``, optionally ``MNEMO_BASE_URL``). The API key never reaches the page.
"""

from __future__ import annotations

import json
import os
from typing import Tuple

from mnemo_client import EmbedSnippet, EmbedTokenEndpoint, MnemoClientException, MnemoEmbedClient

CONTENT_TYPE = "application/json"


def _template() -> MnemoEmbedClient.Builder:
    builder = MnemoEmbedClient.Builder() \
        .api_key(os.environ["MNEMO_API_KEY"]) \
        .tenant_id(os.environ["MNEMO_TENANT_ID"]) \
        .allowed_origin(os.environ["MNEMO_ALLOWED_ORIGIN"])
    if os.environ.get("MNEMO_BASE_URL"):
        builder.base_url(os.environ["MNEMO_BASE_URL"])
    return builder


def embed_token(signed_in_user_id: "str | None") -> Tuple[int, str, str]:
    """The view behind ``token-url``; ``None`` means the visitor is not signed in, which is refused."""
    if signed_in_user_id is None:
        return 401, CONTENT_TYPE, json.dumps({"error": "sign in first"})
    try:
        return 200, CONTENT_TYPE, EmbedTokenEndpoint.handle(_template, signed_in_user_id)
    except MnemoClientException:
        return 502, CONTENT_TYPE, json.dumps({"error": "could not get a chat token"})


def chat_page() -> str:
    """A page that embeds the component."""
    return "<!doctype html><title>Chat</title>" + EmbedSnippet.render(
        EmbedSnippet.Options(token_url="/mnemo/embed-token", width="50%", height="600"))
