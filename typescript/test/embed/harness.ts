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

import { expect, vi } from "vitest";
import { defineMnemoChat } from "../../src/embed/index.js";
import type { MnemoChatElement } from "../../src/embed/index.js";

export const BASE = "https://mnemo.test/api";
export const TOKEN_URL = "/mnemo/embed-token";
export const PREFIX = "embed-0123456789abcdef-";

export interface Call {
    method: string;
    url: URL;
    headers: Record<string, string>;
    body: string;
    init: RequestInit;
}

type Reply = Response | ((call: Call) => Response | Promise<Response>) | Error;

/** An event stream the test feeds by hand. */
export class Feed {
    private controller!: ReadableStreamDefaultController<Uint8Array>;
    readonly response: Response;
    private readonly encoder = new TextEncoder();

    constructor() {
        const body = new ReadableStream<Uint8Array>({ start: (c) => void (this.controller = c) });
        this.response = new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }

    push(text: string): void {
        try {
            this.controller.enqueue(this.encoder.encode(text));
        } catch {
            // the reader cancelled the stream
        }
    }

    end(): void {
        try {
            this.controller.close();
        } catch {
            // the reader cancelled the stream
        }
    }
}

export const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const sse = (...events: [string, string][]): Response =>
    new Response(events.map(([name, data]) => `event: ${name}\ndata: ${data}\n\n`).join(""),
        { status: 200, headers: { "Content-Type": "text/event-stream" } });

export const expiresIn = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();

export const tokenReply = (token = "mnemo_embed_one", seconds = 900, extra: object = {}): Response =>
    json({ token, expiresAt: expiresIn(seconds), sessionPrefix: PREFIX, tenantId: "acme", ...extra });

/** Stands in for fetch: routes by "METHOD path" and records every call. */
export class FakeNetwork {
    readonly calls: Call[] = [];
    private readonly routes = new Map<string, Reply[]>();

    constructor() {
        vi.stubGlobal("fetch", (input: string | URL, init: RequestInit = {}) => this.handle(input, init));
        this.on("GET", TOKEN_URL, () => tokenReply());
        this.on("GET", "/mnemo/sessions/*/history", () => json({ entries: [], hasMore: false }));
        this.on("POST", "/mnemo/init/stream", () => sse(["complete", '{"totalMs":3}']));
        this.on("POST", "/mnemo/chat/stream", () => sse(["message", "Hi"], ["done", "{}"]));
    }

    /** Replies in turn (the last one repeats). {@code path} may hold one * for a path segment. */
    on(method: string, path: string, ...replies: Reply[]): this {
        this.routes.set(`${method} ${path}`, replies);
        return this;
    }

    of(method: string, path: string): Call[] {
        return this.calls.filter((c) => c.method === method && this.matches(path, c.url.pathname.replace(/^\/api/, "")));
    }

    private matches(pattern: string, path: string): boolean {
        return new RegExp("^" + pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+") + "$").test(path);
    }

    private async handle(input: string | URL, init: RequestInit): Promise<Response> {
        const url = new URL(String(input), "https://page.test/");
        const headers: Record<string, string> = {};
        for (const [name, value] of Object.entries((init.headers ?? {}) as Record<string, string>)) {
            headers[name.toLowerCase()] = value;
        }
        const call: Call = { method: (init.method ?? "GET").toUpperCase(), url, headers, body: String(init.body ?? ""), init };
        this.calls.push(call);
        const path = url.pathname.replace(/^\/api/, "");
        for (const [key, replies] of this.routes) {
            const [method, pattern] = key.split(" ") as [string, string];
            if (method === call.method && this.matches(pattern, path)) {
                const reply = replies.length > 1 ? replies.shift()! : replies[0]!;
                if (reply instanceof Error) {
                    throw reply;
                }
                return typeof reply === "function" ? reply(call) : reply;
            }
        }
        return json({ error: "no route" }, 404);
    }
}

export function mount(attributes: Record<string, string> = {}): MnemoChatElement {
    defineMnemoChat();
    const el = document.createElement("mnemo-chat") as MnemoChatElement;
    const all = { "token-url": TOKEN_URL, "base-url": BASE, ...attributes };
    for (const [name, value] of Object.entries(all)) {
        el.setAttribute(name, value);
    }
    document.body.appendChild(el);
    return el;
}

export const shadow = (el: Element): ShadowRoot => el.shadowRoot!;
export const log = (el: Element): HTMLElement => shadow(el).querySelector(".log")!;
export const input = (el: Element): HTMLTextAreaElement => shadow(el).querySelector("textarea")!;
export const button = (el: Element): HTMLButtonElement => shadow(el).querySelector("button")!;
export const errorText = (el: Element): string => shadow(el).querySelector(".error")!.textContent ?? "";
export const statusText = (el: Element): string => shadow(el).querySelector(".status")!.textContent ?? "";
export const bubbles = (el: Element): HTMLElement[] => Array.from(log(el).querySelectorAll<HTMLElement>(".msg"));
/** The text of a bubble without the screen-reader-only speaker label. */
export const bubbleText = (b: Element): string =>
    Array.from(b.childNodes).filter((n) => !(n instanceof Element && n.classList.contains("sr-only")))
        .map((n) => n.textContent).join("");

export function events(el: Element, name: string): CustomEvent[] {
    const seen: CustomEvent[] = [];
    el.addEventListener(name, (e) => seen.push(e as CustomEvent));
    return seen;
}

export async function ready(el: Element): Promise<void> {
    await vi.waitFor(() => expect(statusText(el)).not.toBe("Connecting…"), { timeout: 2000 });
}

export function type(el: Element, text: string): void {
    input(el).value = text;
}

export function press(el: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    input(el).dispatchEvent(event);
    return event;
}
