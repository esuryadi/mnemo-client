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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmbedSnippet, EmbedTokenEndpoint, MnemoEmbedClient, MnemoError } from "../src/index.js";
import { CLIENT_VERSION } from "../src/version.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

const MINT = '{"token":"mnemo_embed_abc","expiresAt":"2026-11-14T18:00:00Z","tenantId":"acme",'
    + '"sessionPrefix":"embed-0123456789abcdef-","apiKeyHint":"must never be passed on"}';

describe("EmbedSnippet", () => {
    it("renders the script tag and the element with the default script URL", () => {
        expect(EmbedSnippet.render({ tokenUrl: "/mnemo/embed-token" })).toBe(
            `<script src="https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@${CLIENT_VERSION}/embed/mnemo-chat.js" async></script>\n`
            + '<mnemo-chat token-url="/mnemo/embed-token"></mnemo-chat>');
    });

    it("renders every option, in a fixed order, with a bare number kept bare", () => {
        expect(EmbedSnippet.render({
            tokenUrl: "/t", scriptUrl: "/static/mnemo-chat.js", baseUrl: "https://mnemo.example/api", width: "50%",
            height: 600, theme: "dark", placeholder: "Ask us", sessionId: "support", locale: "fr-CA",
        })).toBe('<script src="/static/mnemo-chat.js" async></script>\n'
            + '<mnemo-chat token-url="/t" base-url="https://mnemo.example/api" width="50%" height="600" theme="dark" '
            + 'placeholder="Ask us" session-id="support" locale="fr-CA"></mnemo-chat>');
    });

    it("default script URL names this version of the package", () => {
        expect(EmbedSnippet.defaultScriptUrl()).toBe(
            `https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@${CLIENT_VERSION}/embed/mnemo-chat.js`);
    });

    it("a blank scriptUrl means the default", () => {
        expect(EmbedSnippet.render({ tokenUrl: "/t", scriptUrl: "  " })).toContain(EmbedSnippet.defaultScriptUrl());
    });

    it("omits options that are not set", () => {
        const html = EmbedSnippet.render({ tokenUrl: "/t", width: undefined, theme: undefined });
        expect(html).not.toContain("width=");
        expect(html).not.toContain("theme=");
    });

    it("escapes every attribute value and the script URL", () => {
        const evil = '"><script>alert(1)</script>\'&';
        const escaped = "&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&#39;&amp;";
        const html = EmbedSnippet.render({
            tokenUrl: evil, scriptUrl: evil, baseUrl: evil, width: evil, height: evil, theme: evil, placeholder: evil,
            sessionId: evil, locale: evil,
        });
        expect(html).toBe(`<script src="${escaped}" async></script>\n<mnemo-chat token-url="${escaped}" base-url="${escaped}" `
            + `width="${escaped}" height="${escaped}" theme="${escaped}" placeholder="${escaped}" session-id="${escaped}" `
            + `locale="${escaped}"></mnemo-chat>`);
        expect(html).not.toContain("<script>alert");
        expect(html.match(/</g)).toHaveLength(4); // <script, </script, <mnemo-chat, </mnemo-chat
    });

    it("escapes attribute-breaking input in each option on its own", () => {
        for (const option of ["baseUrl", "width", "height", "theme", "placeholder", "sessionId", "locale"] as const) {
            const html = EmbedSnippet.render({ tokenUrl: "/t", [option]: 'x" onload="alert(1)' });
            expect(html, option).not.toContain('" onload="');
            expect(html, option).toContain('x&quot; onload=&quot;alert(1)');
        }
    });

    it("tokenUrl is required", () => {
        for (const tokenUrl of ["", "  ", undefined as unknown as string]) {
            expect(() => EmbedSnippet.render({ tokenUrl })).toThrow(/tokenUrl is required/);
        }
    });
});

describe("EmbedTokenEndpoint", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const template = () => new MnemoEmbedClient.Builder().apiKey("secret-api-key").baseUrl(server.url())
        .tenantId("acme").allowedOrigin("https://app.example.com").ttlSeconds(300);

    it("mints a token for the end user and returns only token, expiresAt, tenantId and sessionPrefix", async () => {
        server.reply(200, MINT);
        const out = await EmbedTokenEndpoint.handle(template(), "user-42");
        expect(out).toBe('{"token":"mnemo_embed_abc","expiresAt":"2026-11-14T18:00:00Z","tenantId":"acme","sessionPrefix":"embed-0123456789abcdef-"}');
        expect(Object.keys(JSON.parse(out))).toEqual(["token", "expiresAt", "tenantId", "sessionPrefix"]);
        expect(out).not.toContain("secret-api-key");
        expect(out).not.toContain("apiKeyHint");
        const r = server.last();
        expect([r.method, r.path, r.token]).toEqual(["POST", "/mnemo/embed/token", "secret-api-key"]);
        expect(JSON.parse(r.body)).toEqual({
            tenantId: "acme", allowedOrigin: "https://app.example.com", endUserId: "user-42", ttlSeconds: 300,
        });
    });

    it("without an end user id the visitor is anonymous", async () => {
        server.reply(200, MINT);
        for (const none of [undefined, null, "", "   "]) {
            await EmbedTokenEndpoint.handle(template(), none);
            expect(JSON.parse(server.last().body)).not.toHaveProperty("endUserId");
        }
    });

    it("accepts a function that returns the template", async () => {
        server.reply(200, MINT);
        await EmbedTokenEndpoint.handle(template, "u1");
        expect(JSON.parse(server.last().body).endUserId).toBe("u1");
    });

    it("does not change the template, so concurrent requests for different users stay apart", async () => {
        server.reply(200, MINT);
        const shared = template();
        await Promise.all(["alice", "bob", "carol"].map((id) => EmbedTokenEndpoint.handle(shared, id)));
        expect(server.requests.map((r) => JSON.parse(r.body).endUserId).sort()).toEqual(["alice", "bob", "carol"]);
        await EmbedTokenEndpoint.handle(shared, null);
        expect(JSON.parse(server.last().body)).not.toHaveProperty("endUserId");
    });

    it("an end user id the service would refuse is refused before sending", async () => {
        const e = await rejection(() => EmbedTokenEndpoint.handle(template(), "has space"));
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(server.count()).toBe(0);
    });

    it("passes the service's failure on as a MnemoClientException", async () => {
        server.reply(403, '{"error":"not an ADMIN token"}');
        const e = await rejection(() => EmbedTokenEndpoint.handle(template(), "u1"));
        expect([e.error.code, e.httpStatus]).toEqual([MnemoError.Code.FORBIDDEN, 403]);
    });

    it("exchanges client credentials once across requests", async () => {
        server.replyOn("/oauth/token", [200, '{"access_token":"a","expires_in":3600}']);
        server.replyOn("/mnemo/embed/token", [200, MINT]);
        const shared = new MnemoEmbedClient.Builder().clientCredentials("cid", "cs").baseUrl(server.url())
            .tenantId("acme").allowedOrigin("https://app.example.com");
        await EmbedTokenEndpoint.handle(shared, "u1");
        await EmbedTokenEndpoint.handle(shared, "u2");
        expect(server.requests.filter((r) => r.path === "/oauth/token")).toHaveLength(1);
    });

    it("a missing template is refused", async () => {
        const e = await rejection(() => EmbedTokenEndpoint.handle(null as unknown as MnemoEmbedClient.Builder, "u"));
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
    });

    it("the JSON is safe to inline in an HTML page", async () => {
        server.reply(200, JSON.stringify({ token: "t</script>&", expiresAt: "e\u2028", tenantId: "acme", sessionPrefix: "p" }));
        const out = await EmbedTokenEndpoint.handle(template(), "u");
        expect(out).not.toMatch(/[<>&\u2028\u2029]/);
        expect(JSON.parse(out)).toEqual({ token: "t</script>&", expiresAt: "e\u2028", tenantId: "acme", sessionPrefix: "p" });
    });
});

describe("version constant", () => {
    it("equals the version in package.json (update src/version.ts when the version is bumped)", () => {
        const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
        expect(CLIENT_VERSION).toBe(pkg.version);
    });
});
