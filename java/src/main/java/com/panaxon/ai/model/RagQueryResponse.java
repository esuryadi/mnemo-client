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

import java.time.Instant;
import java.util.List;

/**
 * The answer to a MnemoRAG query (result of {@link com.panaxon.ai.MnemoRAGClient}).
 *
 * <p>{@code reason} is present only on a not-found ({@code found} false) when the server knows why: {@code OUT_OF_SCOPE},
 * {@code NOT_IN_MEMORY}, {@code AMBIGUOUS_ENTITY}, {@code PARTIAL_MATCH}, {@code INDEX_NOT_READY}, {@code UNVERIFIED_ANSWER}. {@code STALE} is
 * reserved and is never sent. It is a string, so a code added later does not break an older client.</p>
 *
 * @author edward.suryadi
 * @since 1.0
 */
public record RagQueryResponse(String answer, boolean found, String source, String authority, String confidence, Instant lastUpdated,
                               String retrievalTier, List<String> subjectsUsed, TokenUsage tokenUsage, String reason) {

    /**
     * A response without a reason, the shape every response had before {@code reason} existed.
     */
    public RagQueryResponse(String answer, boolean found, String source, String authority, String confidence, Instant lastUpdated,
                            String retrievalTier, List<String> subjectsUsed, TokenUsage tokenUsage) {
        this(answer, found, source, authority, confidence, lastUpdated, retrievalTier, subjectsUsed, tokenUsage, null);
    }
}
