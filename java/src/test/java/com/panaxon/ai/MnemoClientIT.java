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
import com.panaxon.ai.exception.MnemoError;
import com.panaxon.ai.model.ChatMessageResponse;
import com.panaxon.ai.model.RagQueryResponse;
import com.panaxon.ai.model.SettingsResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Integration tests against a real MNEMO deployment. They run only through failsafe
 * ({@code mvn verify -DskipITs=false -Dgpg.skip=true}) and each test skips itself when the environment
 * variable it needs is not set, so nothing is ever hard-coded:
 *
 * <ul>
 *   <li>{@code MNEMO_API_KEY} - a tenant API token (required by all but the bad-key and health tests)</li>
 *   <li>{@code MNEMO_BASE_URL} - optional, defaults to the public service</li>
 *   <li>{@code MNEMO_TENANT_ID} - the tenant that owns the token</li>
 *   <li>{@code MNEMO_IT_CHAT=true} - opt in to the chat test, which spends LLM quota</li>
 *   <li>{@code MNEMO_RAG_ID} - a RAG configuration on a Pro/Enterprise tenant</li>
 *   <li>{@code MNEMO_ACCOUNT_ID} - an account whose settings may be read</li>
 * </ul>
 */
class MnemoClientIT {
    private static String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? null : value;
    }

    private static String need(String name) {
        String value = env(name);
        assumeTrue(value != null, name + " is not set");
        return value;
    }

    private static String baseUrl() {
        String url = env("MNEMO_BASE_URL");
        return url == null ? MnemoClientBuilder.DEFAULT_BASE_URL : url;
    }

    @Test
    void healthEndpointResponds() throws Exception {
        Map<String, Object> health = new MnemoChatClient.Builder().apiKey(need("MNEMO_API_KEY")).baseUrl(baseUrl())
                .operation(MnemoChatClient.Operation.HEALTH).build().execute();
        assertNotNull(health);
    }

    @Test
    void invalidKeyIsRejectedAsUnauthorized() {
        need("MNEMO_API_KEY"); // only when integration testing is configured; the key itself is not used
        MnemoClientException e = assertThrows(MnemoClientException.class,
                () -> new MnemoChatClient.Builder().apiKey("not-a-real-token-" + UUID.randomUUID())
                        .baseUrl(baseUrl()).tenantId("nobody")
                        .operation(MnemoChatClient.Operation.LIST_SUBJECTS).build().execute());
        assertEquals(401, e.getHttpStatus());
        assertEquals(MnemoError.Code.UNAUTHORIZED, e.getError().code());
    }

    @Test
    void planAndSubjectsAreReadable() throws Exception {
        String key = need("MNEMO_API_KEY");
        String tenant = need("MNEMO_TENANT_ID");

        Map<String, Object> plan = new MnemoChatClient.Builder().apiKey(key).baseUrl(baseUrl()).tenantId(tenant)
                .operation(MnemoChatClient.Operation.GET_PLAN).build().execute();
        assertNotNull(plan);

        List<Map<String, Object>> subjects = new MnemoChatClient.Builder().apiKey(key).baseUrl(baseUrl())
                .tenantId(tenant).operation(MnemoChatClient.Operation.LIST_SUBJECTS).build().execute();
        assertNotNull(subjects);
    }

    @Test
    void chatRoundTrip() throws Exception {
        assumeTrue("true".equalsIgnoreCase(env("MNEMO_IT_CHAT")), "MNEMO_IT_CHAT is not true");
        String key = need("MNEMO_API_KEY");
        String tenant = need("MNEMO_TENANT_ID");
        String session = "it-" + UUID.randomUUID();
        try {
            Map<String, Object> init = new MnemoChatClient.Builder().apiKey(key).baseUrl(baseUrl()).tenantId(tenant)
                    .sessionId(session).operation(MnemoChatClient.Operation.INIT_SESSION).build().execute();
            assertEquals(true, init.get("ready"));

            ChatMessageResponse reply = new MnemoChatClient.Builder().apiKey(key).baseUrl(baseUrl()).tenantId(tenant)
                    .sessionId(session).message("Hello, this is an automated connectivity check.")
                    .build().execute();
            assertEquals(session, reply.sessionId());
            assertNotNull(reply.message());
            // older deployments answered HTTP 200 with this text for an uninitialized session; a 200 alone proves nothing
            assertFalse(reply.message().contains("not been initialized"), reply.message());
            assertFalse(reply.message().isBlank());
        } finally {
            new MnemoChatClient.Builder().apiKey(key).baseUrl(baseUrl()).tenantId(tenant).sessionId(session)
                    .operation(MnemoChatClient.Operation.CLOSE_SESSION).permanent(true).build().execute();
        }
    }

    @Test
    void ragQuery() throws Exception {
        RagQueryResponse answer = new MnemoRAGClient.Builder().apiKey(need("MNEMO_API_KEY")).baseUrl(baseUrl())
                .ragId(need("MNEMO_RAG_ID")).query("What topics do you have information about?")
                .build().execute();
        assertNotNull(answer);
        assertNotNull(answer.answer());
    }

    @Test
    void settingsAreReadable() throws Exception {
        String account = need("MNEMO_ACCOUNT_ID");
        SettingsResponse settings = new MnemoSettingsClient.Builder().apiKey(need("MNEMO_API_KEY"))
                .baseUrl(baseUrl()).accountId(account).build().execute();
        assertEquals(account, settings.accountId());
    }

    @Test
    void publicRegistryIsBrowsable() throws Exception {
        Object registry = new MnemoNetworkClient.Builder().apiKey(need("MNEMO_API_KEY")).baseUrl(baseUrl())
                .tenantId(need("MNEMO_TENANT_ID")).operation(MnemoNetworkClient.Operation.BROWSE_PUBLIC_REGISTRY)
                .size(5).build().execute();
        assertNotNull(registry);
    }
}
