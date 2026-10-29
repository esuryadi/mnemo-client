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

"""Uses the installed package the way a consumer would; run by verify-pypi.sh. Mirrors java/smoke-test/SmokeTest.java."""

import os
import sys

from mnemo_client import (MnemoChatClient, MnemoClient, MnemoClientException, MnemoError, MnemoNetworkClient,
                          MnemoRAGClient, MnemoSettingsClient)

failures = 0


def check(what, ok):
    global failures
    print(("  ok    " if ok else "  FAIL  ") + what)
    if not ok:
        failures += 1


key = os.environ.get("MNEMO_API_KEY")
base_url = os.environ.get("MNEMO_BASE_URL")

# every client can be built from its public builder, and only the interface type is needed
built = [MnemoChatClient.Builder().api_key("k").build(),
         MnemoRAGClient.Builder().api_key("k").build(),
         MnemoSettingsClient.Builder().api_key("k").build(),
         MnemoNetworkClient.Builder().api_key("k").build()]
check("all four clients build", len(built) == 4 and all(isinstance(c, MnemoClient) for c in built))

# a missing parameter is refused locally, with the structured error
try:
    MnemoChatClient.Builder().api_key("k").build().execute()
    check("missing parameters are refused", False)
except MnemoClientException as e:
    check("missing parameters are refused", e.error.code is MnemoError.Code.INVALID_REQUEST)

# live: the service answers a health check through the real HTTP stack
try:
    health = MnemoChatClient.Builder().api_key(key or "smoke-test").operation(MnemoChatClient.Operation.HEALTH)
    if base_url:
        health.base_url(base_url)
    result = health.build().execute()
    check("service health is ok", result.get("status") == "ok")
except Exception as e:  # noqa: BLE001 - any failure is a failed check
    check(f"service health is ok ({e!r})", False)

# live: a bad key comes back as HTTP 401 with the matching error code
try:
    bad = (MnemoChatClient.Builder().api_key("not-a-real-token").tenant_id("nobody")
           .operation(MnemoChatClient.Operation.LIST_SUBJECTS))
    if base_url:
        bad.base_url(base_url)
    bad.build().execute()
    check("a bad key is rejected", False)
except MnemoClientException as e:
    check(f"a bad key is rejected as 401 ({e.http_status})",
          e.http_status == 401 and e.error.code is MnemoError.Code.UNAUTHORIZED)

print("SMOKE TEST PASSED" if failures == 0 else f"SMOKE TEST FAILED: {failures} check(s)")
sys.exit(0 if failures == 0 else 1)
