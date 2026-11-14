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
 * Since: Nov-2026
 */
// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { MnemoChatClient, MnemoClientException, MnemoError } from "../src/index.js";

/** In a browser page the API key and client secret would be visible to every visitor, so the setters refuse them. */
describe("running in a browser", () => {
    it("this test runs where window and document exist", () => {
        expect(typeof window).toBe("object");
        expect(typeof document).toBe("object");
    });

    it("apiKey is refused", () => {
        const call = () => new MnemoChatClient.Builder().apiKey("secret");
        expect(call).toThrow(MnemoClientException);
        try {
            call();
        } catch (e) {
            expect((e as MnemoClientException).error.code).toBe(MnemoError.Code.INVALID_REQUEST);
            expect((e as MnemoClientException).message).toContain("embedToken");
        }
    });

    it("clientCredentials is refused", () => {
        expect(() => new MnemoChatClient.Builder().clientCredentials("id", "secret")).toThrow(MnemoClientException);
    });

    it("embedToken, baseUrl and the other setters are fine", () => {
        expect(() => new MnemoChatClient.Builder().embedToken("t").baseUrl("https://x.example").tenantId("a")
            .sessionId("s").timeout(5)).not.toThrow();
    });

    it("allowApiKeyInBrowser(true), called first, lifts the refusal", () => {
        expect(() => new MnemoChatClient.Builder().allowApiKeyInBrowser(true).apiKey("k")
            .clientCredentials("id", "s")).not.toThrow();
    });

    it("allowApiKeyInBrowser(true) called after apiKey is too late: apiKey already threw", () => {
        expect(() => new MnemoChatClient.Builder().apiKey("k").allowApiKeyInBrowser(true)).toThrow(MnemoClientException);
    });

    it("allowApiKeyInBrowser(false) keeps the refusal", () => {
        expect(() => new MnemoChatClient.Builder().allowApiKeyInBrowser(false).apiKey("k")).toThrow(MnemoClientException);
    });
});
