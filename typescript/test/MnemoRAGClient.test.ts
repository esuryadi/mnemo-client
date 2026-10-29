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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MnemoError, MnemoRAGClient, type RagQueryResponse } from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

describe("MnemoRAGClient", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const builder = () => new MnemoRAGClient.Builder().apiKey("tok-1").baseUrl(server.url());

    it("query posts to the rag id and parses the answer", async () => {
        server.reply(200, `{"answer":"30 days","found":true,"source":"policy.pdf","authority":"HIGH","confidence":"HIGH",
            "lastUpdated":"2026-09-01T10:15:30Z","retrievalTier":"TARGETED","subjectsUsed":["Refunds"],
            "tokenUsage":{"inputTokens":50,"outputTokens":9}}`);

        const r = await builder().ragId("support-kb").query("Refund window?")
            .additionalContext(["annual plans"]).build().execute<RagQueryResponse>();

        expect(r.found).toBe(true);
        expect(r.answer).toBe("30 days");
        expect(r.lastUpdated).toBe("2026-09-01T10:15:30Z");
        expect(r.subjectsUsed).toEqual(["Refunds"]);
        const req = server.last();
        expect(req.method).toBe("POST");
        expect(req.path).toBe("/mnemo/rag/support-kb");
        expect(req.token).toBe("tok-1");
        expect(JSON.parse(req.body)).toEqual({ query: "Refund window?", additionalContext: ["annual plans"] });
    });

    it("additional context is omitted when not set", async () => {
        server.reply(200, `{"answer":"x","found":false}`);
        await builder().ragId("kb").query("q").build().execute();
        expect(JSON.parse(server.last().body)).toEqual({ query: "q" });
    });

    it("rag id and query are required", async () => {
        expect((await rejection(() => builder().query("q").build().execute())).error.code)
            .toBe(MnemoError.Code.INVALID_REQUEST);
        expect((await rejection(() => builder().ragId("kb").build().execute())).error.code)
            .toBe(MnemoError.Code.INVALID_REQUEST);
        expect(server.count()).toBe(0);
    });

    it("a plan-gated tenant gets forbidden", async () => {
        server.reply(403, `{"error":"MnemoRAG requires a Pro plan"}`);
        const e = await rejection(() => builder().ragId("kb").query("q").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.FORBIDDEN);
        expect(e.message).toBe("MnemoRAG requires a Pro plan");
    });
});
