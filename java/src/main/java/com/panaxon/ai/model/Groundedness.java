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
 * The result of the opt-in groundedness check on one answer: whether the stored text it was written from supports it. Present only for an
 * account (chat) or a MnemoRAG configuration that turned the check on, and only when the check ran; a slow or failed check is simply absent.
 * It says the stored data supports the answer, not that the answer or the data is true.
 *
 * <p>{@code verdict} is {@code GROUNDED}, {@code PARTIAL} or {@code UNVERIFIED}. {@code notice} is the sentence to show for the last two.
 * {@code followUp} ({@code search_all_memory} or {@code which_subject}) and {@code followUpText} are only on a streamed chat reply. Strings,
 * so a value added later does not break an older client.</p>
 *
 * @author edward.suryadi
 * @since 1.2
 */
public record Groundedness(double score, String verdict, String reason, List<String> unsupportedClaims, String notice, String followUp,
                           String followUpText, boolean truncated) {
}
