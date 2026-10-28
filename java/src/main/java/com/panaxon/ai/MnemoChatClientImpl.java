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
 * Multi-Dimensional Neural Elastic Memory Organization (MNEMO) - Java core implementation.
 *
 * Inventor: Edward Suryadi
 * Assignee: PANAXON.AI, LLC
 *
 * Author: edward.suryadi
 * Since: Oct-2026
 */

package com.panaxon.ai;

import com.panaxon.ai.exception.MnemoClientException;
import com.panaxon.ai.model.ChatMessageResponse;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.GenericType;

import java.util.List;
import java.util.Map;

/**
 * <b>MnemoChatClientImpl</b> is a concrete implementation of the {@link MnemoChatClient} interface.
 * It provides the actual logic for executing chat-related operations within the MNEMO system.
 * This class is responsible for handling requests and processing responses in a chat context.
 *
 * @author edward.suryadi
 * @since 1.0
 */
class MnemoChatClientImpl extends AbstractMnemoClient implements MnemoChatClient {
    private final Builder builder;

    MnemoChatClientImpl(Builder builder) {
        super(builder);
        this.builder = builder;
    }

    /** Dispatches to the method that implements the operation chosen on the builder. */
    @Override
    @SuppressWarnings("unchecked")
    public <T> T execute() throws MnemoClientException {
        Operation operation = builder.operation();
        if (operation == null) {
            throw invalid("operation is required");
        }
        return (T) withTarget(base -> switch (operation) {
            case CHAT -> chat(base);
            case LIST_SESSIONS -> listSessions(base);
            case GET_HISTORY -> getHistory(base);
            case RENAME_SESSION -> renameSession(base);
            case CLOSE_SESSION -> closeSession(base);
            case LIST_SUBJECTS -> listSubjects(base);
            case DELETE_SUBJECT -> deleteSubject(base);
            case UPDATE_SUBJECT_DESCRIPTION -> updateSubjectDescription(base);
            case GET_PLAN -> getPlan(base);
            case HEALTH -> health(base);
        });
    }

    private ChatMessageResponse chat(WebTarget base) throws MnemoClientException {
        return send("POST", base.path("mnemo/chat"),
                body("tenantId", require(tenantId(), "tenantId"),
                        "sessionId", require(builder.sessionId(), "sessionId"),
                        "message", require(builder.message(), "message")),
                new GenericType<ChatMessageResponse>() { });
    }

    private Map<String, Object> listSessions(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/sessions"),
                "tenantId", require(tenantId(), "tenantId"), "q", builder.query(),
                "page", builder.page(), "size", builder.size()), null, MAP);
    }

    private Map<String, Object> getHistory(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/sessions/{id}/history")
                .resolveTemplate("id", require(builder.sessionId(), "sessionId")),
                "tenantId", require(tenantId(), "tenantId"), "before", builder.before(),
                "size", builder.size()), null, MAP);
    }

    private Map<String, Object> renameSession(WebTarget base) throws MnemoClientException {
        return send("PATCH", base.path("mnemo/sessions/{id}/name")
                .resolveTemplate("id", require(builder.sessionId(), "sessionId")),
                body("sessionName", require(builder.sessionName(), "sessionName")), MAP);
    }

    private Object closeSession(WebTarget base) throws MnemoClientException {
        return send("DELETE", query(base.path("mnemo/sessions/{id}")
                .resolveTemplate("id", require(builder.sessionId(), "sessionId")),
                "tenantId", require(tenantId(), "tenantId"), "permanent", builder.permanent()), null, null);
    }

    private List<Map<String, Object>> listSubjects(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/subjects"),
                "tenantId", require(tenantId(), "tenantId")), null, LIST);
    }

    private Object deleteSubject(WebTarget base) throws MnemoClientException {
        return send("DELETE", query(base.path("mnemo/subject/{name}")
                .resolveTemplate("name", require(builder.subjectName(), "subjectName")),
                "tenantId", require(tenantId(), "tenantId")), null, null);
    }

    private Map<String, Object> updateSubjectDescription(WebTarget base) throws MnemoClientException {
        return send("PATCH", base.path("mnemo/subject/{name}/description")
                .resolveTemplate("name", require(builder.subjectName(), "subjectName")),
                body("tenantId", require(tenantId(), "tenantId"), "description", builder.description()), MAP);
    }

    private Map<String, Object> getPlan(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/plan"),
                "tenantId", require(tenantId(), "tenantId")), null, MAP);
    }

    private Map<String, Object> health(WebTarget base) throws MnemoClientException {
        return send("GET", base.path("mnemo/health"), null, MAP);
    }
}
