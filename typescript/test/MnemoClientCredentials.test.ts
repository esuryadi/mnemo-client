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
import { MnemoError, MnemoNetworkClient } from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

const TOKEN_PATH = "/oauth/token";
const LIST_PATH = "/mnemo/network/sharing/private";
const token = (value: string, expiresIn = 3600) =>
    `{"access_token":"${value}","token_type":"Bearer","expires_in":${expiresIn}}`;

describe("client credentials", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const builder = () => new MnemoNetworkClient.Builder().clientCredentials("mnemo_cid_1", "mnemo_cs_1")
        .baseUrl(server.url()).tenantId("acme").operation(MnemoNetworkClient.Operation.LIST_PRIVATE_GRANTS);
    const apiCalls = () => server.requests.filter((r) => r.path !== TOKEN_PATH);

    it("exchanges the credentials and sends the bearer token", async () => {
        server.replyOn(TOKEN_PATH, [200, token("tok-a")]).reply(200, "[]");
        await builder().build().execute();
        const first = server.requests[0]!;
        expect([first.method, first.path]).toEqual(["POST", TOKEN_PATH]);
        expect(first.body).toBe("grant_type=client_credentials");
        expect(first.authorization).toBe("Basic " + Buffer.from("mnemo_cid_1:mnemo_cs_1").toString("base64"));
        expect(apiCalls()[0]!.authorization).toBe("Bearer tok-a");
        expect(apiCalls()[0]!.token).toBeUndefined();
    });

    it("reuses the token across calls", async () => {
        server.replyOn(TOKEN_PATH, [200, token("tok-a")]).reply(200, "[]");
        const client = builder().build();
        await client.execute();
        await client.execute();
        expect(server.requests.filter((r) => r.path === TOKEN_PATH)).toHaveLength(1);
        expect(apiCalls()).toHaveLength(2);
    });

    it("shares one exchange between concurrent calls", async () => {
        server.replyOn(TOKEN_PATH, [200, token("tok-a")]).reply(200, "[]");
        const client = builder().build();
        await Promise.all([client.execute(), client.execute(), client.execute()]);
        expect(server.requests.filter((r) => r.path === TOKEN_PATH)).toHaveLength(1);
    });

    it("fetches a new token when the old one is about to expire", async () => {
        server.replyOn(TOKEN_PATH, [200, token("tok-a", 30)], [200, token("tok-b")]).reply(200, "[]");
        const client = builder().build();
        await client.execute();
        await client.execute();
        expect(apiCalls().map((r) => r.authorization)).toEqual(["Bearer tok-a", "Bearer tok-b"]);
    });

    it("fetches a new token and retries once when the service rejects it", async () => {
        server.replyOn(TOKEN_PATH, [200, token("tok-a")], [200, token("tok-b")]);
        server.replyOn(LIST_PATH, [401, '{"error":"Unauthorized"}'], [200, "[]"]);
        await builder().build().execute();
        expect(apiCalls().map((r) => r.authorization)).toEqual(["Bearer tok-a", "Bearer tok-b"]);
    });

    it("gives up after one retry", async () => {
        server.replyOn(TOKEN_PATH, [200, token("tok-a")]);
        server.replyOn(LIST_PATH, [401, '{"error":"Unauthorized"}']);
        const e = await rejection(() => builder().build().execute());
        expect(e.httpStatus).toBe(401);
        expect(apiCalls()).toHaveLength(2);
    });

    it("a wrong secret is unauthorized and no call is sent", async () => {
        server.replyOn(TOKEN_PATH, [401, '{"error":"invalid_client"}']);
        const e = await rejection(() => builder().build().execute());
        expect(e.error.code).toBe(MnemoError.Code.UNAUTHORIZED);
        expect(apiCalls()).toHaveLength(0);
    });

    it("a locked client is rate limited", async () => {
        server.replyOn(TOKEN_PATH, [429, '{"error":"too_many_attempts"}']);
        const e = await rejection(() => builder().build().execute());
        expect(e.error.code).toBe(MnemoError.Code.RATE_LIMITED);
    });

    it("a token reply without a token is a serialization error", async () => {
        server.replyOn(TOKEN_PATH, [200, "{}"]);
        const e = await rejection(() => builder().build().execute());
        expect(e.error.code).toBe(MnemoError.Code.SERIALIZATION_ERROR);
    });

    it("an api key together with credentials is refused before any request", async () => {
        const e = await rejection(() => builder().apiKey("tok-1").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(server.count()).toBe(0);
    });

    it("an id without a secret is refused", async () => {
        const b = new MnemoNetworkClient.Builder().clientCredentials("mnemo_cid_1", " ").baseUrl(server.url())
            .tenantId("acme").operation(MnemoNetworkClient.Operation.LIST_PRIVATE_GRANTS);
        const e = await rejection(() => b.build().execute());
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(server.count()).toBe(0);
    });

    it("an api key still uses the token header and no exchange", async () => {
        server.reply(200, "[]");
        await new MnemoNetworkClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme")
            .operation(MnemoNetworkClient.Operation.LIST_PRIVATE_GRANTS).build().execute();
        expect(server.last().token).toBe("tok-1");
        expect(server.last().authorization).toBeUndefined();
        expect(server.count()).toBe(1);
    });
});
