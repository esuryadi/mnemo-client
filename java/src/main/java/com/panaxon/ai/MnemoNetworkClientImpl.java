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

import com.panaxon.ai.exception.MnemoClientException;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.GenericType;

/**
 * <b>MnemoNetworkClientImpl</b> is a concrete implementation of the {@link MnemoNetworkClient} interface.
 * It provides the actual logic for executing network-related operations within the MNEMO system.
 * This class is responsible for handling requests and processing responses in a network context.
 *
 * @author edward.suryadi
 * @since 1.0
 */
class MnemoNetworkClientImpl extends AbstractMnemoClient implements MnemoNetworkClient {
    private static final GenericType<Object> JSON = new GenericType<>() { };

    private final Builder builder;

    MnemoNetworkClientImpl(Builder builder) {
        super(builder);
        this.builder = builder;
    }

    /** Dispatches to the method that implements the operation chosen on the builder. */
    @Override
    @SuppressWarnings("unchecked")
    public <T> T execute() throws MnemoClientException {
        Operation operation = builder.operation();
        if (operation == null) {
            throw invalid("operation is required");
        }
        return (T) withTarget(base -> switch (operation) {
            case LIST_PRIVATE_GRANTS -> listPrivateGrants(base);
            case GRANT_PRIVATE -> grantPrivate(base);
            case REVOKE_PRIVATE -> revokePrivate(base);
            case LIST_INBOUND_GRANTS -> listInboundGrants(base);
            case ACCEPT_INBOUND_GRANT -> acceptInboundGrant(base);
            case REMOVE_INBOUND_GRANT -> removeInboundGrant(base);
            case PUBLISH -> publish(base);
            case UNPUBLISH -> unpublish(base);
            case BROWSE_PUBLIC_REGISTRY -> browsePublicRegistry(base);
            case SUBSCRIBE -> subscribe(base);
            case UNSUBSCRIBE -> unsubscribe(base);
            case LIST_SUBSCRIPTIONS -> listSubscriptions(base);
            case SEARCH_TENANTS -> searchTenants(base);
            case REQUEST_AFFILIATION -> requestAffiliation(base);
            case APPROVE_AFFILIATION -> approveAffiliation(base);
            case REJECT_AFFILIATION -> rejectAffiliation(base);
            case LIST_OUTGOING_AFFILIATIONS -> listOutgoingAffiliations(base);
            case LIST_INCOMING_AFFILIATIONS -> listIncomingAffiliations(base);
        });
    }

    private Object listPrivateGrants(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/network/sharing/private"),
                "ownerTenantId", tenant()),
                null, JSON);
    }

    private Object grantPrivate(WebTarget base) throws MnemoClientException {
        return send("POST", base.path("mnemo/network/sharing/private"),
                body("ownerTenantId", tenant(), "subject", subject(),
                        "targetTenantId", counterpart(), "description", builder.description()), JSON);
    }

    private Object revokePrivate(WebTarget base) throws MnemoClientException {
        return send("DELETE", query(subjectPath(base, "sharing/private/{subject}"),
                "ownerTenantId", tenant(), "targetTenantId", counterpart()),
                null, null);
    }

    private Object listInboundGrants(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/network/sharing/private/inbound"),
                "borrowerTenantId", tenant()),
                null, JSON);
    }

    private Object acceptInboundGrant(WebTarget base) throws MnemoClientException {
        return send("POST", query(subjectPath(base, "sharing/private/inbound/{subject}/accept"),
                "borrowerTenantId", tenant(), "ownerTenantId", counterpart()),
                null, JSON);
    }

    private Object removeInboundGrant(WebTarget base) throws MnemoClientException {
        return send("DELETE", query(subjectPath(base, "sharing/private/inbound/{subject}"),
                "borrowerTenantId", tenant(), "ownerTenantId", counterpart()),
                null, null);
    }

    private Object publish(WebTarget base) throws MnemoClientException {
        return send("POST", query(subjectPath(base, "sharing/public/{subject}"),
                "ownerTenantId", tenant()),
                body("description", builder.description(), "affiliatedOnly", builder.affiliatedOnly()), JSON);
    }

    private Object unpublish(WebTarget base) throws MnemoClientException {
        return send("DELETE", query(subjectPath(base, "sharing/public/{subject}"),
                "ownerTenantId", tenant()),
                null, null);
    }

    private Object browsePublicRegistry(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/network/sharing/public/registry"),
                "subject", builder.subject(), "ownerTenantId", builder.counterpartTenantId(),
                "callerTenantId", builder.tenantId(), "page", builder.page(), "size", builder.size()),
                null, JSON);
    }

    private Object subscribe(WebTarget base) throws MnemoClientException {
        return send("POST", base.path("mnemo/network/sharing/subscriptions"),
                body("subscriberTenantId", tenant(), "ownerTenantId", counterpart(), "subject", subject()), JSON);
    }

    private Object unsubscribe(WebTarget base) throws MnemoClientException {
        return send("DELETE", query(base.path("mnemo/network/sharing/subscriptions/{owner}/{subject}")
                .resolveTemplate("owner", counterpart()).resolveTemplate("subject", subject()),
                "subscriberTenantId", tenant()),
                null, null);
    }

    private Object listSubscriptions(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/network/sharing/subscriptions"),
                "tenantId", tenant()),
                null, JSON);
    }

    private Object searchTenants(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/network/tenants/search"),
                "q", require(builder.query(), "query"), "page", builder.page(), "size", builder.size()),
                null, JSON);
    }

    private Object requestAffiliation(WebTarget base) throws MnemoClientException {
        return send("POST", base.path("mnemo/network/affiliates/requests"),
                body("requesterTenantId", tenant(), "targetTenantId", counterpart()), JSON);
    }

    private Object approveAffiliation(WebTarget base) throws MnemoClientException {
        return send("POST", query(base.path("mnemo/network/affiliates/requests/{requester}/approve")
                .resolveTemplate("requester", counterpart()), "targetTenantId", tenant()),
                null, JSON);
    }

    private Object rejectAffiliation(WebTarget base) throws MnemoClientException {
        return send("POST", query(base.path("mnemo/network/affiliates/requests/{requester}/reject")
                .resolveTemplate("requester", counterpart()), "targetTenantId", tenant()),
                null, JSON);
    }

    private Object listOutgoingAffiliations(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/network/affiliates/outgoing"),
                "tenantId", tenant()),
                null, JSON);
    }

    private Object listIncomingAffiliations(WebTarget base) throws MnemoClientException {
        return send("GET", query(base.path("mnemo/network/affiliates/incoming"),
                "tenantId", tenant()),
                null, JSON);
    }

    private String tenant() throws MnemoClientException {
        return require(tenantId(), "tenantId");
    }

    private String counterpart() throws MnemoClientException {
        return require(builder.counterpartTenantId(), "counterpartTenantId");
    }

    private String subject() throws MnemoClientException {
        return require(builder.subject(), "subject");
    }

    private WebTarget subjectPath(WebTarget base, String template) throws MnemoClientException {
        return base.path("mnemo/network/" + template).resolveTemplate("subject", subject());
    }
}
