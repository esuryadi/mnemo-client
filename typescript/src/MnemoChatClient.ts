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

import type { MnemoClient } from "./MnemoClient.js";
import { MnemoClientBuilder } from "./MnemoClientBuilder.js";
import { MnemoChatClientImpl } from "./MnemoChatClientImpl.js";

/**
 * <b>MnemoChatClient</b> handles conversational interactions with MNEMO: sessions, chat, history, memory
 * subjects, the tenant's plan and the health check.
 *
 * A client performs one {@link MnemoChatClient.Operation}, chosen on the builder (default {@code CHAT}).
 * The builder holds the parameters; {@code execute()} sends the call and resolves with the result.
 *
 * @example
 * // a new session is initialized once, then chatted in as often as needed
 * await new MnemoChatClient.Builder()
 *     .apiKey(process.env.MNEMO_API_KEY!)
 *     .tenantId("acme")
 *     .sessionId("session-1")
 *     .operation(MnemoChatClient.Operation.INIT_SESSION)
 *     .build().execute();
 *
 * const client: MnemoClient = new MnemoChatClient.Builder()
 *     .apiKey(process.env.MNEMO_API_KEY!)
 *     .tenantId("acme")
 *     .sessionId("session-1")
 *     .message("What did I eat on Monday?")
 *     .build();
 * const reply = await client.execute<ChatMessageResponse>();
 * console.log(reply.message);
 */
export interface MnemoChatClient extends MnemoClient {}

export namespace MnemoChatClient {
    /** The chat-related calls, with the builder parameters each one reads and the type {@code execute()} resolves with. */
    export enum Operation {
        /**
         * Prepares a new session so it can be chatted in; needs tenantId, sessionId, optional sessionName. A session
         * must be initialized once before its first {@code CHAT}: the service refuses a chat on an uninitialized
         * session with HTTP 409. Waits for initialization to finish (it can take ten seconds or more) and resolves
         * with a {@code JsonObject} holding {@code ready}, {@code message}, {@code totalMs} and the {@code stages}
         * that ran; rejects with {@code INIT_FAILED} if initialization fails.
         */
        INIT_SESSION = "INIT_SESSION",
        /** Sends {@code message} in {@code sessionId}; needs tenantId, sessionId, message. Resolves with {@code ChatMessageResponse}. */
        CHAT = "CHAT",
        /** Lists sessions; needs tenantId, optional query/page/size. The query must equal a session's name exactly; it is not a partial-text search. Resolves with {@code JsonObject} (a page). */
        LIST_SESSIONS = "LIST_SESSIONS",
        /** One page of a session's history, newest first; needs tenantId, sessionId, optional before/size. Resolves with {@code JsonObject}. */
        GET_HISTORY = "GET_HISTORY",
        /** Renames a session; needs tenantId, sessionId, sessionName. Resolves with {@code JsonObject}. */
        RENAME_SESSION = "RENAME_SESSION",
        /** Closes a session, or deletes it when {@code permanent}; needs tenantId, sessionId. Resolves with {@code null}. */
        CLOSE_SESSION = "CLOSE_SESSION",
        /** Lists the tenant's memory subjects; needs tenantId. Resolves with {@code JsonObject[]}. */
        LIST_SUBJECTS = "LIST_SUBJECTS",
        /** Deletes a subject and all its memory; needs tenantId, subjectName. Resolves with {@code null}. */
        DELETE_SUBJECT = "DELETE_SUBJECT",
        /** Sets (or re-synthesizes, when blank) a subject's description; needs tenantId, subjectName. Resolves with {@code JsonObject}. */
        UPDATE_SUBJECT_DESCRIPTION = "UPDATE_SUBJECT_DESCRIPTION",
        /** The tenant's plan and quota usage; needs tenantId. Resolves with {@code JsonObject}. */
        GET_PLAN = "GET_PLAN",
        /** Service health check. Resolves with {@code JsonObject}. */
        HEALTH = "HEALTH",
    }

    /**
     * <b>Builder</b> collects the call parameters for a {@link MnemoChatClient} and passes itself to the client
     * implementation in {@link build}.
     */
    export class Builder extends MnemoClientBuilder {
        /** @internal */ _operation?: Operation = Operation.CHAT;
        /** @internal */ _sessionId?: string;
        /** @internal */ _message?: string;
        /** @internal */ _sessionName?: string;
        /** @internal */ _subjectName?: string;
        /** @internal */ _description?: string;
        /** @internal */ _query?: string;
        /** @internal */ _page?: number;
        /** @internal */ _size?: number;
        /** @internal */ _before?: number;
        /** @internal */ _permanent = false;

        operation(operation: Operation): this {
            this._operation = operation;
            return this;
        }

        sessionId(sessionId: string): this {
            this._sessionId = sessionId;
            return this;
        }

        /** The user message for {@code CHAT}. */
        message(message: string): this {
            this._message = message;
            return this;
        }

        /** The name for {@code INIT_SESSION} (optional), or the new name for {@code RENAME_SESSION}. */
        sessionName(sessionName: string): this {
            this._sessionName = sessionName;
            return this;
        }

        subjectName(subjectName: string): this {
            this._subjectName = subjectName;
            return this;
        }

        /** The subject description for {@code UPDATE_SUBJECT_DESCRIPTION}; blank asks MNEMO to write one. */
        description(description: string): this {
            this._description = description;
            return this;
        }

        /** For {@code LIST_SESSIONS}: return only sessions whose name equals this text exactly. */
        query(query: string): this {
            this._query = query;
            return this;
        }

        page(page: number): this {
            this._page = page;
            return this;
        }

        size(size: number): this {
            this._size = size;
            return this;
        }

        /** Epoch-millis cursor for {@code GET_HISTORY}: only messages before it are returned. */
        before(beforeEpochMillis: number): this {
            this._before = beforeEpochMillis;
            return this;
        }

        /** For {@code CLOSE_SESSION}: delete the session permanently instead of just closing it. */
        permanent(permanent: boolean): this {
            this._permanent = permanent;
            return this;
        }

        build(): MnemoChatClient {
            return new MnemoChatClientImpl(this);
        }
    }
}
