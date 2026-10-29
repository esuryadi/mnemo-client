/*
 * Copyright (c) 2026, PANAXON.AI, LLC. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Multi-Dimensional Neural Elastic Memory Organization (MNEMO) - TypeScript client.
 *
 * Inventor: Edward Suryadi
 * Assignee: PANAXON.AI, LLC
 *
 * Author: edward.suryadi
 * Since: Oct-2026
 */

// Uses the published package the way a consumer would; run by verify-npm.sh. Mirrors java/smoke-test/SmokeTest.java.
import {
    type JsonObject,
    type MnemoClient,
    MnemoChatClient,
    MnemoClientException,
    MnemoError,
    MnemoNetworkClient,
    MnemoRAGClient,
    MnemoSettingsClient,
} from "@panaxon/mnemo-client";

let failures = 0;

function check(what: string, ok: boolean): void {
    console.log((ok ? "  ok    " : "  FAIL  ") + what);
    if (!ok) failures++;
}

const key = process.env.MNEMO_API_KEY;
const baseUrl = process.env.MNEMO_BASE_URL;

// every client can be built from its public builder, and only the interface type is needed
const built: MnemoClient[] = [
    new MnemoChatClient.Builder().apiKey("k").build(),
    new MnemoRAGClient.Builder().apiKey("k").build(),
    new MnemoSettingsClient.Builder().apiKey("k").build(),
    new MnemoNetworkClient.Builder().apiKey("k").build(),
];
check("all four clients build", built.length === 4);

// a missing parameter is refused locally, with the structured error
try {
    await new MnemoChatClient.Builder().apiKey("k").build().execute();
    check("missing parameters are refused", false);
} catch (e) {
    check("missing parameters are refused",
        e instanceof MnemoClientException && e.error.code === MnemoError.Code.INVALID_REQUEST);
}

// live: the service answers a health check through the real HTTP stack
try {
    const health = new MnemoChatClient.Builder()
        .apiKey(key ?? "smoke-test")
        .operation(MnemoChatClient.Operation.HEALTH);
    if (baseUrl) health.baseUrl(baseUrl);
    const result = await health.build().execute<JsonObject>();
    check("service health is ok", result.status === "ok");
} catch (e) {
    check(`service health is ok (${e})`, false);
}

// live: a bad key comes back as HTTP 401 with the matching error code
try {
    const bad = new MnemoChatClient.Builder()
        .apiKey("not-a-real-token").tenantId("nobody")
        .operation(MnemoChatClient.Operation.LIST_SUBJECTS);
    if (baseUrl) bad.baseUrl(baseUrl);
    await bad.build().execute();
    check("a bad key is rejected", false);
} catch (e) {
    const status = e instanceof MnemoClientException ? e.httpStatus : `${e}`;
    check(`a bad key is rejected as 401 (${status})`,
        e instanceof MnemoClientException && e.httpStatus === 401 && e.error.code === MnemoError.Code.UNAUTHORIZED);
}

console.log(failures === 0 ? "SMOKE TEST PASSED" : `SMOKE TEST FAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
