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
import { parseEvents, TOKEN_HEADER } from "../src/AbstractMnemoClient.js";
import {
    type ChatMessageResponse,
    type JsonObject,
    MnemoChatClient,
    MnemoClientException,
    MnemoClientFactory,
    MnemoError,
} from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

const Op = MnemoChatClient.Operation;

describe("MnemoChatClient", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const builder = () => new MnemoChatClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme");

    it("chat posts the request and parses the reply", async () => {
        server.reply(200, `{"tenantId":"acme","sessionId":"s1","id":"m1","message":"You had pasta.","attachments":null,
            "timestamp":1700000000000,"timing":{"memoryOperationMs":5,"llmPostprocessMs":7,"totalMs":12},
            "sessionName":"Meals","reasoningTrace":null,"quotaWarning":null,
            "tokenUsage":{"inputTokens":10,"outputTokens":4},"someFutureField":true}`);

        const reply = await builder().sessionId("s1").message("What did I eat?").build().execute<ChatMessageResponse>();

        expect(reply.message).toBe("You had pasta.");
        expect(reply.timing?.totalMs).toBe(12);
        expect(reply.tokenUsage?.outputTokens).toBe(4);
        const r = server.last();
        expect(r.method).toBe("POST");
        expect(r.path).toBe("/mnemo/chat");
        expect(r.token).toBe("tok-1");
        expect(JSON.parse(r.body)).toEqual({ tenantId: "acme", sessionId: "s1", message: "What did I eat?" });
    });

    it("uses the documented token header", () => {
        expect(TOKEN_HEADER).toBe("X-Mnemo-Api-Token");
    });

    it("a missing API key fails before any request", async () => {
        const e = await rejection(() => new MnemoChatClient.Builder().baseUrl(server.url()).tenantId("acme")
            .sessionId("s").message("hi").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.MISSING_API_KEY);
        expect(server.count()).toBe(0);
    });

    it("a missing required parameter names the field", async () => {
        const e = await rejection(() => builder().sessionId("s1").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(e.message).toContain("message");
        expect(server.count()).toBe(0);
    });

    it("service errors carry the status and the server message", async () => {
        server.reply(429, `{"error":"Daily quota 100% used"}`);
        const e = await rejection(() => builder().sessionId("s1").message("hi").build().execute());
        expect(e.httpStatus).toBe(429);
        expect(e.error.code).toBe(MnemoError.Code.RATE_LIMITED);
        expect(e.message).toBe("Daily quota 100% used");
    });

    it("an uninitialized session's 409 is an invalid request with the service's text", async () => {
        server.reply(409, `{"error":"This session has not been initialized yet. Please call /init/stream first."}`);
        const e = await rejection(() => builder().sessionId("s1").message("hi").build().execute());
        expect(e.httpStatus).toBe(409);
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(e.message).toContain("not been initialized");
    });

    it("status codes map to error codes", async () => {
        const expected: [number, MnemoError.Code][] = [
            [401, MnemoError.Code.UNAUTHORIZED], [403, MnemoError.Code.FORBIDDEN],
            [404, MnemoError.Code.NOT_FOUND], [500, MnemoError.Code.SERVER_ERROR],
            [400, MnemoError.Code.INVALID_REQUEST],
        ];
        for (const [status, code] of expected) {
            server.reply(status, "not json");
            const e = await rejection(() => builder().operation(Op.GET_PLAN).build().execute());
            expect(e.error.code, `status ${status}`).toBe(code);
            expect(e.httpStatus).toBe(status);
            expect(e.message).toBe(MnemoError.defaultMessage(code));
        }
    });

    it("an unreachable service is an IO error", async () => {
        const client = builder().sessionId("s").message("hi").build();
        await server.close();
        const e = await rejection(() => client.execute());
        expect(e.error.code).toBe(MnemoError.Code.IO_ERROR);
        expect(e.httpStatus).toBe(0);
        server = await FakeMnemoServer.start();
    });

    it("a reply that is not JSON is a serialization error", async () => {
        server.reply(200, "<html>oops</html>", "text/html");
        const e = await rejection(() => builder().operation(Op.GET_PLAN).build().execute());
        expect(e.error.code).toBe(MnemoError.Code.SERIALIZATION_ERROR);
    });

    it("list subjects returns a list", async () => {
        server.reply(200, `[{"name":"Meals"},{"name":"Travel"}]`);
        const subjects = await builder().operation(Op.LIST_SUBJECTS).build().execute<JsonObject[]>();
        expect(subjects).toHaveLength(2);
        expect(subjects[1]!.name).toBe("Travel");
        expect(server.last().method).toBe("GET");
        expect(server.last().query).toBe("tenantId=acme");
    });

    it("list sessions sends only the parameters that were set", async () => {
        server.reply(200, `{"content":[],"totalElements":0}`);
        const page = await builder().operation(Op.LIST_SESSIONS).query("trip").size(10).build().execute<JsonObject>();
        expect(page.totalElements).toBe(0);
        expect(server.last().path).toBe("/mnemo/sessions");
        expect(server.last().query).toBe("tenantId=acme&q=trip&size=10");
    });

    it("delete subject encodes the name and resolves with null on 204", async () => {
        server.reply(204, "");
        const result = await builder().operation(Op.DELETE_SUBJECT).subjectName("Q3 plan/2026").build().execute();
        expect(result).toBeNull();
        expect(server.last().method).toBe("DELETE");
        expect(server.last().rawPath).toBe("/mnemo/subject/Q3%20plan%2F2026");
    });

    it("rename session uses PATCH", async () => {
        server.reply(200, `{"sessionName":"Trip"}`);
        const result = await builder().operation(Op.RENAME_SESSION).sessionId("s1").sessionName("Trip")
            .build().execute<JsonObject>();
        expect(result.sessionName).toBe("Trip");
        expect(server.last().method).toBe("PATCH");
        expect(server.last().path).toBe("/mnemo/sessions/s1/name");
        expect(JSON.parse(server.last().body)).toEqual({ tenantId: "acme", sessionName: "Trip" });
    });

    it("close session always passes the permanent flag", async () => {
        server.reply(204, "");
        await builder().operation(Op.CLOSE_SESSION).sessionId("s1").permanent(true).build().execute();
        expect(server.last().query).toBe("tenantId=acme&permanent=true");
        await builder().operation(Op.CLOSE_SESSION).sessionId("s1").build().execute();
        expect(server.last().query).toBe("tenantId=acme&permanent=false");
    });

    it("history passes the cursor", async () => {
        server.reply(200, `{"messages":[]}`);
        await builder().operation(Op.GET_HISTORY).sessionId("s1").before(99).size(5).build().execute();
        expect(server.last().path).toBe("/mnemo/sessions/s1/history");
        expect(server.last().query).toBe("tenantId=acme&before=99&size=5");
    });

    it("health needs no tenant", async () => {
        server.reply(200, `{"status":"UP"}`);
        const health = await new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url())
            .operation(Op.HEALTH).build().execute<JsonObject>();
        expect(health.status).toBe("UP");
    });

    it("a trailing slash on the base URL is tolerated", async () => {
        server.reply(200, `{"status":"UP"}`);
        await new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url() + "/")
            .operation(Op.HEALTH).build().execute();
        expect(server.last().path).toBe("/mnemo/health");
    });

    const INIT_STREAM = "\n\n"
        + `event: init-stage\ndata: {"stage":"load-subjects","status":"start","elapsedMs":0,"message":"Loading"}\n\n`
        + `event: init-stage\ndata: {"stage":"load-subjects","status":"finish","elapsedMs":42,"message":"Loaded 2"}\n\n`
        + `event: complete\ndata: {"tenantId":"acme","sessionId":"s1","status":"complete","totalMs":50,`
        + `"message":"Initialization complete. Chat is ready."}\n\n`
        + "event: done\ndata: \n\n";

    it("init session reads the event stream and reports ready", async () => {
        server.reply(200, INIT_STREAM, "text/event-stream");

        const result = await builder().operation(Op.INIT_SESSION).sessionId("s1").sessionName("My session")
            .build().execute<JsonObject>();

        expect(result.ready).toBe(true);
        expect(result.message).toBe("Initialization complete. Chat is ready.");
        expect(result.totalMs).toBe(50);
        const stages = result.stages as JsonObject[];
        expect(stages).toHaveLength(2);
        expect(stages[1]!.status).toBe("finish");
        const r = server.last();
        expect(r.method).toBe("POST");
        expect(r.path).toBe("/mnemo/init/stream");
        expect(r.accept).toBe("text/event-stream");
        expect(r.token).toBe("tok-1");
        expect(JSON.parse(r.body)).toEqual({ tenantId: "acme", sessionId: "s1", sessionName: "My session" });
    });

    it("an init error event becomes an exception", async () => {
        server.reply(200, `event: error\ndata: {"error":"Access denied: token does not belong to tenantId=x"}\n\n`
            + "event: done\ndata: \n\n", "text/event-stream");
        const e = await rejection(() => builder().operation(Op.INIT_SESSION).sessionId("s1").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.INIT_FAILED);
        expect(e.message).toBe("Access denied: token does not belong to tenantId=x");
    });

    it("an init stream that ends without completing is an error", async () => {
        server.reply(200, `event: init-stage\ndata: {"stage":"load-subjects","status":"start"}\n\n`,
            "text/event-stream");
        const e = await rejection(() => builder().operation(Op.INIT_SESSION).sessionId("s1").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.INIT_FAILED);
    });

    it("an init HTTP error carries the status", async () => {
        server.reply(401, `{"error":"Invalid or revoked API token."}`);
        const e = await rejection(() => builder().operation(Op.INIT_SESSION).sessionId("s1").build().execute());
        expect(e.error.code).toBe(MnemoError.Code.UNAUTHORIZED);
        expect(e.httpStatus).toBe(401);
    });

    it("init session needs a session id", async () => {
        const e = await rejection(() => builder().operation(Op.INIT_SESSION).build().execute());
        expect(e.message).toContain("sessionId");
        expect(server.count()).toBe(0);
    });

    it("the event parser handles comments, CRLF and multi-line data", () => {
        const events = parseEvents(": keep-alive\r\n\r\nevent: a\r\ndata: one\r\ndata: two\r\n\r\ndata: bare\n");
        expect(events).toEqual([{ name: "a", data: "one\ntwo" }, { name: "message", data: "bare" }]);
    });

    it("a client can be executed more than once", async () => {
        server.reply(200, `{"status":"UP"}`);
        const client = new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url()).operation(Op.HEALTH).build();
        await client.execute();
        await client.execute();
        expect(server.count()).toBe(2);
    });

    it("the factory rejects a null builder and builds a client", () => {
        expect(() => MnemoClientFactory.create(null)).toThrow(MnemoClientException);
        expect(MnemoClientFactory.create(builder())).toBeDefined();
    });
});
