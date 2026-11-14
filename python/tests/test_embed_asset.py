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


"""The bundled component is the TypeScript build output, byte for byte."""
import hashlib
import os
import unittest

from mnemo_client.embed_helpers import bundled_script


class EmbedAssetTest(unittest.TestCase):
    def test_the_bundled_script_is_the_typescript_build_output(self) -> None:
        bundled = bundled_script()
        self.assertGreater(len(bundled), 1000)
        source = os.path.join(os.path.dirname(__file__), "..", "..", "typescript", "embed", "mnemo-chat.js")
        with open(source, "rb") as f:
            expected = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(expected, hashlib.sha256(bundled).hexdigest(),
                         "run: cp typescript/embed/mnemo-chat.js python/src/mnemo_client/embed/")

    def test_it_is_a_browser_script_not_a_module(self) -> None:
        text = bundled_script().decode("utf-8")
        self.assertIn("mnemo-chat", text)
        self.assertFalse(text.startswith("export "))
        self.assertNotIn("\nexport ", text)


if __name__ == "__main__":
    unittest.main()
