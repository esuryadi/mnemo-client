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
 * <b>MnemoNetworkClient</b> is an interface that defines the contract for a network client within the MNEMO system.
 * Implementations of this interface should provide methods for managing network communications, handling requests,
 * and processing responses.
 *
 * <p>The network covers sharing memory subjects with other tenants: private grants to a named tenant, public
 * publishing and subscribing, and affiliations between tenants. {@code tenantId} on the builder is always the
 * tenant making the call; {@code counterpartTenantId} is the other party, where the operation has one.
 *
 * <h2>Example</h2>
 * <pre>{@code
 * Object grants = new MnemoNetworkClient.Builder()
 *         .apiKey(System.getenv("MNEMO_API_KEY"))
 *         .tenantId("acme")
 *         .counterpartTenantId("globex")
 *         .subject("Q3 Roadmap")
 *         .description("Roadmap shared with our partner")
 *         .operation(MnemoNetworkClient.Operation.GRANT_PRIVATE)
 *         .build().execute();
 * }</pre>
 * The list and browse operations return a {@code Map<String, Object>} whose entries are under a key such as
 * {@code grants}, {@code subscriptions}, {@code affiliations} or {@code content}. The other operations return the
 * service's JSON parsed into plain {@code Map} / {@code List} values, or {@code null} when it replies with no body.
 *
 * @author edward.suryadi
 * @since 1.0
 */
public interface MnemoNetworkClient extends MnemoClient {

    /** The network calls. Each lists the builder parameters it needs besides apiKey. */
    enum Operation {
        /** tenantId (owner). */
        LIST_PRIVATE_GRANTS,
        /** tenantId (owner), counterpartTenantId (grantee), subject; optional description. */
        GRANT_PRIVATE,
        /** tenantId (owner), counterpartTenantId (grantee), subject. */
        REVOKE_PRIVATE,
        /** tenantId (borrower). */
        LIST_INBOUND_GRANTS,
        /** tenantId (borrower), counterpartTenantId (owner), subject. */
        ACCEPT_INBOUND_GRANT,
        /** tenantId (borrower), counterpartTenantId (owner), subject. */
        REMOVE_INBOUND_GRANT,
        /** tenantId (owner), subject; optional description, affiliatedOnly. */
        PUBLISH,
        /** tenantId (owner), subject. */
        UNPUBLISH,
        /** Optional subject filter, counterpartTenantId (owner filter), tenantId (caller), page, size. */
        BROWSE_PUBLIC_REGISTRY,
        /** tenantId (subscriber), counterpartTenantId (owner), subject. */
        SUBSCRIBE,
        /** tenantId (subscriber), counterpartTenantId (owner), subject. */
        UNSUBSCRIBE,
        /** tenantId. */
        LIST_SUBSCRIPTIONS,
        /** query; optional page, size. */
        SEARCH_TENANTS,
        /** tenantId (requester), counterpartTenantId (target). */
        REQUEST_AFFILIATION,
        /** tenantId (target), counterpartTenantId (requester). */
        APPROVE_AFFILIATION,
        /** tenantId (target), counterpartTenantId (requester). */
        REJECT_AFFILIATION,
        /** tenantId. */
        LIST_OUTGOING_AFFILIATIONS,
        /** tenantId. */
        LIST_INCOMING_AFFILIATIONS
    }

    /**
     * <b>Builder</b> is a static inner class that extends {@link MnemoClientBuilder} to provide a fluent interface
     * for constructing instances of {@link MnemoNetworkClient}. The {@link Operation} is required.
     */
    static class Builder extends MnemoClientBuilder<Builder> {
        private Operation operation;
        private String counterpartTenantId;
        private String subject;
        private String description;
        private Boolean affiliatedOnly;
        private String query;
        private Integer page;
        private Integer size;

        @Override
        protected Builder self() {
            return this;
        }

        public Builder operation(Operation operation) {
            this.operation = operation;
            return this;
        }

        public Builder counterpartTenantId(String counterpartTenantId) {
            this.counterpartTenantId = counterpartTenantId;
            return this;
        }

        public Builder subject(String subject) {
            this.subject = subject;
            return this;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        /** For {@link Operation#PUBLISH}: only affiliated tenants may subscribe. */
        public Builder affiliatedOnly(boolean affiliatedOnly) {
            this.affiliatedOnly = affiliatedOnly;
            return this;
        }

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

        Operation operation() { return operation; }
        String counterpartTenantId() { return counterpartTenantId; }
        String subject() { return subject; }
        String description() { return description; }
        Boolean affiliatedOnly() { return affiliatedOnly; }
        String query() { return query; }
        Integer page() { return page; }
        Integer size() { return size; }

        @Override
        public MnemoNetworkClient build() {
            return new MnemoNetworkClientImpl(this);
        }
    }
}
