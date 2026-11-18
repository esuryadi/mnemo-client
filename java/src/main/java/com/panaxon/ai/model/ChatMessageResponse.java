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

package com.panaxon.ai.model;

import java.util.List;

/**
 * The assistant reply to a chat message (result of {@link com.panaxon.ai.MnemoChatClient.Operation#CHAT}).
 *
 * <p>The last six components are additive and null when the server did not send them: {@code source}, {@code authority} and
 * {@code confidence} ({@code high}, {@code medium} or {@code low}) say where an answer built from stored data came from; {@code reason} and
 * {@code explanation} say why a plain not-found is one; {@code groundedness} is the opt-in check's result (see {@link Groundedness}).</p>
 *
 * @author edward.suryadi
 * @since 1.0
 */
public record ChatMessageResponse(String tenantId, String sessionId, String id, String message, List<Attachment> attachments, long timestamp,
                                  ResponseTiming timing, String sessionName, String reasoningTrace,
                                  String quotaWarning, TokenUsage tokenUsage, String reason, String source, String authority,
                                  String confidence, String explanation, Groundedness groundedness) {

    /**
     * A reply without the answer fields, the shape every reply had before they existed.
     */
    public ChatMessageResponse(String tenantId, String sessionId, String id, String message, List<Attachment> attachments, long timestamp,
                               ResponseTiming timing, String sessionName, String reasoningTrace, String quotaWarning, TokenUsage tokenUsage) {
        this(tenantId, sessionId, id, message, attachments, timestamp, timing, sessionName, reasoningTrace, quotaWarning, tokenUsage,
                null, null, null, null, null, null);
    }
}
