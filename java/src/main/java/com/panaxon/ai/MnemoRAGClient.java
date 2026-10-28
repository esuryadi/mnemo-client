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

import java.util.List;

/**
 * <b>MnemoRAGClient</b> is an interface that defines the contract for a Retrieval-Augmented Generation
 * (RAG) client within the MNEMO system. Implementations of this interface should provide methods for
 * integrating retrieval mechanisms with generative models, enabling enhanced information retrieval and
 * generation capabilities.
 *
 * <p>MnemoRAG is stateless: each call asks one question against a RAG configuration ({@code ragId}) that
 * was created beforehand in Dorothy. It requires a Pro or Enterprise plan and a tenant API key (the
 * master key cannot be used, since the tenant is taken from the key).
 *
 * <h2>Example</h2>
 * <pre>{@code
 * MnemoClient client = new MnemoRAGClient.Builder()
 *         .apiKey(System.getenv("MNEMO_API_KEY"))
 *         .ragId("support-kb")
 *         .query("What is the refund window for annual plans?")
 *         .build();
 *
 * RagQueryResponse answer = client.execute();
 * if (answer.found()) {
 *     System.out.println(answer.answer() + " (" + answer.confidence() + ")");
 * }
 * }</pre>
 *
 * @author edward.suryadi
 * @since 1.0
 */
public interface MnemoRAGClient extends MnemoClient {

    /** The RAG calls, with the type {@code execute()} returns. */
    enum Operation {
        /** Asks {@code query} against the configuration {@code ragId}; needs ragId, query. Returns {@link com.panaxon.ai.model.RagQueryResponse}. */
        QUERY
    }

    /**
     * <b>Builder</b> is a static inner class that extends {@link MnemoClientBuilder} to provide a fluent interface
     * for constructing instances of {@link MnemoRAGClient}. The {@link Operation} defaults to {@link Operation#QUERY},
     * for which {@link #execute()} returns a {@link com.panaxon.ai.model.RagQueryResponse}.
     */
    static class Builder extends MnemoClientBuilder<Builder> {
        private Operation operation = Operation.QUERY;
        private String ragId;
        private String query;
        private List<String> additionalContext;

        @Override
        protected Builder self() {
            return this;
        }

        public Builder operation(Operation operation) {
            this.operation = operation;
            return this;
        }

        /** The id of the RAG configuration to query. */
        public Builder ragId(String ragId) {
            this.ragId = ragId;
            return this;
        }

        /** The question to answer. */
        public Builder query(String query) {
            this.query = query;
            return this;
        }

        /** Optional extra context passages the caller supplies along with the question. */
        public Builder additionalContext(List<String> additionalContext) {
            this.additionalContext = additionalContext;
            return this;
        }

        Operation operation() { return operation; }
        String ragId() { return ragId; }
        String query() { return query; }
        List<String> additionalContext() { return additionalContext; }

        @Override
        public MnemoRAGClient build() {
            return new MnemoRAGClientImpl(this);
        }
    }
}
