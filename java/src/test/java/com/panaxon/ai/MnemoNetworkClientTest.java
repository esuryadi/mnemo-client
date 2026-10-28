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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.panaxon.ai.exception.MnemoClientException;
import com.panaxon.ai.exception.MnemoError;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static com.panaxon.ai.MnemoNetworkClient.Operation.*;
import static org.junit.jupiter.api.Assertions.*;

class MnemoNetworkClientTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private FakeMnemoServer server;

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
    }

    @AfterEach
    void stop() {
        server.close();
    }

    private MnemoNetworkClient.Builder builder() {
        return new MnemoNetworkClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme");
    }

    @Test
    void operationIsRequired() {
        assertThrows(MnemoClientException.class, () -> builder().build().execute());
    }

    @Test
    void grantPrivatePostsGrant() throws Exception {
        server.reply(200, "{\"status\":\"PENDING\"}");
        Map<String, Object> r = builder().operation(GRANT_PRIVATE).counterpartTenantId("globex")
                .subject("Roadmap").description("shared").build().execute();
        assertEquals("PENDING", r.get("status"));
        assertEquals("/mnemo/network/sharing/private", server.last().path());
        assertEquals(Map.of("ownerTenantId", "acme", "subject", "Roadmap", "targetTenantId", "globex",
                "description", "shared"), JSON.readValue(server.last().body(), Map.class));
    }

    @Test
    void revokePrivateIsDeleteWithOwnerAndTarget() throws Exception {
        server.reply(204, "");
        assertNull(builder().operation(REVOKE_PRIVATE).counterpartTenantId("globex").subject("Road map")
                .build().execute());
        assertEquals("DELETE", server.last().method());
        assertEquals("/mnemo/network/sharing/private/Road%20map", server.last().rawPath());
        assertEquals("ownerTenantId=acme&targetTenantId=globex", server.last().query());
    }

    @Test
    void acceptInboundGrantMapsBorrowerAndOwner() throws Exception {
        server.reply(200, "{}");
        builder().operation(ACCEPT_INBOUND_GRANT).counterpartTenantId("globex").subject("Roadmap")
                .build().execute();
        assertEquals("POST", server.last().method());
        assertEquals("/mnemo/network/sharing/private/inbound/Roadmap/accept", server.last().path());
        assertEquals("borrowerTenantId=acme&ownerTenantId=globex", server.last().query());
    }

    @Test
    void publishSendsVisibilityInBody() throws Exception {
        server.reply(200, "{}");
        builder().operation(PUBLISH).subject("Roadmap").description("d").affiliatedOnly(true).build().execute();
        assertEquals("/mnemo/network/sharing/public/Roadmap", server.last().path());
        assertEquals("ownerTenantId=acme", server.last().query());
        assertEquals(Map.of("description", "d", "affiliatedOnly", true),
                JSON.readValue(server.last().body(), Map.class));
    }

    @Test
    void browseRegistryAllowsListResponsesAndOptionalFilters() throws Exception {
        server.reply(200, "[{\"subject\":\"Roadmap\"}]");
        List<Map<String, Object>> entries = builder().operation(BROWSE_PUBLIC_REGISTRY).page(1).build().execute();
        assertEquals("Roadmap", entries.get(0).get("subject"));
        assertEquals("callerTenantId=acme&page=1", server.last().query());
    }

    @Test
    void subscribeAndUnsubscribe() throws Exception {
        server.reply(200, "{}");
        builder().operation(SUBSCRIBE).counterpartTenantId("globex").subject("Roadmap").build().execute();
        assertEquals(Map.of("subscriberTenantId", "acme", "ownerTenantId", "globex", "subject", "Roadmap"),
                JSON.readValue(server.last().body(), Map.class));

        server.reply(204, "");
        builder().operation(UNSUBSCRIBE).counterpartTenantId("globex").subject("Roadmap").build().execute();
        assertEquals("/mnemo/network/sharing/subscriptions/globex/Roadmap", server.last().path());
        assertEquals("subscriberTenantId=acme", server.last().query());
    }

    @Test
    void approveAffiliationPutsRequesterInPath() throws Exception {
        server.reply(200, "{}");
        builder().operation(APPROVE_AFFILIATION).counterpartTenantId("globex").build().execute();
        assertEquals("/mnemo/network/affiliates/requests/globex/approve", server.last().path());
        assertEquals("targetTenantId=acme", server.last().query());
    }

    @Test
    void counterpartIsRequiredWhereTheOperationHasOne() {
        MnemoClientException e = assertThrows(MnemoClientException.class,
                () -> builder().operation(REQUEST_AFFILIATION).build().execute());
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        assertTrue(e.getMessage().contains("counterpartTenantId"));
        assertEquals(0, server.count());
    }

    @Test
    void everyOperationIsWired() {
        server.reply(200, "{}");
        for (MnemoNetworkClient.Operation op : MnemoNetworkClient.Operation.values()) {
            MnemoNetworkClient c = builder().operation(op).counterpartTenantId("globex").subject("S")
                    .query("q").build();
            assertDoesNotThrow(() -> c.execute(), op.name());
        }
        assertEquals(MnemoNetworkClient.Operation.values().length, server.count());
    }
}
