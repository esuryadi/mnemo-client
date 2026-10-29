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
import { MnemoRAGClientImpl } from "./MnemoRAGClientImpl.js";

/**
 * <b>MnemoRAGClient</b> asks questions against a MnemoRAG (Retrieval-Augmented Generation) configuration.
 *
 * MnemoRAG is stateless: each call asks one question against a RAG configuration ({@code ragId}) that
 * was created beforehand in Dorothy. It requires a Pro or Enterprise plan and a tenant API key (the
 * master key cannot be used, since the tenant is taken from the key).
 *
 * @example
 * const answer = await new MnemoRAGClient.Builder()
 *     .apiKey(process.env.MNEMO_API_KEY!)
 *     .ragId("support-kb")
 *     .query("What is the refund window for annual plans?")
 *     .build().execute<RagQueryResponse>();
 * if (answer.found) {
 *     console.log(`${answer.answer} (${answer.confidence})`);
 * }
 */
export interface MnemoRAGClient extends MnemoClient {}

export namespace MnemoRAGClient {
    /** The RAG calls, with the type {@code execute()} resolves with. */
    export enum Operation {
        /** Asks {@code query} against the configuration {@code ragId}; needs ragId, query. Resolves with {@code RagQueryResponse}. */
        QUERY = "QUERY",
    }

    /**
     * <b>Builder</b> collects the call parameters for a {@link MnemoRAGClient}. The operation defaults to
     * {@code QUERY}.
     */
    export class Builder extends MnemoClientBuilder {
        /** @internal */ _operation?: Operation = Operation.QUERY;
        /** @internal */ _ragId?: string;
        /** @internal */ _query?: string;
        /** @internal */ _additionalContext?: string[];

        operation(operation: Operation): this {
            this._operation = operation;
            return this;
        }

        /** The id of the RAG configuration to query. */
        ragId(ragId: string): this {
            this._ragId = ragId;
            return this;
        }

        /** The question to answer. */
        query(query: string): this {
            this._query = query;
            return this;
        }

        /** Optional extra context passages the caller supplies along with the question. */
        additionalContext(additionalContext: string[]): this {
            this._additionalContext = additionalContext;
            return this;
        }

        build(): MnemoRAGClient {
            return new MnemoRAGClientImpl(this);
        }
    }
}
