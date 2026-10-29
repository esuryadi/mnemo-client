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

export const TOKEN_HEADER = "X-Mnemo-Api-Token";

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
        if (isBlank(this.settings._apiKey)) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.MISSING_API_KEY));
        }
        if (isBlank(this.settings._baseUrl)) {
            throw invalid("baseUrl is required");
        }
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

    private async request(method: string, url: string, accept: string, body?: object): Promise<string> {
        const headers: Record<string, string> = { Accept: accept, [TOKEN_HEADER]: this.settings._apiKey! };
        if (body !== undefined) {
            headers["Content-Type"] = "application/json";
        }
        const timeout = this.settings._timeoutMs;
        let status = 0;
        try {
            // fetch does not normalize the case of PATCH, so methods are always passed in upper case
            const response = await fetch(url, {
                method: method.toUpperCase(),
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
            });
            status = response.status;
            const text = await response.text();
            if (status >= 400) {
                throw failure(status, text);
            }
            return status === 204 ? "" : text;
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
    const events: SseEvent[] = [];
    let name: string | null = null;
    let data: string[] = [];
    let open = false;
    for (const line of text.split(/\r?\n/)) {
        if (line.length === 0) {
            if (open) {
                events.push({ name: name ?? "message", data: data.join("\n") });
            }
            name = null;
            data = [];
            open = false;
        } else if (!line.startsWith(":")) {
            const colon = line.indexOf(":");
            const field = colon < 0 ? line : line.substring(0, colon);
            let value = colon < 0 ? "" : line.substring(colon + 1);
            if (value.startsWith(" ")) {
                value = value.substring(1);
            }
            if (field === "event") {
                name = value;
                open = true;
            } else if (field === "data") {
                data.push(value);
                open = true;
            }
        }
    }
    if (open) {
        events.push({ name: name ?? "message", data: data.join("\n") });
    }
    return events;
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
