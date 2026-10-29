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
import { MnemoNetworkClientImpl } from "./MnemoNetworkClientImpl.js";

/**
 * <b>MnemoNetworkClient</b> shares memory subjects with other tenants: private grants to a named tenant, public
 * publishing and subscribing, and affiliations between tenants. {@code tenantId} on the builder is always the
 * tenant making the call; {@code counterpartTenantId} is the other party, where the operation has one.
 *
 * @example
 * await new MnemoNetworkClient.Builder()
 *     .apiKey(process.env.MNEMO_API_KEY!)
 *     .tenantId("acme")
 *     .counterpartTenantId("globex")
 *     .subject("Q3 Roadmap")
 *     .description("Roadmap shared with our partner")
 *     .operation(MnemoNetworkClient.Operation.GRANT_PRIVATE)
 *     .build().execute();
 *
 * The list and browse operations resolve with a {@code JsonObject} whose entries are under a key such as
 * {@code grants}, {@code subscriptions}, {@code affiliations} or {@code content}. The other operations resolve
 * with the service's parsed JSON, or {@code null} when it replies with no body.
 */
export interface MnemoNetworkClient extends MnemoClient {}

export namespace MnemoNetworkClient {
    /** The network calls. Each lists the builder parameters it needs besides apiKey. */
    export enum Operation {
        /** tenantId (owner). */
        LIST_PRIVATE_GRANTS = "LIST_PRIVATE_GRANTS",
        /** tenantId (owner), counterpartTenantId (grantee), subject; optional description. */
        GRANT_PRIVATE = "GRANT_PRIVATE",
        /** tenantId (owner), counterpartTenantId (grantee), subject. */
        REVOKE_PRIVATE = "REVOKE_PRIVATE",
        /** tenantId (borrower). */
        LIST_INBOUND_GRANTS = "LIST_INBOUND_GRANTS",
        /** tenantId (borrower), counterpartTenantId (owner), subject. */
        ACCEPT_INBOUND_GRANT = "ACCEPT_INBOUND_GRANT",
        /** tenantId (borrower), counterpartTenantId (owner), subject. */
        REMOVE_INBOUND_GRANT = "REMOVE_INBOUND_GRANT",
        /** tenantId (owner), subject; optional description, affiliatedOnly. */
        PUBLISH = "PUBLISH",
        /** tenantId (owner), subject. */
        UNPUBLISH = "UNPUBLISH",
        /** Optional subject filter, counterpartTenantId (owner filter), tenantId (caller), page, size. */
        BROWSE_PUBLIC_REGISTRY = "BROWSE_PUBLIC_REGISTRY",
        /** tenantId (subscriber), counterpartTenantId (owner), subject. */
        SUBSCRIBE = "SUBSCRIBE",
        /** tenantId (subscriber), counterpartTenantId (owner), subject. */
        UNSUBSCRIBE = "UNSUBSCRIBE",
        /** tenantId. */
        LIST_SUBSCRIPTIONS = "LIST_SUBSCRIPTIONS",
        /** query; optional page, size. */
        SEARCH_TENANTS = "SEARCH_TENANTS",
        /** tenantId (requester), counterpartTenantId (target). */
        REQUEST_AFFILIATION = "REQUEST_AFFILIATION",
        /** tenantId (target), counterpartTenantId (requester). */
        APPROVE_AFFILIATION = "APPROVE_AFFILIATION",
        /** tenantId (target), counterpartTenantId (requester). */
        REJECT_AFFILIATION = "REJECT_AFFILIATION",
        /** tenantId. */
        LIST_OUTGOING_AFFILIATIONS = "LIST_OUTGOING_AFFILIATIONS",
        /** tenantId. */
        LIST_INCOMING_AFFILIATIONS = "LIST_INCOMING_AFFILIATIONS",
    }

    /** <b>Builder</b> collects the call parameters for a {@link MnemoNetworkClient}. The operation is required. */
    export class Builder extends MnemoClientBuilder {
        /** @internal */ _operation?: Operation;
        /** @internal */ _counterpartTenantId?: string;
        /** @internal */ _subject?: string;
        /** @internal */ _description?: string;
        /** @internal */ _affiliatedOnly?: boolean;
        /** @internal */ _query?: string;
        /** @internal */ _page?: number;
        /** @internal */ _size?: number;

        operation(operation: Operation): this {
            this._operation = operation;
            return this;
        }

        counterpartTenantId(counterpartTenantId: string): this {
            this._counterpartTenantId = counterpartTenantId;
            return this;
        }

        subject(subject: string): this {
            this._subject = subject;
            return this;
        }

        description(description: string): this {
            this._description = description;
            return this;
        }

        /** For {@code PUBLISH}: only affiliated tenants may subscribe. */
        affiliatedOnly(affiliatedOnly: boolean): this {
            this._affiliatedOnly = affiliatedOnly;
            return this;
        }

        query(query: string): this {
            this._query = query;
            return this;
        }

        page(page: number): this {
            this._page = page;
            return this;
        }

        size(size: number): this {
            this._size = size;
            return this;
        }

        build(): MnemoNetworkClient {
            return new MnemoNetworkClientImpl(this);
        }
    }
}
