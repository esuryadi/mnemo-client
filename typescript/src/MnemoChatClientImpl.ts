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

import { AbstractMnemoClient, body, invalid, parseJson, path, query, require } from "./AbstractMnemoClient.js";
import { MnemoClientException } from "./exception/MnemoClientException.js";
import { MnemoError } from "./exception/MnemoError.js";
import { MnemoChatClient } from "./MnemoChatClient.js";
import type { ChatMessageResponse, JsonObject } from "./model/index.js";

/**
 * <b>MnemoChatClientImpl</b> implements {@link MnemoChatClient}: one private method per operation.
 *
 * @internal
 */
export class MnemoChatClientImpl extends AbstractMnemoClient implements MnemoChatClient {
    private readonly builder: MnemoChatClient.Builder;

    constructor(builder: MnemoChatClient.Builder) {
        super(builder);
        this.builder = builder;
    }

    /** Dispatches to the method that implements the operation chosen on the builder. */
    async execute<T = unknown>(): Promise<T> {
        const operation = this.builder._operation;
        if (operation == null) {
            throw invalid("operation is required");
        }
        const Op = MnemoChatClient.Operation;
        return this.withTarget(async (base): Promise<unknown> => {
            switch (operation) {
                case Op.INIT_SESSION: return this.initSession(base);
                case Op.CHAT: return this.chat(base);
                case Op.LIST_SESSIONS: return this.listSessions(base);
                case Op.GET_HISTORY: return this.getHistory(base);
                case Op.RENAME_SESSION: return this.renameSession(base);
                case Op.CLOSE_SESSION: return this.closeSession(base);
                case Op.LIST_SUBJECTS: return this.listSubjects(base);
                case Op.DELETE_SUBJECT: return this.deleteSubject(base);
                case Op.UPDATE_SUBJECT_DESCRIPTION: return this.updateSubjectDescription(base);
                case Op.GET_PLAN: return this.getPlan(base);
                case Op.HEALTH: return this.health(base);
                default: throw invalid(`unknown operation ${String(operation)}`);
            }
        }) as Promise<T>;
    }

    private async initSession(base: string): Promise<JsonObject> {
        const events = await this.sendEventStream("POST", path(base, "mnemo/init/stream"),
            body({
                tenantId: require(this.tenantId(), "tenantId"),
                sessionId: require(this.builder._sessionId, "sessionId"),
                sessionName: this.builder._sessionName,
            }));
        const stages: JsonObject[] = [];
        let complete: JsonObject | null = null;
        for (const event of events) {
            if (event.name === "init-stage") {
                stages.push(parseJson(event.data));
            } else if (event.name === "complete") {
                complete = parseJson(event.data);
            } else if (event.name === "error") {
                const error = parseJson(event.data)?.error;
                throw new MnemoClientException(new MnemoError(MnemoError.Code.INIT_FAILED,
                    error == null ? event.data : String(error)));
            }
        }
        if (complete == null) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.INIT_FAILED,
                "The service ended the stream before initialization completed"));
        }
        return { ...complete, ready: true, stages };
    }

    private chat(base: string): Promise<ChatMessageResponse> {
        return this.send("POST", path(base, "mnemo/chat"),
            body({
                tenantId: require(this.tenantId(), "tenantId"),
                sessionId: require(this.builder._sessionId, "sessionId"),
                message: require(this.builder._message, "message"),
            }));
    }

    private listSessions(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/sessions"), {
            tenantId: require(this.tenantId(), "tenantId"), q: this.builder._query,
            page: this.builder._page, size: this.builder._size,
        }));
    }

    private getHistory(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/sessions/{id}/history",
            { id: require(this.builder._sessionId, "sessionId") }), {
            tenantId: require(this.tenantId(), "tenantId"), before: this.builder._before,
            size: this.builder._size,
        }));
    }

    private renameSession(base: string): Promise<JsonObject> {
        return this.send("PATCH", path(base, "mnemo/sessions/{id}/name",
            { id: require(this.builder._sessionId, "sessionId") }),
            body({
                tenantId: require(this.tenantId(), "tenantId"),
                sessionName: require(this.builder._sessionName, "sessionName"),
            }));
    }

    private closeSession(base: string): Promise<null> {
        return this.send("DELETE", query(path(base, "mnemo/sessions/{id}",
            { id: require(this.builder._sessionId, "sessionId") }), {
            tenantId: require(this.tenantId(), "tenantId"), permanent: this.builder._permanent,
        }), undefined, false);
    }

    private listSubjects(base: string): Promise<JsonObject[]> {
        return this.send("GET", query(path(base, "mnemo/subjects"),
            { tenantId: require(this.tenantId(), "tenantId") }));
    }

    private deleteSubject(base: string): Promise<null> {
        return this.send("DELETE", query(path(base, "mnemo/subject/{name}",
            { name: require(this.builder._subjectName, "subjectName") }),
            { tenantId: require(this.tenantId(), "tenantId") }), undefined, false);
    }

    private updateSubjectDescription(base: string): Promise<JsonObject> {
        return this.send("PATCH", path(base, "mnemo/subject/{name}/description",
            { name: require(this.builder._subjectName, "subjectName") }),
            body({ tenantId: require(this.tenantId(), "tenantId"), description: this.builder._description }));
    }

    private getPlan(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/plan"),
            { tenantId: require(this.tenantId(), "tenantId") }));
    }

    private health(base: string): Promise<JsonObject> {
        return this.send("GET", path(base, "mnemo/health"));
    }
}
