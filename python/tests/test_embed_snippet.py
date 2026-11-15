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


"""Tests for EmbedSnippet."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

import mnemo_client
from mnemo_client import EmbedSnippet, MnemoClientException, MnemoError


class EmbedSnippetTest(unittest.TestCase):

    def test_renders_the_script_and_the_element_with_the_default_script_url_of_this_version(self) -> None:
        html = EmbedSnippet.render(EmbedSnippet.Options("/mnemo/embed-token"))
        self.assertEqual('<script src="https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@' + mnemo_client.__version__
                         + '/embed/mnemo-chat.js" async></script>\n<mnemo-chat token-url="/mnemo/embed-token">'
                         "</mnemo-chat>", html)

    def test_the_default_url_takes_the_version_from_the_package(self) -> None:
        source = (Path(mnemo_client.__file__).parent / "__init__.py").read_text()
        match = re.search(r'__version__ = "([^"]+)"', source)
        assert match is not None
        self.assertIn("@panaxon/mnemo-client@" + match.group(1) + "/", EmbedSnippet.render(EmbedSnippet.Options("/t")))

    def test_renders_every_option_in_order(self) -> None:
        html = EmbedSnippet.render(EmbedSnippet.Options(
            "/t", script_url="/static/mnemo-chat.js", base_url="https://mnemo.example.com/api", width="50%",
            height="600", theme="dark", placeholder="Ask me", session_id="embed-anon-1", locale="fr"))
        self.assertEqual('<script src="/static/mnemo-chat.js" async></script>\n<mnemo-chat token-url="/t" '
                         'base-url="https://mnemo.example.com/api" width="50%" height="600" theme="dark" '
                         'placeholder="Ask me" session-id="embed-anon-1" locale="fr"></mnemo-chat>', html)

    def test_escapes_every_attribute_value(self) -> None:
        evil = "\"><script>alert('x')</script>&"
        html = EmbedSnippet.render(EmbedSnippet.Options(evil, script_url=evil, base_url=evil, width=evil, height=evil,
                                                        theme=evil, placeholder=evil, session_id=evil, locale=evil))
        escaped = "&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;"
        self.assertNotIn("<script>alert", html)
        self.assertEqual(4, html.count("<"))  # only the two elements' own tags
        self.assertEqual(9, html.count(escaped))
        self.assertTrue(html.startswith('<script src="' + escaped + '" async></script>\n<mnemo-chat token-url="'))
        self.assertTrue(html.endswith("></mnemo-chat>"))

    def test_the_token_url_is_required(self) -> None:
        with self.assertRaises(MnemoClientException) as raised:
            EmbedSnippet.render(EmbedSnippet.Options(" "))
        self.assertIs(MnemoError.Code.INVALID_REQUEST, raised.exception.error.code)
        self.assertIn("token_url", str(raised.exception))
        with self.assertRaises(MnemoClientException):
            EmbedSnippet.render(None)
