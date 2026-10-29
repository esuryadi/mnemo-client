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
import {
    type MnemoClient,
    MnemoChatClient,
    MnemoError,
    MnemoNetworkClient,
    MnemoRAGClient,
    MnemoSettingsClient,
} from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

/**
 * Every operation of every client, called with an API key and endpoint but no other parameter: each one that has
 * a required parameter must refuse with INVALID_REQUEST before any request is sent. Guards against a new
 * operation being added without its validation.
 */
describe("operation validation", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    async function assertRefusedBeforeSending(what: string, client: MnemoClient) {
        const before = server.count();
        const e = await rejection(() => client.execute());
        expect(e.error.code, `${what}: ${e.message}`).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(server.count(), `${what} sent a request`).toBe(before);
    }

    async function assertSends(what: string, client: MnemoClient) {
        const before = server.count();
        await client.execute();
        expect(server.count(), what).toBe(before + 1);
    }

    it("every chat operation checks its required parameters", async () => {
        const needNothing = new Set([MnemoChatClient.Operation.HEALTH]);
        for (const op of Object.values(MnemoChatClient.Operation)) {
            const client = new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url()).operation(op).build();
            if (needNothing.has(op)) await assertSends(`chat ${op}`, client);
            else await assertRefusedBeforeSending(`chat ${op}`, client);
        }
    });

    it("every settings operation checks its required parameters", async () => {
        const needNothing = new Set([MnemoSettingsClient.Operation.GET_OPTIONS]);
        for (const op of Object.values(MnemoSettingsClient.Operation)) {
            const client = new MnemoSettingsClient.Builder().apiKey("k").baseUrl(server.url()).operation(op).build();
            if (needNothing.has(op)) await assertSends(`settings ${op}`, client);
            else await assertRefusedBeforeSending(`settings ${op}`, client);
        }
    });

    it("every network operation checks its required parameters", async () => {
        const needNothing = new Set([MnemoNetworkClient.Operation.BROWSE_PUBLIC_REGISTRY]);
        for (const op of Object.values(MnemoNetworkClient.Operation)) {
            const client = new MnemoNetworkClient.Builder().apiKey("k").baseUrl(server.url()).operation(op).build();
            if (needNothing.has(op)) await assertSends(`network ${op}`, client);
            else await assertRefusedBeforeSending(`network ${op}`, client);
        }
    });

    it("rag query checks its required parameters", async () => {
        await assertRefusedBeforeSending("rag QUERY", new MnemoRAGClient.Builder().apiKey("k").baseUrl(server.url()).build());
    });

    it("blank required values are refused like missing ones", async () => {
        await assertRefusedBeforeSending("blank sessionId", new MnemoChatClient.Builder().apiKey("k")
            .baseUrl(server.url()).tenantId("acme").sessionId("   ").message("hi").build());
    });

    it("a missing or blank API key or endpoint is refused for every client", async () => {
        const clients: MnemoClient[] = [
            new MnemoChatClient.Builder().baseUrl(server.url()).operation(MnemoChatClient.Operation.HEALTH).build(),
            new MnemoRAGClient.Builder().apiKey(" ").baseUrl(server.url()).ragId("r").query("q").build(),
            new MnemoSettingsClient.Builder().baseUrl(server.url())
                .operation(MnemoSettingsClient.Operation.GET_OPTIONS).build(),
            new MnemoNetworkClient.Builder().baseUrl(server.url())
                .operation(MnemoNetworkClient.Operation.BROWSE_PUBLIC_REGISTRY).build(),
        ];
        for (const client of clients) {
            expect((await rejection(() => client.execute())).error.code).toBe(MnemoError.Code.MISSING_API_KEY);
        }
        await assertRefusedBeforeSending("no endpoint", new MnemoChatClient.Builder().apiKey("k").baseUrl(" ")
            .operation(MnemoChatClient.Operation.HEALTH).build());
        expect(server.count()).toBe(0);
    });

    it("a negative or non-numeric timeout is refused, and zero means none", async () => {
        await assertRefusedBeforeSending("negative timeout", new MnemoChatClient.Builder().apiKey("k")
            .baseUrl(server.url()).timeout(-1).operation(MnemoChatClient.Operation.HEALTH).build());
        await assertRefusedBeforeSending("NaN timeout", new MnemoChatClient.Builder().apiKey("k")
            .baseUrl(server.url()).timeout(Number.NaN).operation(MnemoChatClient.Operation.HEALTH).build());
        await assertSends("no timeout", new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url())
            .timeout(0).operation(MnemoChatClient.Operation.HEALTH).build());
        await assertSends("5s timeout", new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url())
            .timeout(5000).operation(MnemoChatClient.Operation.HEALTH).build());
    });
});
