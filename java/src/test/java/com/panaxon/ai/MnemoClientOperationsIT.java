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
import com.panaxon.ai.model.ChatMessageResponse;
import com.panaxon.ai.model.SettingsResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.panaxon.ai.MnemoNetworkClient.Operation.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Integration tests for the operations {@link MnemoClientIT} does not cover, against a real MNEMO deployment.
 * Run through failsafe ({@code mvn verify -DskipITs=false -Dgpg.skip=true}); every test skips itself when its
 * environment is missing. Needs {@code MNEMO_API_KEY}, {@code MNEMO_TENANT_ID} and {@code MNEMO_ACCOUNT_ID}
 * (and optionally {@code MNEMO_BASE_URL}).
 *
 * <p>Tests that write data also need {@code MNEMO_IT_WRITE=true}, and point at a throwaway tenant such as the QA
 * account: settings are written back unchanged, the chat session is deleted afterwards, and the network writes
 * target a tenant that does not exist, so they must be rejected rather than create anything.
 */
class MnemoClientOperationsIT {
    private static String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? null : value;
    }

    private static String need(String name) {
        String value = env(name);
        assumeTrue(value != null, name + " is not set");
        return value;
    }

    private static void needWrite() {
        assumeTrue("true".equalsIgnoreCase(env("MNEMO_IT_WRITE")), "MNEMO_IT_WRITE is not true");
    }

    private static String baseUrl() {
        String url = env("MNEMO_BASE_URL");
        return url == null ? MnemoClientBuilder.DEFAULT_BASE_URL : url;
    }

    private static MnemoChatClient.Builder chat() {
        return new MnemoChatClient.Builder().apiKey(need("MNEMO_API_KEY")).baseUrl(baseUrl())
                .tenantId(need("MNEMO_TENANT_ID"));
    }

    private static MnemoNetworkClient.Builder network(MnemoNetworkClient.Operation operation) {
        return new MnemoNetworkClient.Builder().apiKey(need("MNEMO_API_KEY")).baseUrl(baseUrl())
                .tenantId(need("MNEMO_TENANT_ID")).operation(operation);
    }

    private static MnemoSettingsClient.Builder settings() {
        return new MnemoSettingsClient.Builder().apiKey(need("MNEMO_API_KEY")).baseUrl(baseUrl())
                .accountId(need("MNEMO_ACCOUNT_ID"));
    }

    @Test
    void sessionsArePageable() throws Exception {
        Map<String, Object> page = chat().operation(MnemoChatClient.Operation.LIST_SESSIONS).size(2).build().execute();
        assertTrue(page.containsKey("content"), page.keySet().toString());
        assertTrue(((List<?>) page.get("content")).size() <= 2);
    }

    @Test
    void settingsOptionsListProvidersAndModels() throws Exception {
        Map<String, Object> options = settings().operation(MnemoSettingsClient.Operation.GET_OPTIONS).build().execute();
        assertNotNull(options.get("providers"));
        assertNotNull(options.get("models"));
    }

    @Test
    void networkListOperationsReturnTheirCollections() throws Exception {
        Map<MnemoNetworkClient.Operation, String> expectedKey = Map.of(
                LIST_PRIVATE_GRANTS, "grants",
                LIST_INBOUND_GRANTS, "grants",
                LIST_SUBSCRIPTIONS, "subscriptions",
                LIST_OUTGOING_AFFILIATIONS, "affiliations",
                LIST_INCOMING_AFFILIATIONS, "affiliations",
                BROWSE_PUBLIC_REGISTRY, "content");
        for (var entry : expectedKey.entrySet()) {
            Map<String, Object> result = network(entry.getKey()).size(2).build().execute();
            assertTrue(result.containsKey(entry.getValue()), entry.getKey() + " -> " + result.keySet());
        }
        Map<String, Object> search = network(SEARCH_TENANTS).query("zzz-no-such-tenant").build().execute();
        assertTrue(search.containsKey("content"));
    }

    @Test
    void settingsUpdateIsPersistedAndReadBack() throws Exception {
        needWrite();
        SettingsResponse before = settings().build().execute();
        // the service cannot update an account whose stored chat model is null (a legacy-data bug on its side)
        assumeTrue(before.model() != null, "the account has no stored chat model");

        // write the current values back, so the test changes nothing but still proves the PUT is accepted
        SettingsResponse updated = settings().operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
                .provider(before.provider()).model(before.model()).ingestModel(before.ingestModel())
                .lookbackDays(before.lookbackDays()).encryptData(before.encryptData())
                .sharedMemoryTtlHours(before.sharedMemoryTtlHours()).build().execute();
        assertEquals(before.lookbackDays(), updated.lookbackDays());
        assertEquals(before.model(), updated.model());

        SettingsResponse after = settings().build().execute();
        assertEquals(before.provider(), after.provider());
        assertEquals(before.model(), after.model());
        assertEquals(before.encryptData(), after.encryptData());
        assertEquals(before.hasApiKey(), after.hasApiKey());
    }

    @Test
    void settingsCanBeUpdatedWithOnlyTheFieldsToChange() throws Exception {
        needWrite();
        SettingsResponse before = settings().build().execute();
        assumeTrue(before.model() != null, "the account has no stored chat model");
        SettingsResponse updated = settings().operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
                .lookbackDays(before.lookbackDays()).build().execute();
        assertEquals(before.model(), updated.model());
        assertEquals(before.ingestModel(), updated.ingestModel());
        assertEquals(before.encryptData(), updated.encryptData());
    }

    @Test
    void sessionLifecycle() throws Exception {
        needWrite();
        assumeTrue("true".equalsIgnoreCase(env("MNEMO_IT_CHAT")), "MNEMO_IT_CHAT is not true");
        String session = "it-lifecycle-" + UUID.randomUUID();
        String marker = "marker-" + UUID.randomUUID();
        try {
            Map<String, Object> init = chat().sessionId(session).sessionName("IT lifecycle")
                    .operation(MnemoChatClient.Operation.INIT_SESSION).build().execute();
            assertEquals(true, init.get("ready"));

            ChatMessageResponse reply = chat().sessionId(session)
                    .message("Please reply with one short sentence. Reference: " + marker).build().execute();
            assertEquals(session, reply.sessionId());
            assertFalse(reply.message().contains("not been initialized"), reply.message());

            // the turn is saved asynchronously, so poll for it rather than reading once
            String history = "";
            for (int i = 0; i < 15 && !history.contains(marker); i++) {
                Map<String, Object> page = chat().sessionId(session)
                        .operation(MnemoChatClient.Operation.GET_HISTORY).size(10).build().execute();
                history = String.valueOf(page);
                if (!history.contains(marker)) Thread.sleep(1000);
            }
            assertTrue(history.contains(marker), "turn never appeared in history: " + history);

            String name = "IT " + marker;
            chat().sessionId(session).sessionName(name)
                    .operation(MnemoChatClient.Operation.RENAME_SESSION).build().execute();
            Map<String, Object> found = chat().operation(MnemoChatClient.Operation.LIST_SESSIONS)
                    .query(name).build().execute(); // the filter matches a whole session name, not part of one
            assertTrue(String.valueOf(found).contains(session), "renamed session not listed: " + found);

            assertNull(chat().sessionId(session).operation(MnemoChatClient.Operation.CLOSE_SESSION)
                    .build().execute());
        } finally {
            chat().sessionId(session).operation(MnemoChatClient.Operation.CLOSE_SESSION).permanent(true)
                    .build().execute();
        }
    }

    @Test
    void networkWritesAgainstAnUnknownTenantFailCleanlyAndLeaveNothingBehind() throws Exception {
        needWrite();
        String ghost = "it-no-such-tenant-" + UUID.randomUUID();
        String subject = "it-no-such-subject-" + UUID.randomUUID();

        // the service validates these, so a made-up tenant or subject must come back as a 4xx
        for (MnemoNetworkClient.Operation op : List.of(GRANT_PRIVATE, PUBLISH, SUBSCRIBE, REQUEST_AFFILIATION)) {
            MnemoClientException e = assertThrows(MnemoClientException.class,
                    () -> network(op).counterpartTenantId(ghost).subject(subject).description("integration test")
                            .build().execute(), op + " should have been rejected");
            assertTrue(e.getHttpStatus() >= 400 && e.getHttpStatus() < 500,
                    op + " failed with HTTP " + e.getHttpStatus() + ": " + e.getMessage());
        }

        // the service answers these without checking the other party exists, and stores nothing; all that can be
        // asserted is that the request is understood (no 5xx, no transport failure)
        for (MnemoNetworkClient.Operation op : List.of(REVOKE_PRIVATE, ACCEPT_INBOUND_GRANT, REMOVE_INBOUND_GRANT,
                UNPUBLISH, UNSUBSCRIBE, APPROVE_AFFILIATION, REJECT_AFFILIATION)) {
            try {
                network(op).counterpartTenantId(ghost).subject(subject).build().execute();
            } catch (MnemoClientException e) {
                assertTrue(e.getHttpStatus() >= 400 && e.getHttpStatus() < 500,
                        op + " failed with HTTP " + e.getHttpStatus() + ": " + e.getMessage());
            }
        }

        // nothing referring to the made-up tenant may remain in any of the tenant's lists
        for (MnemoNetworkClient.Operation op : List.of(LIST_PRIVATE_GRANTS, LIST_INBOUND_GRANTS, LIST_SUBSCRIPTIONS,
                LIST_OUTGOING_AFFILIATIONS, LIST_INCOMING_AFFILIATIONS)) {
            Map<String, Object> listing = network(op).build().execute();
            assertFalse(String.valueOf(listing).contains(ghost), op + " now mentions the made-up tenant");
        }
    }
}
