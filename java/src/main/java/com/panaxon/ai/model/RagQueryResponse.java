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
 * @author edward.suryadi
 * @since 1.0
 */
public record RagQueryResponse(String answer, boolean found, String source, String authority, String confidence, Instant lastUpdated,
                               String retrievalTier, List<String> subjectsUsed, TokenUsage tokenUsage) {
}
