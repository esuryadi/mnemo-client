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
    /** Why a plain not-found is one (a code such as NOT_IN_MEMORY); absent otherwise. A string, so a later code does not break an older client. */
    reason?: string | null;
    /** Where an answer built from stored data came from, who stands behind that data, and how far to trust it (high, medium or low). */
    source?: string | null;
    authority?: string | null;
    confidence?: string | null;
    /** The one plain sentence for `reason`; present exactly when `reason` is. */
    explanation?: string | null;
    /** The opt-in groundedness check's result; absent unless the account turned the check on and it ran. */
    groundedness?: Groundedness | null;
}

/**
 * The result of the opt-in groundedness check on one answer: whether the stored text it was written from supports it (not that the answer or
 * the data is true). `verdict` is GROUNDED, PARTIAL or UNVERIFIED; `notice` is the sentence to show for the last two; `followUp` and
 * `followUpText` are only on a streamed chat reply.
 */
export interface Groundedness {
    score: number;
    verdict: string;
    reason?: string | null;
    unsupportedClaims?: string[] | null;
    notice?: string | null;
    followUp?: string | null;
    followUpText?: string | null;
    truncated?: boolean;
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
    /**
     * Only on a not-found, when the server knows why: OUT_OF_SCOPE, NOT_IN_MEMORY, AMBIGUOUS_ENTITY, PARTIAL_MATCH,
     * INDEX_NOT_READY, UNVERIFIED_ANSWER (STALE is reserved and never sent). A string, so a later code does not break an older client.
     */
    reason?: string | null;
    /** The one plain sentence for `reason` (also INCOMPLETE_DATA is a possible reason); present exactly when `reason` is. */
    explanation?: string | null;
    /**
     * Only for a configuration created with checkGroundedness on, a found answer the check ran on, and when it finished in time. Such a
     * configuration adds up to about 4 seconds to every response.
     */
    groundedness?: Groundedness | null;
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

/** A short-lived token a browser can use for chat (result of {@code MnemoEmbedClient.Operation.MINT_TOKEN}). */
export interface EmbedToken {
    /** Sent by the browser as {@code X-Mnemo-Api-Token}; safe to hand to one visitor, never the API key. */
    token: string;
    /** ISO-8601 instant the token stops working at. */
    expiresAt: string;
    tenantId: string;
    /** Every sessionId used with this token must start with this. */
    sessionPrefix: string;
}

/** One server-sent event of a streaming call: its name ({@code message} when none was given) and its data. */
export interface StreamEvent {
    event: string;
    data: string;
}

/** A parsed JSON object, as returned by the calls that have no typed model. */
export type JsonObject = Record<string, unknown>;
