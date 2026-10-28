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

/**
 * <b>MnemoChatClient</b> is an interface that defines the contract for a chat client within the MNEMO system.
 * Implementations of this interface should provide methods for managing conversational interactions,
 * handling user inputs, and generating appropriate responses.
 *
 * <p>A client performs one {@link Operation}, chosen on the builder (default {@link Operation#CHAT}).
 * The builder holds the parameters; {@link #execute()} sends the call and returns the result.
 *
 * <h2>Example: chat</h2>
 * <pre>{@code
 * MnemoClient client = new MnemoChatClient.Builder()
 *         .apiKey(System.getenv("MNEMO_API_KEY"))
 *         .tenantId("acme")
 *         .sessionId("session-1")
 *         .message("What did I eat on Monday?")
 *         .build();
 *
 * ChatMessageResponse reply = client.execute();
 * System.out.println(reply.message());
 * }</pre>
 *
 * <h2>Example: browse stored subjects and history</h2>
 * <pre>{@code
 * List<Map<String, Object>> subjects = new MnemoChatClient.Builder()
 *         .apiKey(key).tenantId("acme")
 *         .operation(MnemoChatClient.Operation.LIST_SUBJECTS)
 *         .build().execute();
 *
 * Map<String, Object> history = new MnemoChatClient.Builder()
 *         .apiKey(key).tenantId("acme").sessionId("session-1")
 *         .operation(MnemoChatClient.Operation.GET_HISTORY)
 *         .build().execute();
 * }</pre>
 *
 * <p>Failures are reported as {@link com.panaxon.ai.exception.MnemoClientException}; use its
 * {@code getHttpStatus()} to tell a bad key (401) from a quota limit (429).
 *
 * @author edward.suryadi
 * @since 1.0
 */
public interface MnemoChatClient extends MnemoClient {

    /**
     * The chat-related calls, with the builder parameters each one reads and the type {@code execute()} returns.
     */
    enum Operation {
        /** Sends {@code message} in {@code sessionId}; needs tenantId, sessionId, message. Returns {@link com.panaxon.ai.model.ChatMessageResponse}. */
        CHAT,
        /** Lists sessions; needs tenantId, optional query/page/size. Returns {@code Map<String, Object>} (a page). */
        LIST_SESSIONS,
        /** One page of a session's history, newest first; needs tenantId, sessionId, optional before/size. Returns {@code Map<String, Object>}. */
        GET_HISTORY,
        /** Renames a session; needs sessionId, sessionName. Returns {@code Map<String, Object>}. */
        RENAME_SESSION,
        /** Closes a session, or deletes it when {@code permanent}; needs tenantId, sessionId. Returns {@code null}. */
        CLOSE_SESSION,
        /** Lists the tenant's memory subjects; needs tenantId. Returns {@code List<Map<String, Object>>}. */
        LIST_SUBJECTS,
        /** Deletes a subject and all its memory; needs tenantId, subjectName. Returns {@code null}. */
        DELETE_SUBJECT,
        /** Sets (or re-synthesizes, when blank) a subject's description; needs tenantId, subjectName. Returns {@code Map<String, Object>}. */
        UPDATE_SUBJECT_DESCRIPTION,
        /** The tenant's plan and quota usage; needs tenantId. Returns {@code Map<String, Object>}. */
        GET_PLAN,
        /** Service health check. Returns {@code Map<String, Object>}. */
        HEALTH
    }

    /**
     * <b>Builder</b> is a static inner class that extends {@link MnemoClientBuilder} to provide a fluent interface
     * for constructing instances of {@link MnemoChatClient}. It collects the call parameters and passes itself
     * to the client implementation in {@link #build()}.
     */
    static class Builder extends MnemoClientBuilder<Builder> {
        private Operation operation = Operation.CHAT;
        private String sessionId;
        private String message;
        private String sessionName;
        private String subjectName;
        private String description;
        private String query;
        private Integer page;
        private Integer size;
        private Long before;
        private boolean permanent;

        @Override
        protected Builder self() {
            return this;
        }

        public Builder operation(Operation operation) {
            this.operation = operation;
            return this;
        }

        public Builder sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        /** The user message for {@link Operation#CHAT}. */
        public Builder message(String message) {
            this.message = message;
            return this;
        }

        /** The new name for {@link Operation#RENAME_SESSION}. */
        public Builder sessionName(String sessionName) {
            this.sessionName = sessionName;
            return this;
        }

        public Builder subjectName(String subjectName) {
            this.subjectName = subjectName;
            return this;
        }

        /** The subject description for {@link Operation#UPDATE_SUBJECT_DESCRIPTION}; blank asks MNEMO to write one. */
        public Builder description(String description) {
            this.description = description;
            return this;
        }

        /** Search text for {@link Operation#LIST_SESSIONS}. */
        public Builder query(String query) {
            this.query = query;
            return this;
        }

        public Builder page(int page) {
            this.page = page;
            return this;
        }

        public Builder size(int size) {
            this.size = size;
            return this;
        }

        /** Epoch-millis cursor for {@link Operation#GET_HISTORY}: only messages before it are returned. */
        public Builder before(long beforeEpochMillis) {
            this.before = beforeEpochMillis;
            return this;
        }

        /** For {@link Operation#CLOSE_SESSION}: delete the session permanently instead of just closing it. */
        public Builder permanent(boolean permanent) {
            this.permanent = permanent;
            return this;
        }

        Operation operation() { return operation; }
        String sessionId() { return sessionId; }
        String message() { return message; }
        String sessionName() { return sessionName; }
        String subjectName() { return subjectName; }
        String description() { return description; }
        String query() { return query; }
        Integer page() { return page; }
        Integer size() { return size; }
        Long before() { return before; }
        boolean permanent() { return permanent; }

        @Override
        public MnemoChatClient build() {
            return new MnemoChatClientImpl(this);
        }
    }
}
