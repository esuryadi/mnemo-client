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

import { MnemoClientException } from "./exception/MnemoClientException.js";
import { MnemoError } from "./exception/MnemoError.js";
import type { MnemoClient } from "./MnemoClient.js";
import type { MnemoClientBuilder } from "./MnemoClientBuilder.js";
import type { StreamEvent } from "./model/index.js";

export const TOKEN_HEADER = "X-Mnemo-Api-Token";
/** Milliseconds before a client-credentials token expires at which it is replaced. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

/** One server-sent event: its name ({@code message} when none was given) and its data. */
export interface SseEvent {
    name: string;
    data: string;
}

type Params = Record<string, string | number | boolean | null | undefined>;

/**
 * <b>AbstractMnemoClient</b> holds the plumbing shared by every client implementation: validating the
 * builder settings, calling the MNEMO REST API with {@code fetch} and translating HTTP failures into
 * {@link MnemoClientException}s. Nothing is kept between calls, so instances hold no connections.
 *
 * @internal
 */
export abstract class AbstractMnemoClient implements MnemoClient {
    private readonly settings: MnemoClientBuilder;

    protected constructor(builder: MnemoClientBuilder) {
        this.settings = builder;
    }

    abstract execute<T = unknown>(): Promise<T>;

    /** Runs {@code call} with the service base URL after validating the builder settings. */
    protected async withTarget<T>(call: (base: string) => Promise<T>): Promise<T> {
        const hasClient = !(isBlank(this.settings._clientId) && isBlank(this.settings._clientSecret));
        const hasEmbed = !isBlank(this.settings._embedToken);
        if (hasClient && !isBlank(this.settings._apiKey)) {
            throw invalid("set either apiKey or clientCredentials, not both");
        }
        if (hasEmbed && !isBlank(this.settings._apiKey)) {
            throw invalid("set either apiKey or embedToken, not both");
        }
        if (hasEmbed && hasClient) {
            throw invalid("set either clientCredentials or embedToken, not both");
        }
        if (hasClient && (isBlank(this.settings._clientId) || isBlank(this.settings._clientSecret))) {
            throw invalid("clientCredentials needs both a client id and a client secret");
        }
        if (!hasClient && !hasEmbed && isBlank(this.settings._apiKey)) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.MISSING_API_KEY));
        }
        if (isBlank(this.settings._baseUrl)) {
            throw invalid("baseUrl is required");
        }
        checkBaseUrl(this.settings._baseUrl);
        const timeout = this.settings._timeoutMs;
        if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout < 0) {
            throw invalid("timeout must be zero or positive");
        }
        return call(this.settings._baseUrl.replace(/\/+$/, ""));
    }

    /**
     * Sends one request and parses the JSON reply; when {@code expectBody} is false, a 204 or an empty
     * body, it resolves with {@code null}.
     */
    protected async send<T>(method: string, url: string, body?: object, expectBody = true): Promise<T> {
        const text = await this.request(method, url, "application/json", body);
        if (!expectBody || text.length === 0) {
            return null as T;
        }
        return parseJson(text) as T;
    }

    /**
     * Sends one request that answers with a server-sent event stream and reads the stream to its end.
     * The stream is finite for the calls that use this (it ends after a final event), so it is read whole.
     */
    protected async sendEventStream(method: string, url: string, body: object): Promise<SseEvent[]> {
        return parseEvents(await this.request(method, url, "text/event-stream", body));
    }

    /**
     * Sends one request that answers with a server-sent event stream and resolves, once the service has
     * accepted it (so a 401, 403 or 429 rejects here), with the events as they arrive. Breaking out of the
     * loop cancels the stream. The builder's timeout covers the whole stream, not only the wait for the answer.
     */
    protected async streamEvents(method: string, url: string, body: object): Promise<AsyncGenerator<StreamEvent>> {
        const response = await this.withAuth((auth) => this.open(method, url, "text/event-stream", body, auth));
        return readEvents(response);
    }

    private async request(method: string, url: string, accept: string, body?: object): Promise<string> {
        return this.withAuth(async (auth) => {
            const response = await this.open(method, url, accept, body, auth);
            return this.text(response);
        });
    }

    /**
     * Runs {@code call} with the authentication headers. A client-credentials token that the service rejects
     * with 401 is replaced and the call made once more; an API key or embed token is used as it is.
     */
    private async withAuth<R>(call: (auth: Record<string, string>) => Promise<R>): Promise<R> {
        if (isBlank(this.settings._clientId)) {
            const key = isBlank(this.settings._embedToken) ? this.settings._apiKey! : this.settings._embedToken!;
            return call({ [TOKEN_HEADER]: key });
        }
        try {
            return await call(await this.bearer(false));
        } catch (e) {
            if (!(e instanceof MnemoClientException) || e.httpStatus !== 401) {
                throw e;
            }
        }
        // the cached token was revoked or its client was rotated: fetch a new one and try once more
        return call(await this.bearer(true));
    }

    private async bearer(replace: boolean): Promise<Record<string, string>> {
        return { Authorization: "Bearer " + (await this.accessToken(replace)) };
    }

    /**
     * Returns the cached bearer token, fetching one first when there is none, it is about to expire, or
     * {@code replace} is set. The token lives on the builder, which every call of this client shares.
     */
    private async accessToken(replace: boolean): Promise<string> {
        const s = this.settings;
        const cache = s._oauth;
        if (!replace && cache.token !== undefined && cache.token.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
            return cache.token.value;
        }
        if (cache.fetch === undefined) {
            cache.fetch = this.fetchToken().finally(() => {
                cache.fetch = undefined;
            });
        }
        return cache.fetch;
    }

    private async fetchToken(): Promise<string> {
        const s = this.settings;
        const credentials = `${encodeURIComponent(s._clientId!)}:${encodeURIComponent(s._clientSecret!)}`;
        const text = await this.perform("POST", s._baseUrl.replace(/\/+$/, "") + "/oauth/token", "application/json",
            new URLSearchParams({ grant_type: "client_credentials" }), {
                Authorization: "Basic " + btoa(credentials),
            });
        const reply = parseJson(text);
        const expiresIn = Number(reply?.expires_in);
        if (typeof reply?.access_token !== "string" || !Number.isFinite(expiresIn)) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.SERIALIZATION_ERROR));
        }
        s._oauth.token = { value: reply.access_token, expiresAt: Date.now() + expiresIn * 1000 };
        return reply.access_token;
    }

    /** Sends one request and reads the whole answer as text. */
    private async perform(method: string, url: string, accept: string, body: object | undefined,
                           auth: Record<string, string>): Promise<string> {
        return this.text(await this.open(method, url, accept, body, auth));
    }

    private async text(response: Response): Promise<string> {
        try {
            const text = await response.text();
            return response.status === 204 ? "" : text;
        } catch (e) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.IO_ERROR), 0, { cause: e });
        }
    }

    /**
     * Sends one request and resolves with the response once its status is known to be a success: an error
     * status rejects (its body is read for the message), and a redirect is never followed.
     */
    private async open(method: string, url: string, accept: string, body: object | undefined,
                       auth: Record<string, string>): Promise<Response> {
        const headers: Record<string, string> = { Accept: accept, ...auth };
        let payload: string | URLSearchParams | undefined;
        if (body instanceof URLSearchParams) {
            payload = body; // fetch sets the form content type itself
        } else if (body !== undefined) {
            headers["Content-Type"] = "application/json";
            payload = JSON.stringify(body);
        }
        const timeout = this.settings._timeoutMs;
        let status = 0;
        try {
            // fetch does not normalize the case of PATCH, so methods are always passed in upper case
            const response = await fetch(url, {
                method: method.toUpperCase(),
                headers,
                body: payload,
                // the credentials travel in headers, which fetch would resend to wherever a redirect points
                redirect: "manual",
                signal: timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
            });
            status = response.status;
            if (status >= 300 && status < 400) {
                throw new MnemoClientException(new MnemoError(MnemoError.Code.INVALID_REQUEST,
                    `the service answered with a redirect (HTTP ${status}), which is not followed so the `
                    + "credentials are never sent to another location; check the baseUrl"), status);
            }
            if (status >= 400) {
                throw failure(status, await response.text());
            }
            return response;
        } catch (e) {
            if (e instanceof MnemoClientException) {
                throw e;
            }
            throw new MnemoClientException(new MnemoError(MnemoError.Code.IO_ERROR), 0, { cause: e });
        }
    }

    protected tenantId(): string | undefined {
        return this.settings._tenantId;
    }
}

export function parseEvents(text: string): SseEvent[] {
    const parser = new SseParser();
    return [...parser.push(text), ...parser.end()];
}

/**
 * Reads the events of {@code response} as the chunks arrive. A broken connection or an expired timeout part
 * way through rejects the iteration with {@code IO_ERROR}. Ending the iteration early cancels the stream.
 */
async function* readEvents(response: Response): AsyncGenerator<StreamEvent> {
    const stream = response.body;
    if (stream == null) {
        return;
    }
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    try {
        for (;;) {
            let chunk: ReadableStreamReadResult<Uint8Array>;
            try {
                chunk = await reader.read();
            } catch (e) {
                throw new MnemoClientException(new MnemoError(MnemoError.Code.IO_ERROR), 0, { cause: e });
            }
            if (chunk.done) {
                break;
            }
            for (const event of parser.push(decoder.decode(chunk.value, { stream: true }))) {
                yield { event: event.name, data: event.data };
            }
        }
        for (const event of [...parser.push(decoder.decode()), ...parser.end()]) {
            yield { event: event.name, data: event.data };
        }
    } finally {
        await reader.cancel().catch(() => undefined);
    }
}

/**
 * An incremental server-sent events parser: feed it text as it arrives and it returns the events completed
 * so far. Lines end with LF, CRLF or a lone CR; a CR at the end of a chunk is held back until the next chunk
 * shows whether an LF follows. An event is dispatched at the blank line; one with neither an {@code event}
 * nor a {@code data} line is dropped.
 *
 * @internal
 */
export class SseParser {
    private buffer = "";
    private name: string | null = null;
    private data: string[] = [];
    private open = false;

    push(chunk: string): SseEvent[] {
        this.buffer += chunk;
        const held = this.buffer.endsWith("\r") ? "\r" : "";
        const lines = (held ? this.buffer.slice(0, -1) : this.buffer).split(/\r\n|\r|\n/);
        this.buffer = lines.pop()! + held;
        const events: SseEvent[] = [];
        for (const line of lines) {
            this.line(line, events);
        }
        return events;
    }

    /** Ends the input: the last line and the last event count even without their line break. */
    end(): SseEvent[] {
        const events: SseEvent[] = [];
        if (this.buffer.length > 0) {
            this.line(this.buffer.replace(/\r$/, ""), events);
            this.buffer = "";
        }
        this.dispatch(events);
        return events;
    }

    private line(line: string, events: SseEvent[]): void {
        if (line.length === 0) {
            this.dispatch(events);
        } else if (!line.startsWith(":")) {
            const colon = line.indexOf(":");
            const field = colon < 0 ? line : line.substring(0, colon);
            let value = colon < 0 ? "" : line.substring(colon + 1);
            if (value.startsWith(" ")) {
                value = value.substring(1);
            }
            if (field === "event") {
                this.name = value;
                this.open = true;
            } else if (field === "data") {
                this.data.push(value);
                this.open = true;
            }
        }
    }

    private dispatch(events: SseEvent[]): void {
        if (this.open) {
            events.push({ name: this.name ?? "message", data: this.data.join("\n") });
        }
        this.name = null;
        this.data = [];
        this.open = false;
    }
}

export function parseJson(text: string): any {
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new MnemoClientException(new MnemoError(MnemoError.Code.SERIALIZATION_ERROR), 0, { cause: e });
    }
}

function failure(status: number, text: string): MnemoClientException {
    let code: MnemoError.Code;
    if (status === 401) code = MnemoError.Code.UNAUTHORIZED;
    else if (status === 403) code = MnemoError.Code.FORBIDDEN;
    else if (status === 404) code = MnemoError.Code.NOT_FOUND;
    else if (status === 429) code = MnemoError.Code.RATE_LIMITED;
    else if (status >= 500) code = MnemoError.Code.SERVER_ERROR;
    else code = MnemoError.Code.INVALID_REQUEST;
    let detail: string | null = null;
    try {
        const error = JSON.parse(text)?.error;
        detail = error == null ? null : String(error);
    } catch {
        // the body was not the usual {"error": "..."} JSON; fall back to the code's default message
    }
    return new MnemoClientException(new MnemoError(code, detail), status);
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Refuses a base URL that is not https, except http to a loopback host, so credentials never travel in cleartext. */
function checkBaseUrl(baseUrl: string): void {
    let url: URL;
    try {
        url = new URL(baseUrl.trim());
    } catch {
        throw invalid("baseUrl is not a valid URL");
    }
    if (url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname))) {
        return;
    }
    throw invalid("baseUrl must use https (http is allowed only for localhost, 127.0.0.1 and ::1)");
}

export function isBlank(value: string | null | undefined): boolean {
    return value == null || value.trim().length === 0;
}

export function require(value: string | null | undefined, name: string): string {
    if (isBlank(value)) {
        throw invalid(`${name} is required`);
    }
    return value!;
}

export function invalid(message: string): MnemoClientException {
    return new MnemoClientException(new MnemoError(MnemoError.Code.INVALID_REQUEST, message));
}

/** Builds a body object that skips null and undefined values, so only the parameters the caller set are sent. */
export function body(values: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
        if (value != null) {
            result[key] = value;
        }
    }
    return result;
}

/** Appends the query parameters whose value is set, in the order given. */
export function query(url: string, params: Params): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        if (value != null) {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }
    return parts.length === 0 ? url : `${url}?${parts.join("&")}`;
}

/** Resolves the {@code {name}} placeholders of a path template, encoding each value as one path segment. */
export function path(base: string, template: string, values: Record<string, string> = {}): string {
    return `${base}/${template.replace(/\{(\w+)}/g, (_, key: string) => encodeURIComponent(values[key]!))}`;
}
