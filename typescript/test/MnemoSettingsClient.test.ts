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
import { type JsonObject, MnemoSettingsClient, type SettingsResponse } from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

const SETTINGS = `{"accountId":"acct-1","provider":"anthropic","model":"m","ingestModel":"i","hasApiKey":true,
    "lookbackDays":30,"encryptData":true,"sharedMemoryTtlHours":24,"updatedAt":"2026-10-01T00:00:00Z"}`;

describe("MnemoSettingsClient", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const builder = () => new MnemoSettingsClient.Builder().apiKey("tok-1").baseUrl(server.url());

    it("get settings is the default operation", async () => {
        server.reply(200, SETTINGS);
        const s = await builder().accountId("acct-1").build().execute<SettingsResponse>();
        expect(s.lookbackDays).toBe(30);
        expect(s.hasApiKey).toBe(true);
        expect(server.last().method).toBe("GET");
        expect(server.last().path).toBe("/mnemo/account/acct-1/settings");
    });

    it("update sends only the settings that were set", async () => {
        server.reply(200, SETTINGS);
        await builder().accountId("acct-1").operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
            .lookbackDays(30).encryptData(false).providerApiKey("sk-own").build().execute();
        expect(server.last().method).toBe("PUT");
        expect(JSON.parse(server.last().body)).toEqual({ apiKey: "sk-own", lookbackDays: 30, encryptData: false });
    });

    it("options do not need an account", async () => {
        server.reply(200, `{"providers":["anthropic"]}`);
        const options = await builder().operation(MnemoSettingsClient.Operation.GET_OPTIONS)
            .build().execute<JsonObject>();
        expect(options.providers).toBeDefined();
        expect(server.last().path).toBe("/mnemo/account/settings/options");
    });

    it("account id is required", async () => {
        await rejection(() => builder().build().execute());
        expect(server.count()).toBe(0);
    });
});
