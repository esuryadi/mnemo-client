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

import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../examples/express-server.js";
import { EmbedSnippet } from "../src/index.js";
import { FakeMnemoServer } from "./FakeMnemoServer.js";

/** The examples are code that runs here, so the documentation that quotes them cannot rot. */
describe("examples/express-server.ts", () => {
    let mnemo: FakeMnemoServer;
    let server: Server;
    let base: string;

    beforeEach(async () => {
        mnemo = await FakeMnemoServer.start();
        mnemo.reply(200, '{"token":"mnemo_embed_abc","expiresAt":"2026-11-14T18:00:00Z","tenantId":"acme",'
            + '"sessionPrefix":"embed-0123456789abcdef-"}');
        const app = createApp({
            apiKey: "secret-api-key", tenantId: "acme", allowedOrigin: "https://app.example.com",
            baseUrl: mnemo.url(), currentUser: (req) => req.header("x-demo-user") ?? null,
        });
        server = await new Promise<Server>((resolve) => {
            const s = app.listen(0, "127.0.0.1", () => resolve(s));
        });
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await mnemo.close();
    });

    it("serves a page carrying the snippet", async () => {
        const html = await (await fetch(base + "/")).text();
        expect(html).toContain(EmbedSnippet.render({ tokenUrl: "/mnemo/embed-token", width: "50%", height: 600 }));
        expect(html).not.toContain("secret-api-key");
    });

    it("the token endpoint returns only what the component needs, for the signed-in user", async () => {
        const reply = await fetch(base + "/mnemo/embed-token", { headers: { "x-demo-user": "user-42" } });
        expect(reply.status).toBe(200);
        expect(reply.headers.get("content-type")).toContain("application/json");
        expect(reply.headers.get("cache-control")).toBe("no-store");
        const text = await reply.text();
        expect(Object.keys(JSON.parse(text))).toEqual(["token", "expiresAt", "tenantId", "sessionPrefix"]);
        expect(text).not.toContain("secret-api-key");
        expect(JSON.parse(mnemo.last().body)).toEqual({
            tenantId: "acme", allowedOrigin: "https://app.example.com", endUserId: "user-42",
        });
        expect(mnemo.last().token).toBe("secret-api-key");
    });

    it("refuses a visitor who is not signed in, without calling MNEMO", async () => {
        const reply = await fetch(base + "/mnemo/embed-token");
        expect(reply.status).toBe(401);
        expect(mnemo.count()).toBe(0);
    });

    it("hides MNEMO's own error from the browser", async () => {
        mnemo.reply(403, '{"error":"tenant acme has no ADMIN token for secret-api-key"}');
        const reply = await fetch(base + "/mnemo/embed-token", { headers: { "x-demo-user": "u" } });
        expect(reply.status).toBe(502);
        expect(await reply.text()).not.toContain("secret-api-key");
    });

    it("passes a rate limit on as 429", async () => {
        mnemo.reply(429, '{"error":"slow"}');
        const reply = await fetch(base + "/mnemo/embed-token", { headers: { "x-demo-user": "u" } });
        expect(reply.status).toBe(429);
    });
});

describe("examples/plain-html/index.html", () => {
    const page = readFileSync(new URL("../examples/plain-html/index.html", import.meta.url), "utf8");

    it("holds exactly the snippet EmbedSnippet renders, apart from the version in the script URL", () => {
        const script = /<script src="([^"]+)" async><\/script>/.exec(page)![1]!;
        expect(script).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/@panaxon\/mnemo-client@\d+\.\d+\.\d+\/embed\/mnemo-chat\.js$/);
        const rendered = EmbedSnippet.render({ tokenUrl: "/mnemo/embed-token", width: "50%", height: 600, scriptUrl: script });
        expect(page.replace(/^[ \t]+/gm, "")).toContain(rendered);
    });
});
