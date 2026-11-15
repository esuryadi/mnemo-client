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
 * <b>MnemoEmbedClient</b> mints the short-lived embed tokens used by the {@code <mnemo-chat>} web component. It is a
 * <b>server-side</b> call: authenticate it with a tenant API token holding the ADMIN role (or OAuth client
 * credentials), never from a browser, and never hand that credential to the page, only the minted token.
 *
 * <pre>{@code
 * EmbedToken token = MnemoClientFactory.create(new MnemoEmbedClient.Builder()
 *         .apiKey(System.getenv("MNEMO_API_KEY"))
 *         .tenantId("acme")
 *         .allowedOrigin("https://app.example.com")
 *         .endUserId("user-42")
 *         .build()).execute();
 * }</pre>
 *
 * @author edward.suryadi
 * @since 1.2
 */
public interface MnemoEmbedClient extends MnemoClient {

    /** The embed calls, with the builder parameters each one reads and the type {@code execute()} returns. */
    enum Operation {
        /**
         * Mints an embed token ({@code POST mnemo/embed/token}); needs tenantId and allowedOrigin (exactly one
         * origin, {@code https://host[:port]}, or {@code http://localhost[:port]} / {@code http://127.0.0.1[:port]}, no
         * path, no wildcard), optional endUserId (1 to 128 characters of {@code A-Za-z0-9._@-}) and ttlSeconds (60 to
         * 900, default 900). Returns {@link com.panaxon.ai.model.EmbedToken}.
         */
        MINT_TOKEN
    }

    /** Collects the call parameters and passes itself to the client implementation in {@link #build()}. */
    static class Builder extends MnemoClientBuilder<Builder> {
        private Operation operation = Operation.MINT_TOKEN;
        private String endUserId;
        private String allowedOrigin;
        private Integer ttlSeconds;

        @Override
        protected Builder self() {
            return this;
        }

        public Builder operation(Operation operation) {
            this.operation = operation;
            return this;
        }

        /** Identifies the visitor, so the same person keeps the same session prefix (and history) across tokens. */
        public Builder endUserId(String endUserId) {
            this.endUserId = endUserId;
            return this;
        }

        /** The one origin of the page that will use the token; the service only lets that origin call with it. */
        public Builder allowedOrigin(String allowedOrigin) {
            this.allowedOrigin = allowedOrigin;
            return this;
        }

        /** How long the token lives, 60 to 900 seconds. */
        public Builder ttlSeconds(int ttlSeconds) {
            this.ttlSeconds = ttlSeconds;
            return this;
        }

        Operation operation() { return operation; }
        String endUserId() { return endUserId; }
        String allowedOrigin() { return allowedOrigin; }
        Integer ttlSeconds() { return ttlSeconds; }

        @Override
        public MnemoEmbedClient build() {
            return new MnemoEmbedClientImpl(this);
        }
    }
}
