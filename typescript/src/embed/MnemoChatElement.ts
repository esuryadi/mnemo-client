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

import { MnemoClientException } from "../exception/MnemoClientException.js";
import { MnemoChatClient } from "../MnemoChatClient.js";
import { MnemoClientBuilder } from "../MnemoClientBuilder.js";
import type { JsonObject, StreamEvent } from "../model/index.js";
import { renderMarkdown } from "./markdown.js";
import { STYLES } from "./styles.js";
import { type Strings, stringsFor } from "./strings.js";

/** A token is replaced this long before it expires. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const HISTORY_SIZE = 50;
const THEMES = new Set(["light", "dark", "auto"]);
const LENGTH = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|em|rem|ex|ch|vh|vw|vmin|vmax|svh|svw|lvh|lvw|dvh|dvw|cm|mm|in|pt|pc)$/i;
const CALC = /^calc\([0-9a-z%+\-*/(). ]{1,100}\)$/i;
const KEYWORD = /^(?:auto|fit-content|min-content|max-content)$/i;

/**
 * Turns a {@code width} or {@code height} attribute into a CSS length: a bare number is pixels, a CSS length
 * such as {@code 50%} or {@code 40vh} is kept, anything else (including anything that could carry other CSS)
 * is {@code null}.
 */
export function normalizeSize(value: string | null | undefined): string | null {
    const v = (value ?? "").trim();
    if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(v)) {
        return v + "px";
    }
    return LENGTH.test(v) || KEYWORD.test(v) || (CALC.test(v) && balanced(v)) ? v : null;
}

function balanced(text: string): boolean {
    let depth = 0;
    for (const c of text) {
        depth += c === "(" ? 1 : c === ")" ? -1 : 0;
        if (depth < 0) {
            return false;
        }
    }
    return depth === 0;
}

interface TokenInfo {
    token: string;
    expiresAtMs: number;
    sessionPrefix: string;
    tenantId: string | null;
}

/** A failure the component raises itself, with the code its {@code mnemo-error} event carries. */
class ChatError extends Error {
    constructor(readonly code: string, message: string, readonly userMessage: keyof Strings, readonly status = 0) {
        super(message);
    }
}

type Role = "user" | "assistant";

// In a page there is an HTMLElement. Elsewhere (a Node program importing the package) there is none, and this
// module must still load, so the class then extends an empty base and is never constructed.
const Base = ((globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ?? class {}) as typeof HTMLElement;

/**
 * <b>MnemoChatElement</b> is the {@code <mnemo-chat>} custom element: a chat box, in a Shadow DOM, that talks to
 * MNEMO with a short-lived embed token fetched from the page owner's own {@code token-url}.
 *
 * Attributes: {@code token-url} (required), {@code base-url}, {@code width}, {@code height} (a bare number is
 * pixels), {@code theme} ({@code light}, {@code dark}, {@code auto}), {@code placeholder}, {@code session-id},
 * {@code locale}, and {@code tenant-id} (only needed when the token endpoint does not return {@code tenantId}).
 * Events (bubbling, composed): {@code mnemo-ready}, {@code mnemo-error}, {@code mnemo-message}. Methods:
 * {@link open} and {@link reset}.
 */
export class MnemoChatElement extends Base {
    static get observedAttributes(): string[] {
        return ["token-url", "base-url", "width", "height", "theme", "placeholder", "session-id", "locale", "tenant-id"];
    }

    private readonly root: HTMLElement;
    private readonly log: HTMLElement;
    private readonly statusLine: HTMLElement;
    private readonly errorLine: HTMLElement;
    private readonly input: HTMLTextAreaElement;
    private readonly sendButton: HTMLButtonElement;
    private strings: Strings = stringsFor(null);

    /** Bumped whenever the conversation is thrown away (reset, restart, disconnect), so late results are ignored. */
    private generation = 0;
    private started = false;
    private streaming = false;
    private tokenInfo: TokenInfo | undefined;
    private tokenFetch: Promise<TokenInfo> | undefined;
    private sessionId: string | undefined;
    private tenant: string | undefined;
    private initDone = false;
    private initRun: Promise<boolean> | undefined;
    private freshSession = false;

    constructor() {
        super();
        const doc = this.ownerDocument;
        const shadow = this.attachShadow({ mode: "open" });
        const style = doc.createElement("style");
        style.textContent = STYLES;

        this.root = doc.createElement("div");
        this.root.className = "root";
        this.root.setAttribute("part", "root");
        this.root.setAttribute("role", "region");

        this.log = doc.createElement("div");
        this.log.className = "log";
        this.log.setAttribute("role", "log");
        this.log.setAttribute("aria-live", "polite");
        this.log.setAttribute("tabindex", "0");

        this.statusLine = doc.createElement("p");
        this.statusLine.className = "status";
        this.statusLine.setAttribute("role", "status");

        this.errorLine = doc.createElement("p");
        this.errorLine.className = "error";
        this.errorLine.setAttribute("role", "alert");

        const form = doc.createElement("form");
        this.input = doc.createElement("textarea");
        this.input.rows = 1;
        this.input.setAttribute("autocomplete", "off");
        this.sendButton = doc.createElement("button");
        this.sendButton.type = "submit";
        form.append(this.input, this.sendButton);

        this.root.append(this.log, this.statusLine, this.errorLine, form);
        shadow.append(style, this.root);

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            this.submit();
        });
        this.input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                this.submit();
            } else if (event.key === "Escape" && this.streaming) {
                event.preventDefault();
                this.stop();
            }
        });
        this.applyAttributes();
    }

    connectedCallback(): void {
        this.applyAttributes();
        if (!this.started) {
            this.started = true;
            this.begin();
        }
    }

    disconnectedCallback(): void {
        this.started = false;
        this.discardConversation();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) {
            return;
        }
        this.applyAttributes();
        if (this.started && (name === "token-url" || name === "base-url" || name === "session-id" || name === "tenant-id")) {
            this.tokenInfo = undefined;
            this.tokenFetch = undefined;
            this.discardConversation();
            this.begin();
        }
    }

    /** Moves the focus to the message box, connecting first if that has not happened yet. */
    open(): void {
        this.input.focus();
        void this.ensureReady();
        this.scrollIntoView?.({ block: "nearest" });
    }

    /** Throws the conversation away and starts a new session, so the next message begins a fresh history. */
    reset(): void {
        this.discardConversation();
        this.freshSession = true;
        this.begin();
        this.input.focus();
    }

    // ---- attributes and labels

    private applyAttributes(): void {
        const theme = this.getAttribute("theme")?.trim().toLowerCase() ?? "";
        this.root.setAttribute("data-theme", THEMES.has(theme) ? theme : "auto");
        const locale = this.getAttribute("locale")?.trim() ?? "";
        if (/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) {
            this.root.setAttribute("lang", locale);
        } else {
            this.root.removeAttribute("lang");
        }
        this.strings = stringsFor(locale);
        this.root.setAttribute("aria-label", this.strings.chat);
        this.log.setAttribute("aria-label", this.strings.conversation);
        this.input.setAttribute("aria-label", this.strings.message);
        this.input.placeholder = this.getAttribute("placeholder") ?? this.strings.placeholder;
        this.sendButton.textContent = this.strings.send;
        for (const name of ["width", "height"] as const) {
            const size = normalizeSize(this.getAttribute(name));
            if (size === null) {
                this.style.removeProperty(name);
            } else {
                this.style.setProperty(name, size);
            }
        }
    }

    // ---- connecting

    private begin(): void {
        this.initDone = false;
        this.initRun = undefined;
        void this.ensureReady();
    }

    /** Fetches a token, loads the history and initializes the session, once; resolves false after showing an error. */
    private ensureReady(): Promise<boolean> {
        if (this.initDone) {
            return Promise.resolve(true);
        }
        if (this.initRun === undefined) {
            const run: Promise<boolean> = this.initialize(this.generation).finally(() => {
                if (this.initRun === run) {
                    this.initRun = undefined;
                }
            });
            this.initRun = run;
        }
        return this.initRun;
    }

    private async initialize(generation: number): Promise<boolean> {
        this.setStatus(this.strings.connecting);
        try {
            const info = await this.currentToken(false);
            const tenant = info.tenantId ?? this.getAttribute("tenant-id")?.trim();
            if (!tenant) {
                throw new ChatError("config-error", "no tenant: the token endpoint returned no tenantId and there is no tenant-id attribute", "errorNoTenant");
            }
            this.tenant = tenant;
            this.sessionId ??= this.chooseSessionId(info.sessionPrefix);
            const sessionId = this.sessionId;
            let known = false;
            if (!this.freshSession) {
                const entries = await this.loadHistory(sessionId);
                if (generation !== this.generation) {
                    return false;
                }
                known = entries > 0;
            }
            if (!known) {
                await this.withToken((token) => this.client(token, MnemoChatClient.Operation.INIT_SESSION, sessionId).build().execute());
            }
            if (generation !== this.generation) {
                return false;
            }
            this.freshSession = false;
            this.initDone = true;
            this.setStatus("");
            this.emit("mnemo-ready", { sessionId });
            return true;
        } catch (e) {
            if (generation === this.generation) {
                this.setStatus("");
                this.fail(e, "errorStart");
            }
            return false;
        }
    }

    /** Shows the earlier turns of the session, oldest first, and returns how many there were. */
    private async loadHistory(sessionId: string): Promise<number> {
        let page: JsonObject;
        try {
            page = await this.withToken((token) => this.client(token, MnemoChatClient.Operation.GET_HISTORY, sessionId)
                .size(HISTORY_SIZE).build().execute<JsonObject>());
        } catch (e) {
            if (e instanceof MnemoClientException && e.httpStatus === 404) {
                return 0; // a session that was never used has no history
            }
            throw e;
        }
        const entries = Array.isArray(page.entries) ? (page.entries as unknown[]) : [];
        for (const entry of [...entries].reverse()) {
            const turn = entry as { request?: { message?: unknown }; response?: { message?: unknown } } | null;
            if (typeof turn?.request?.message === "string") {
                this.addMessage("user", turn.request.message);
            }
            if (typeof turn?.response?.message === "string") {
                this.addMessage("assistant", turn.response.message);
            }
        }
        return entries.length;
    }

    private chooseSessionId(prefix: string): string {
        const attribute = (this.getAttribute("session-id") ?? "").trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
        const key = `mnemo-chat:${this.getAttribute("token-url") ?? ""}|${attribute}`;
        const storage = this.storage();
        let suffix: string | null = null;
        if (!this.freshSession) {
            try {
                suffix = storage?.getItem(key) ?? null;
            } catch {
                // storage is blocked: the session then lasts as long as the page
            }
        }
        if (suffix === null) {
            if (attribute && !this.freshSession) {
                suffix = attribute;
            } else {
                suffix = (attribute ? attribute + "-" : "") + randomId();
                try {
                    storage?.setItem(key, suffix);
                } catch {
                    // see above
                }
            }
        }
        return suffix.startsWith(prefix) ? suffix : prefix + suffix;
    }

    private storage(): Storage | null {
        try {
            return this.ownerDocument.defaultView?.sessionStorage ?? null;
        } catch {
            return null;
        }
    }

    // ---- tokens

    private currentToken(force: boolean): Promise<TokenInfo> {
        const info = this.tokenInfo;
        if (!force && info !== undefined && info.expiresAtMs - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
            return Promise.resolve(info);
        }
        if (this.tokenFetch === undefined) {
            // a fetch that was replaced meanwhile (the token-url changed) must not leave its token behind
            const fetching: Promise<TokenInfo> = this.fetchToken().then((info) => {
                if (this.tokenFetch === fetching) {
                    this.tokenInfo = info;
                }
                return info;
            }).finally(() => {
                if (this.tokenFetch === fetching) {
                    this.tokenFetch = undefined;
                }
            });
            this.tokenFetch = fetching;
        }
        return this.tokenFetch;
    }

    private async fetchToken(): Promise<TokenInfo> {
        const url = this.getAttribute("token-url")?.trim();
        if (!url) {
            throw new ChatError("config-error", "the token-url attribute is required", "errorStart");
        }
        let reply: Response;
        try {
            reply = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store" });
        } catch (e) {
            throw new ChatError("token-error", `the token endpoint could not be reached: ${describe(e)}`, "errorStart");
        }
        if (!reply.ok) {
            throw new ChatError("token-error", `the token endpoint answered HTTP ${reply.status}`, "errorStart", reply.status);
        }
        let json: Record<string, unknown> | null;
        try {
            json = (await reply.json()) as Record<string, unknown> | null;
        } catch {
            throw new ChatError("token-error", "the token endpoint did not answer with JSON", "errorStart");
        }
        const expiresAtMs = parseExpiry(json?.expiresAt);
        if (typeof json?.token !== "string" || json.token.length === 0 || expiresAtMs === null) {
            throw new ChatError("token-error", "the token endpoint's answer lacks token or expiresAt", "errorStart");
        }
        return {
            token: json.token,
            expiresAtMs,
            sessionPrefix: typeof json.sessionPrefix === "string" ? json.sessionPrefix : "",
            tenantId: typeof json.tenantId === "string" && json.tenantId.length > 0 ? json.tenantId : null,
        };
    }

    /** Runs {@code call} with a valid token; when MNEMO answers 401, with a freshly fetched one, once. */
    private async withToken<T>(call: (token: string) => Promise<T>): Promise<T> {
        const info = await this.currentToken(false);
        try {
            return await call(info.token);
        } catch (e) {
            if (!(e instanceof MnemoClientException) || e.httpStatus !== 401) {
                throw e;
            }
        }
        return call((await this.currentToken(true)).token);
    }

    /** A builder for one call: a new one each time, since a builder is never changed after build(). */
    private client(token: string, operation: MnemoChatClient.Operation, sessionId: string): MnemoChatClient.Builder {
        const builder = new MnemoChatClient.Builder().embedToken(token).tenantId(this.tenant!)
            .sessionId(sessionId).operation(operation);
        const baseUrl = this.getAttribute("base-url")?.trim();
        return baseUrl ? builder.baseUrl(baseUrl) : builder.baseUrl(MnemoClientBuilder.DEFAULT_BASE_URL);
    }

    // ---- sending

    private submit(): void {
        const text = this.input.value.trim();
        if (text.length === 0 || this.streaming) {
            return;
        }
        this.input.value = "";
        void this.send(text);
    }

    private async send(text: string): Promise<void> {
        const generation = this.generation;
        this.setStreaming(true);
        this.setError("");
        this.addMessage("user", text);
        this.emit("mnemo-message", { role: "user", text });
        const bubble = this.addMessage("assistant", "");
        bubble.classList.add("pending");
        let answer = "";
        let failure: unknown = null;
        try {
            const ready = await this.ensureReady();
            if (generation !== this.generation) {
                return;
            }
            if (!ready) {
                bubble.remove();
                this.setStreaming(false);
                return;
            }
            const sessionId = this.sessionId!;
            const events = await this.withToken((token) => this.client(token, MnemoChatClient.Operation.CHAT_STREAM, sessionId)
                .message(text).build().execute<AsyncIterable<StreamEvent>>());
            for await (const event of events) {
                if (generation !== this.generation) {
                    return;
                }
                if (event.event === "message") {
                    answer += event.data;
                    bubble.classList.remove("pending");
                    this.fillMessage(bubble, "assistant", answer);
                    this.keepAtBottom();
                } else if (event.event === "quota-warning") {
                    this.setStatus(jsonField(event.data, "message") ?? "");
                } else if (event.event === "error") {
                    failure = new ChatError("chat-error", jsonField(event.data, "error") ?? "the service reported an error", "errorSend");
                    break;
                } else if (event.event === "done") {
                    break;
                }
            }
        } catch (e) {
            failure = e;
        }
        if (generation !== this.generation) {
            return;
        }
        bubble.classList.remove("pending");
        if (answer.length === 0) {
            bubble.remove();
        }
        this.setStreaming(false);
        if (answer.length > 0) {
            this.emit("mnemo-message", { role: "assistant", text: answer });
        }
        if (failure !== null) {
            this.fail(failure, "errorSend");
        } else if (answer.length === 0) {
            this.fail(new ChatError("chat-error", "the answer was empty", "errorSend"), "errorSend");
        }
        this.input.focus();
    }

    /** Stops waiting for the answer in progress; what has arrived stays. */
    private stop(): void {
        const wasStreaming = this.streaming;
        this.generation++;
        this.setStreaming(false);
        for (const pending of Array.from(this.log.querySelectorAll(".pending"))) {
            pending.remove();
        }
        if (wasStreaming) {
            this.setStatus("");
        }
    }

    private discardConversation(): void {
        this.generation++;
        this.initDone = false;
        this.initRun = undefined;
        this.sessionId = undefined;
        this.streaming = false;
        this.sendButton.disabled = false;
        this.log.removeAttribute("aria-busy");
        this.log.replaceChildren();
        this.setStatus("");
        this.setError("");
    }

    // ---- display

    private addMessage(role: Role, text: string): HTMLElement {
        const bubble = this.ownerDocument.createElement("div");
        bubble.className = `msg ${role}`;
        this.fillMessage(bubble, role, text);
        this.log.appendChild(bubble);
        this.keepAtBottom();
        return bubble;
    }

    /** Replaces the content of a bubble; the answer is untrusted, so it goes through the safe renderer. */
    private fillMessage(bubble: HTMLElement, role: Role, text: string): void {
        const doc = this.ownerDocument;
        const who = doc.createElement("span");
        who.className = "sr-only";
        who.textContent = (role === "user" ? this.strings.you : this.strings.assistant) + ": ";
        if (role === "user") {
            bubble.replaceChildren(who, doc.createTextNode(text));
        } else {
            bubble.replaceChildren(who, renderMarkdown(text, doc));
        }
    }

    private keepAtBottom(): void {
        this.log.scrollTop = this.log.scrollHeight;
    }

    private setStreaming(streaming: boolean): void {
        this.streaming = streaming;
        this.sendButton.disabled = streaming;
        if (streaming) {
            this.log.setAttribute("aria-busy", "true");
            this.setStatus(this.strings.thinking);
        } else {
            this.log.removeAttribute("aria-busy");
            this.setStatus("");
        }
    }

    private setStatus(text: string): void {
        this.statusLine.textContent = text;
    }

    private setError(text: string): void {
        this.errorLine.textContent = text;
    }

    /** Shows a short, translated message to the visitor and tells the page the details with {@code mnemo-error}. */
    private fail(e: unknown, fallback: keyof Strings): void {
        let code = "client-error";
        let message = describe(e);
        let status = 0;
        let shown: keyof Strings = fallback;
        if (e instanceof ChatError) {
            code = e.code;
            status = e.status;
            shown = e.userMessage;
        } else if (e instanceof MnemoClientException) {
            code = e.error.code;
            status = e.httpStatus;
            message = e.message;
            if (status === 401 || status === 403) {
                shown = "errorSession";
            } else if (status === 429) {
                shown = "errorBusy";
            }
        }
        this.setError(this.strings[shown]);
        this.setStreaming(false);
        this.emit("mnemo-error", { code, message, status });
    }

    private emit(name: string, detail: Record<string, unknown>): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }
}

function describe(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

function jsonField(data: string, field: string): string | null {
    try {
        const value = (JSON.parse(data) as Record<string, unknown> | null)?.[field];
        return typeof value === "string" ? value : null;
    } catch {
        return null;
    }
}

/** An ISO-8601 instant, or a number of epoch seconds (or milliseconds), as milliseconds; {@code null} when unreadable. */
function parseExpiry(value: unknown): number | null {
    let ms: number;
    if (typeof value === "number") {
        ms = value < 1e11 ? value * 1000 : value;
    } else if (typeof value === "string" && value.trim().length > 0) {
        ms = /^\d+(\.\d+)?$/.test(value.trim()) ? parseExpiry(Number(value)) ?? NaN : Date.parse(value);
    } else {
        return null;
    }
    return Number.isFinite(ms) ? ms : null;
}

function randomId(): string {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
