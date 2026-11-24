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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MnemoChatClient, MnemoError } from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

describe("embedToken authentication", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const chat = () => new MnemoChatClient.Builder().baseUrl(server.url()).tenantId("acme").sessionId("embed-anon-1");

    it("is sent as X-Mnemo-Api-Token, with no Authorization header", async () => {
        server.reply(200, '{"entries":[],"hasMore":false}');
        await chat().embedToken("mnemo_embed_abc").operation(MnemoChatClient.Operation.GET_HISTORY).size(50).build().execute();
        const r = server.last();
        expect(r.token).toBe("mnemo_embed_abc");
        expect(r.authorization).toBeUndefined();
        expect([r.method, r.path, r.query]).toEqual(["GET", "/mnemo/sessions/embed-anon-1/history", "tenantId=acme&size=50"]);
    });

    it("is sent on the init stream too", async () => {
        server.reply(200, 'event: complete\ndata: {"totalMs":5}\n\n', "text/event-stream");
        await chat().embedToken("mnemo_embed_abc").operation(MnemoChatClient.Operation.INIT_SESSION).build().execute();
        expect(server.last().token).toBe("mnemo_embed_abc");
        expect(server.last().path).toBe("/mnemo/init/stream");
    });

    it("cannot be combined with an apiKey", async () => {
        const e = await rejection(() => chat().apiKey("k").embedToken("t").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(e.message).toContain("apiKey or embedToken");
        expect(server.count()).toBe(0);
    });

    it("cannot be combined with client credentials", async () => {
        const e = await rejection(() => chat().clientCredentials("cid", "cs").embedToken("t").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(e.message).toContain("clientCredentials or embedToken");
        expect(server.count()).toBe(0);
    });

    it("a blank embed token counts as none", async () => {
        const e = await rejection(() => chat().embedToken("  ").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.MISSING_API_KEY);
    });

    it("works on every client", async () => {
        server.reply(200, "{}");
        await new MnemoChatClient.Builder().embedToken("t2").baseUrl(server.url()).tenantId("acme")
            .operation(MnemoChatClient.Operation.LIST_SESSIONS).build().execute();
        expect(server.last().token).toBe("t2");
    });
});
