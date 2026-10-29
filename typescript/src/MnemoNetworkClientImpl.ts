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

import { AbstractMnemoClient, body, invalid, path, query, require } from "./AbstractMnemoClient.js";
import { MnemoNetworkClient } from "./MnemoNetworkClient.js";
import type { JsonObject } from "./model/index.js";

/**
 * <b>MnemoNetworkClientImpl</b> implements {@link MnemoNetworkClient}: one private method per operation.
 *
 * @internal
 */
export class MnemoNetworkClientImpl extends AbstractMnemoClient implements MnemoNetworkClient {
    private readonly builder: MnemoNetworkClient.Builder;

    constructor(builder: MnemoNetworkClient.Builder) {
        super(builder);
        this.builder = builder;
    }

    /** Dispatches to the method that implements the operation chosen on the builder. */
    async execute<T = unknown>(): Promise<T> {
        const operation = this.builder._operation;
        if (operation == null) {
            throw invalid("operation is required");
        }
        const Op = MnemoNetworkClient.Operation;
        return this.withTarget(async (base): Promise<unknown> => {
            switch (operation) {
                case Op.LIST_PRIVATE_GRANTS: return this.listPrivateGrants(base);
                case Op.GRANT_PRIVATE: return this.grantPrivate(base);
                case Op.REVOKE_PRIVATE: return this.revokePrivate(base);
                case Op.LIST_INBOUND_GRANTS: return this.listInboundGrants(base);
                case Op.ACCEPT_INBOUND_GRANT: return this.acceptInboundGrant(base);
                case Op.REMOVE_INBOUND_GRANT: return this.removeInboundGrant(base);
                case Op.PUBLISH: return this.publish(base);
                case Op.UNPUBLISH: return this.unpublish(base);
                case Op.BROWSE_PUBLIC_REGISTRY: return this.browsePublicRegistry(base);
                case Op.SUBSCRIBE: return this.subscribe(base);
                case Op.UNSUBSCRIBE: return this.unsubscribe(base);
                case Op.LIST_SUBSCRIPTIONS: return this.listSubscriptions(base);
                case Op.SEARCH_TENANTS: return this.searchTenants(base);
                case Op.REQUEST_AFFILIATION: return this.requestAffiliation(base);
                case Op.APPROVE_AFFILIATION: return this.approveAffiliation(base);
                case Op.REJECT_AFFILIATION: return this.rejectAffiliation(base);
                case Op.LIST_OUTGOING_AFFILIATIONS: return this.listOutgoingAffiliations(base);
                case Op.LIST_INCOMING_AFFILIATIONS: return this.listIncomingAffiliations(base);
                default: throw invalid(`unknown operation ${String(operation)}`);
            }
        }) as Promise<T>;
    }

    private listPrivateGrants(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/network/sharing/private"),
            { ownerTenantId: this.tenant() }));
    }

    private grantPrivate(base: string): Promise<unknown> {
        return this.send("POST", path(base, "mnemo/network/sharing/private"),
            body({
                ownerTenantId: this.tenant(), subject: this.subject(),
                targetTenantId: this.counterpart(), description: this.builder._description,
            }));
    }

    private revokePrivate(base: string): Promise<null> {
        return this.send("DELETE", query(this.subjectPath(base, "sharing/private/{subject}"),
            { ownerTenantId: this.tenant(), targetTenantId: this.counterpart() }), undefined, false);
    }

    private listInboundGrants(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/network/sharing/private/inbound"),
            { borrowerTenantId: this.tenant() }));
    }

    private acceptInboundGrant(base: string): Promise<unknown> {
        return this.send("POST", query(this.subjectPath(base, "sharing/private/inbound/{subject}/accept"),
            { borrowerTenantId: this.tenant(), ownerTenantId: this.counterpart() }));
    }

    private removeInboundGrant(base: string): Promise<null> {
        return this.send("DELETE", query(this.subjectPath(base, "sharing/private/inbound/{subject}"),
            { borrowerTenantId: this.tenant(), ownerTenantId: this.counterpart() }), undefined, false);
    }

    private publish(base: string): Promise<unknown> {
        return this.send("POST", query(this.subjectPath(base, "sharing/public/{subject}"),
            { ownerTenantId: this.tenant() }),
            body({ description: this.builder._description, affiliatedOnly: this.builder._affiliatedOnly }));
    }

    private unpublish(base: string): Promise<null> {
        return this.send("DELETE", query(this.subjectPath(base, "sharing/public/{subject}"),
            { ownerTenantId: this.tenant() }), undefined, false);
    }

    private browsePublicRegistry(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/network/sharing/public/registry"), {
            subject: this.builder._subject, ownerTenantId: this.builder._counterpartTenantId,
            callerTenantId: this.tenantId(), page: this.builder._page, size: this.builder._size,
        }));
    }

    private subscribe(base: string): Promise<unknown> {
        return this.send("POST", path(base, "mnemo/network/sharing/subscriptions"),
            body({ subscriberTenantId: this.tenant(), ownerTenantId: this.counterpart(), subject: this.subject() }));
    }

    private unsubscribe(base: string): Promise<null> {
        return this.send("DELETE", query(path(base, "mnemo/network/sharing/subscriptions/{owner}/{subject}",
            { owner: this.counterpart(), subject: this.subject() }),
            { subscriberTenantId: this.tenant() }), undefined, false);
    }

    private listSubscriptions(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/network/sharing/subscriptions"),
            { tenantId: this.tenant() }));
    }

    private searchTenants(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/network/tenants/search"), {
            q: require(this.builder._query, "query"), page: this.builder._page, size: this.builder._size,
        }));
    }

    private requestAffiliation(base: string): Promise<unknown> {
        return this.send("POST", path(base, "mnemo/network/affiliates/requests"),
            body({ requesterTenantId: this.tenant(), targetTenantId: this.counterpart() }));
    }

    private approveAffiliation(base: string): Promise<unknown> {
        return this.send("POST", query(path(base, "mnemo/network/affiliates/requests/{requester}/approve",
            { requester: this.counterpart() }), { targetTenantId: this.tenant() }));
    }

    private rejectAffiliation(base: string): Promise<unknown> {
        return this.send("POST", query(path(base, "mnemo/network/affiliates/requests/{requester}/reject",
            { requester: this.counterpart() }), { targetTenantId: this.tenant() }));
    }

    private listOutgoingAffiliations(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/network/affiliates/outgoing"),
            { tenantId: this.tenant() }));
    }

    private listIncomingAffiliations(base: string): Promise<JsonObject> {
        return this.send("GET", query(path(base, "mnemo/network/affiliates/incoming"),
            { tenantId: this.tenant() }));
    }

    private tenant(): string {
        return require(this.tenantId(), "tenantId");
    }

    private counterpart(): string {
        return require(this.builder._counterpartTenantId, "counterpartTenantId");
    }

    private subject(): string {
        return require(this.builder._subject, "subject");
    }

    private subjectPath(base: string, template: string): string {
        return path(base, `mnemo/network/${template}`, { subject: this.subject() });
    }
}
