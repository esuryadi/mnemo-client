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

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect } from "vitest";
import { MnemoClientException } from "../src/index.js";

export interface Received {
    method: string;
    /** The decoded path. */
    path: string;
    rawPath: string;
    /** The raw query string, without the leading {@code ?}; {@code null} when there is none. */
    query: string | null;
    token: string | undefined;
    accept: string | undefined;
    authorization: string | undefined;
    body: string;
}

/**
 * A throwaway HTTP server on a random port that records every request and answers with a canned reply,
 * so the clients can be tested end to end through the real fetch stack without the MNEMO service.
 */
export class FakeMnemoServer {
    readonly requests: Received[] = [];
    private status = 200;
    private replyBody = "{}";
    private contentType = "application/json";
    private readonly routes = new Map<string, { status: number; body: string }[]>();
    private readonly server: Server;

    private constructor() {
        this.server = createServer((req, res) => {
            const chunks: Buffer[] = [];
            req.on("data", (chunk: Buffer) => chunks.push(chunk));
            req.on("end", () => {
                const raw = req.url ?? "/";
                const q = raw.indexOf("?");
                const rawPath = q < 0 ? raw : raw.substring(0, q);
                this.requests.push({
                    method: req.method ?? "",
                    path: decodeURIComponent(rawPath),
                    rawPath,
                    query: q < 0 ? null : raw.substring(q + 1),
                    token: req.headers["x-mnemo-api-token"] as string | undefined,
                    accept: req.headers["accept"],
                    authorization: req.headers["authorization"],
                    body: Buffer.concat(chunks).toString("utf8"),
                });
                res.setHeader("Content-Type", this.contentType);
                const queued = this.routes.get(rawPath);
                const reply = queued === undefined ? { status: this.status, body: this.replyBody }
                    : queued.length > 1 ? queued.shift()! : queued[0]!;
                res.statusCode = reply.status;
                res.end(reply.status === 204 ? undefined : reply.body);
            });
        });
    }

    static async start(): Promise<FakeMnemoServer> {
        const fake = new FakeMnemoServer();
        await new Promise<void>((resolve) => fake.server.listen(0, "127.0.0.1", resolve));
        return fake;
    }

    reply(status: number, body: string, contentType = "application/json"): this {
        this.status = status;
        this.replyBody = body;
        this.contentType = contentType;
        return this;
    }

    /** Answers requests to {@code path} with {@code replies} in turn; the last one repeats. */
    replyOn(path: string, ...replies: [number, string][]): this {
        this.routes.set(path, replies.map(([status, body]) => ({ status, body })));
        return this;
    }

    url(): string {
        return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    }

    last(): Received {
        return this.requests[this.requests.length - 1]!;
    }

    count(): number {
        return this.requests.length;
    }

    async close(): Promise<void> {
        this.server.closeAllConnections();
        await new Promise<void>((resolve) => this.server.close(() => resolve()));
    }
}

/** Runs {@code call}, expecting it to reject with a MnemoClientException, and returns that exception. */
export async function rejection(call: () => Promise<unknown>): Promise<MnemoClientException> {
    try {
        await call();
    } catch (e) {
        expect(e).toBeInstanceOf(MnemoClientException);
        return e as MnemoClientException;
    }
    throw new Error("expected a MnemoClientException");
}
