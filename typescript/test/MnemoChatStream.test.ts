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
import { SseParser } from "../src/AbstractMnemoClient.js";
import { MnemoChatClient, type MnemoClient, MnemoClientException, MnemoError, type StreamEvent } from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

const Op = MnemoChatClient.Operation;

describe("MnemoChatClient CHAT_STREAM", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const builder = () => new MnemoChatClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme")
        .sessionId("s1").message("What did I eat?").operation(Op.CHAT_STREAM);

    async function collect(client: MnemoClient): Promise<StreamEvent[]> {
        const events: StreamEvent[] = [];
        for await (const event of await client.execute<AsyncIterable<StreamEvent>>()) {
            events.push(event);
        }
        return events;
    }

    it("posts the JSON body to chat/stream asking for an event stream", async () => {
        server.reply(200, "event: done\ndata: {}\n\n", "text/event-stream");
        await collect(builder().build());
        const r = server.last();
        expect([r.method, r.path, r.query]).toEqual(["POST", "/mnemo/chat/stream", null]);
        expect(JSON.parse(r.body)).toEqual({ tenantId: "acme", sessionId: "s1", message: "What did I eat?" });
        expect(r.accept).toBe("text/event-stream");
        expect(r.token).toBe("tok-1");
    });

    it("yields every event with its name and data", async () => {
        server.reply(200, "event: message\ndata: You\n\nevent: message\ndata:  had pasta.\n\n"
            + "event: session-name\ndata: {\"sessionName\":\"Meals\"}\n\nevent: done\ndata: {}\n\n", "text/event-stream");
        expect(await collect(builder().build())).toEqual([
            { event: "message", data: "You" },
            { event: "message", data: " had pasta." },
            { event: "session-name", data: '{"sessionName":"Meals"}' },
            { event: "done", data: "{}" },
        ]);
    });

    it("an event without a name is a message", async () => {
        server.reply(200, "data: hi\n\n", "text/event-stream");
        expect(await collect(builder().build())).toEqual([{ event: "message", data: "hi" }]);
    });

    it("hands over events while the stream is still open", async () => {
        const live = server.streamNext();
        const iterator = (await builder().build().execute<AsyncIterable<StreamEvent>>())[Symbol.asyncIterator]();
        await live.write("event: message\ndata: Hel\n\n");
        expect((await iterator.next()).value).toEqual({ event: "message", data: "Hel" });
        await live.write("event: message\ndata: lo\n\nevent: do");
        expect((await iterator.next()).value).toEqual({ event: "message", data: "lo" });
        await live.write("ne\ndata: {}\n\n");
        await live.end();
        expect((await iterator.next()).value).toEqual({ event: "done", data: "{}" });
        expect((await iterator.next()).done).toBe(true);
    });

    it("reads multi-byte characters", async () => {
        server.reply(200, "data: caf\u00e9 \u{1F600}\n\n", "text/event-stream");
        expect(await collect(builder().build())).toEqual([{ event: "message", data: "caf\u00e9 \u{1F600}" }]);
    });

    it("an error status rejects execute itself, before any event", async () => {
        server.reply(401, '{"error":"token expired"}');
        const e = await rejection(() => builder().build().execute());
        expect([e.error.code, e.httpStatus, e.message]).toEqual([MnemoError.Code.UNAUTHORIZED, 401, "token expired"]);
    });

    it("a 403 and a 429 map to their codes", async () => {
        server.reply(403, '{"error":"wrong session prefix"}');
        expect((await rejection(() => builder().build().execute())).error.code).toBe(MnemoError.Code.FORBIDDEN);
        server.reply(429, '{"error":"slow down"}');
        expect((await rejection(() => builder().build().execute())).error.code).toBe(MnemoError.Code.RATE_LIMITED);
    });

    it("a redirect is not followed", async () => {
        server.redirectTo("https://elsewhere.example/x");
        const e = await rejection(() => builder().build().execute());
        expect([e.error.code, e.httpStatus]).toEqual([MnemoError.Code.INVALID_REQUEST, 302]);
        expect(server.count()).toBe(1);
    });

    it("breaking out of the loop cancels the stream", async () => {
        const live = server.streamNext();
        const events = await builder().build().execute<AsyncIterable<StreamEvent>>();
        await live.write("data: one\n\n");
        for await (const event of events) {
            expect(event.data).toBe("one");
            break;
        }
        await live.end();
    });

    it("a stream that breaks part way rejects the iteration with IO_ERROR", async () => {
        const live = server.streamNext();
        const events = await builder().timeout(150).build().execute<AsyncIterable<StreamEvent>>();
        await live.write("data: one\n\n");
        const seen: string[] = [];
        let failure: unknown;
        try {
            for await (const event of events) seen.push(event.data);
        } catch (e) {
            failure = e;
        }
        expect(seen).toEqual(["one"]);
        expect(failure).toBeInstanceOf(MnemoClientException);
        expect((failure as MnemoClientException).error.code).toBe(MnemoError.Code.IO_ERROR);
    });

    it("refuses missing parameters before sending", async () => {
        for (const [name, b] of [
            ["tenantId", new MnemoChatClient.Builder().sessionId("s1").message("m")],
            ["sessionId", new MnemoChatClient.Builder().tenantId("acme").message("m")],
            ["message", new MnemoChatClient.Builder().tenantId("acme").sessionId("s1")],
        ] as const) {
            const e = await rejection(() => b.apiKey("k").baseUrl(server.url()).operation(Op.CHAT_STREAM).build().execute());
            expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
            expect(e.message).toContain(name);
        }
        expect(server.count()).toBe(0);
    });

    it("works with client credentials, replacing a rejected token once", async () => {
        server.replyOn("/oauth/token", [200, '{"access_token":"a","expires_in":3600}'],
            [200, '{"access_token":"b","expires_in":3600}']);
        server.replyOn("/mnemo/chat/stream", [401, '{"error":"Unauthorized"}'], [200, "data: ok\n\n"]);
        const b = new MnemoChatClient.Builder().clientCredentials("cid", "cs").baseUrl(server.url())
            .tenantId("acme").sessionId("s1").message("m").operation(Op.CHAT_STREAM);
        expect(await collect(b.build())).toEqual([{ event: "message", data: "ok" }]);
        expect(server.requests.filter((r) => r.path === "/mnemo/chat/stream").map((r) => r.authorization))
            .toEqual(["Bearer a", "Bearer b"]);
    });
});

describe("SseParser", () => {
    it("joins several data lines and strips one leading space", () => {
        const p = new SseParser();
        expect([...p.push("event: m\ndata: a\ndata:  b\n\n"), ...p.end()]).toEqual([{ name: "m", data: "a\n b" }]);
    });

    it("handles CRLF split between chunks and a lone CR", () => {
        const p = new SseParser();
        const out = [...p.push("data: a\r"), ...p.push("\n\r"), ...p.push("\ndata: b\r\r"), ...p.end()];
        expect(out).toEqual([{ name: "message", data: "a" }, { name: "message", data: "b" }]);
    });

    it("ignores comments and unknown fields, and keeps an unterminated last event", () => {
        const p = new SseParser();
        expect([...p.push(": ping\nid: 4\nretry: 5\ndata: x"), ...p.end()]).toEqual([{ name: "message", data: "x" }]);
    });
});
