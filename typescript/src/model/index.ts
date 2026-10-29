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

// The service's JSON is returned as parsed, so field names match the wire format. Fields this client does not
// know about are kept, and a newer service never breaks an older client. Dates are ISO-8601 strings.

/** Input and output token counts consumed by an LLM call. */
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
}

/** Server-side timing of a chat response, in milliseconds. */
export interface ResponseTiming {
    memoryOperationMs: number;
    llmPostprocessMs: number;
    totalMs: number;
}

/** A file or knowledge item returned alongside a chat message. */
export interface Attachment {
    subject?: string | null;
    content?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
}

/** The assistant reply to a chat message (result of {@code MnemoChatClient.Operation.CHAT}). */
export interface ChatMessageResponse {
    tenantId?: string | null;
    sessionId?: string | null;
    id?: string | null;
    message?: string | null;
    attachments?: Attachment[] | null;
    timestamp?: number;
    timing?: ResponseTiming | null;
    sessionName?: string | null;
    reasoningTrace?: string | null;
    quotaWarning?: string | null;
    tokenUsage?: TokenUsage | null;
}

/** The answer to a MnemoRAG query (result of {@code MnemoRAGClient.Operation.QUERY}). */
export interface RagQueryResponse {
    answer?: string | null;
    found: boolean;
    source?: string | null;
    authority?: string | null;
    confidence?: string | null;
    /** ISO-8601 timestamp. */
    lastUpdated?: string | null;
    retrievalTier?: string | null;
    subjectsUsed?: string[] | null;
    tokenUsage?: TokenUsage | null;
}

/** An account's MNEMO settings. The provider API key is never returned, only whether one is stored. */
export interface SettingsResponse {
    accountId?: string | null;
    provider?: string | null;
    model?: string | null;
    ingestModel?: string | null;
    hasApiKey: boolean;
    lookbackDays: number;
    encryptData: boolean;
    sharedMemoryTtlHours: number;
    /** ISO-8601 timestamp. */
    updatedAt?: string | null;
}

/** A parsed JSON object, as returned by the calls that have no typed model. */
export type JsonObject = Record<string, unknown>;
