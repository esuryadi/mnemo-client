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
import { type EmbedToken, MnemoEmbedClient, MnemoError } from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

const Op = MnemoEmbedClient.Operation;
const REPLY = '{"token":"mnemo_embed_abc","expiresAt":"2026-11-14T18:00:00Z","tenantId":"acme",'
    + '"sessionPrefix":"embed-0123456789abcdef-","someFutureField":1}';

describe("MnemoEmbedClient MINT_TOKEN", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const builder = () => new MnemoEmbedClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme")
        .allowedOrigin("https://app.example.com");

    it("posts every parameter as JSON and parses the token", async () => {
        server.reply(200, REPLY);
        const token = await builder().endUserId("user-42").ttlSeconds(600).build().execute<EmbedToken>();
        const r = server.last();
        expect([r.method, r.path, r.query, r.token]).toEqual(["POST", "/mnemo/embed/token", null, "tok-1"]);
        expect(JSON.parse(r.body)).toEqual({
            tenantId: "acme", allowedOrigin: "https://app.example.com", endUserId: "user-42", ttlSeconds: 600,
        });
        expect(token.token).toBe("mnemo_embed_abc");
        expect(token.expiresAt).toBe("2026-11-14T18:00:00Z");
        expect(token.tenantId).toBe("acme");
        expect(token.sessionPrefix).toBe("embed-0123456789abcdef-");
    });

    it("omits the optional parameters that are not set", async () => {
        server.reply(200, REPLY);
        await builder().build().execute();
        expect(server.last().body).toBe('{"tenantId":"acme","allowedOrigin":"https://app.example.com"}');
    });

    it("the default operation is MINT_TOKEN", async () => {
        server.reply(200, REPLY);
        await new MnemoEmbedClient.Builder().apiKey("k").baseUrl(server.url()).tenantId("acme")
            .allowedOrigin("http://localhost:3000").build().execute();
        expect(server.last().path).toBe("/mnemo/embed/token");
    });

    it("works with client credentials", async () => {
        server.replyOn("/oauth/token", [200, '{"access_token":"a","expires_in":3600}']);
        server.replyOn("/mnemo/embed/token", [200, REPLY]);
        const b = new MnemoEmbedClient.Builder().clientCredentials("cid", "cs").baseUrl(server.url())
            .tenantId("acme").allowedOrigin("https://app.example.com");
        await b.build().execute();
        expect(server.last().authorization).toBe("Bearer a");
        expect(server.last().token).toBeUndefined();
    });

    it("tolerates a reply without tenantId by using the requested one", async () => {
        server.reply(200, '{"token":"t","expiresAt":"2026-11-14T18:00:00Z","sessionPrefix":"embed-anon-"}');
        expect((await builder().build().execute<EmbedToken>()).tenantId).toBe("acme");
    });

    it("a reply without a token is a serialization error", async () => {
        server.reply(200, '{"expiresAt":"2026-11-14T18:00:00Z","sessionPrefix":"embed-anon-"}');
        const e = await rejection(() => builder().build().execute());
        expect(e.error.code).toBe(MnemoError.Code.SERIALIZATION_ERROR);
    });

    it("maps the service errors", async () => {
        for (const [status, code] of [[400, MnemoError.Code.INVALID_REQUEST], [401, MnemoError.Code.UNAUTHORIZED],
            [403, MnemoError.Code.FORBIDDEN], [429, MnemoError.Code.RATE_LIMITED]] as const) {
            server.reply(status, '{"error":"nope"}');
            const e = await rejection(() => builder().build().execute());
            expect([e.error.code, e.httpStatus, e.message]).toEqual([code, status, "nope"]);
        }
    });

    describe("validation happens before anything is sent", () => {
        const refused = async (b: MnemoEmbedClient.Builder, fragment: string) => {
            const e = await rejection(() => b.build().execute());
            expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
            expect(e.message).toContain(fragment);
            expect(server.count()).toBe(0);
        };

        it("tenantId is required", async () => {
            await refused(new MnemoEmbedClient.Builder().apiKey("k").baseUrl(server.url())
                .allowedOrigin("https://a.example"), "tenantId");
        });

        it("allowedOrigin is required", async () => {
            await refused(new MnemoEmbedClient.Builder().apiKey("k").baseUrl(server.url()).tenantId("acme"), "allowedOrigin");
        });

        it.each([
            "app.example.com", "https://app.example.com/", "https://app.example.com/path", "https://app.example.com?x=1",
            "https://*.example.com", "*", "http://app.example.com", "ftp://app.example.com", "https://user@app.example.com",
            "https://app.example.com:", "https://app.example.com:123456", "https://", "https://-bad", " https://a.example",
            "https://a.example, https://b.example", "http://localhost/", "http://[::1]:3000", "javascript:alert(1)",
        ])("allowedOrigin %j is refused", async (origin) => {
            await refused(builder().allowedOrigin(origin), "allowedOrigin");
        });

        it.each([
            "https://app.example.com", "https://app.example.com:8443", "https://a", "http://localhost",
            "http://localhost:3000", "http://127.0.0.1:8080",
        ])("allowedOrigin %j is accepted", async (origin) => {
            server.reply(200, REPLY);
            await builder().allowedOrigin(origin).build().execute();
            expect(JSON.parse(server.last().body).allowedOrigin).toBe(origin);
        });

        it.each([59, 901, 0, -1, 60.5, Number.NaN])("ttlSeconds %j is refused", async (ttl) => {
            await refused(builder().ttlSeconds(ttl), "ttlSeconds");
        });

        it.each([60, 900])("ttlSeconds %j is accepted", async (ttl) => {
            server.reply(200, REPLY);
            await builder().ttlSeconds(ttl).build().execute();
            expect(JSON.parse(server.last().body).ttlSeconds).toBe(ttl);
        });

        it.each(["", "has space", "a/b", "a".repeat(129), "emoji\u{1F600}", "semi;colon"])(
            "endUserId %j is refused", async (id) => {
                await refused(builder().endUserId(id), "endUserId");
            });

        it.each(["u", "user-42", "a.b_c@d-e", "a".repeat(128)])("endUserId %j is accepted", async (id) => {
            server.reply(200, REPLY);
            await builder().endUserId(id).build().execute();
            expect(JSON.parse(server.last().body).endUserId).toBe(id);
        });

        it("an embed token cannot mint", async () => {
            await refused(new MnemoEmbedClient.Builder().embedToken("mnemo_embed_x").baseUrl(server.url())
                .tenantId("acme").allowedOrigin("https://a.example"), "embed token cannot mint");
        });

        it("no credential at all is MISSING_API_KEY", async () => {
            const e = await rejection(() => new MnemoEmbedClient.Builder().baseUrl(server.url()).tenantId("acme")
                .allowedOrigin("https://a.example").build().execute());
            expect(e.error.code).toBe(MnemoError.Code.MISSING_API_KEY);
        });

        it("an unknown operation is refused", async () => {
            await refused(builder().operation("NOPE" as MnemoEmbedClient.Operation), "unknown operation");
        });
    });
});
