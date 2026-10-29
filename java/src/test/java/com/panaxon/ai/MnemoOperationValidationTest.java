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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.EnumSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Every operation of every client, called with an API key and endpoint but no other parameter: each one that has
 * a required parameter must refuse with {@code INVALID_REQUEST} before any request is sent. Guards against a new
 * operation being added without its validation.
 */
class MnemoOperationValidationTest {
    private FakeMnemoServer server;

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
    }

    @AfterEach
    void stop() {
        server.close();
    }

    private void assertRefusedBeforeSending(String what, MnemoClient client) {
        int before = server.count();
        MnemoClientException e = assertThrows(MnemoClientException.class, client::execute, what);
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code(), what + ": " + e.getMessage());
        assertEquals(before, server.count(), what + " sent a request");
    }

    private void assertSends(String what, MnemoClient client) throws Exception {
        int before = server.count();
        client.execute();
        assertEquals(before + 1, server.count(), what);
    }

    @Test
    void everyChatOperationChecksItsRequiredParameters() throws Exception {
        Set<MnemoChatClient.Operation> needNothing = EnumSet.of(MnemoChatClient.Operation.HEALTH);
        for (MnemoChatClient.Operation op : MnemoChatClient.Operation.values()) {
            MnemoClient client = new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url()).operation(op).build();
            if (needNothing.contains(op)) assertSends("chat " + op, client);
            else assertRefusedBeforeSending("chat " + op, client);
        }
    }

    @Test
    void everySettingsOperationChecksItsRequiredParameters() throws Exception {
        Set<MnemoSettingsClient.Operation> needNothing = EnumSet.of(MnemoSettingsClient.Operation.GET_OPTIONS);
        for (MnemoSettingsClient.Operation op : MnemoSettingsClient.Operation.values()) {
            MnemoClient client = new MnemoSettingsClient.Builder().apiKey("k").baseUrl(server.url()).operation(op).build();
            if (needNothing.contains(op)) assertSends("settings " + op, client);
            else assertRefusedBeforeSending("settings " + op, client);
        }
    }

    @Test
    void everyNetworkOperationChecksItsRequiredParameters() throws Exception {
        Set<MnemoNetworkClient.Operation> needNothing = EnumSet.of(MnemoNetworkClient.Operation.BROWSE_PUBLIC_REGISTRY);
        for (MnemoNetworkClient.Operation op : MnemoNetworkClient.Operation.values()) {
            MnemoClient client = new MnemoNetworkClient.Builder().apiKey("k").baseUrl(server.url()).operation(op).build();
            if (needNothing.contains(op)) assertSends("network " + op, client);
            else assertRefusedBeforeSending("network " + op, client);
        }
    }

    @Test
    void ragQueryChecksItsRequiredParameters() {
        assertRefusedBeforeSending("rag QUERY", new MnemoRAGClient.Builder().apiKey("k").baseUrl(server.url()).build());
    }

    @Test
    void blankRequiredValuesAreRefusedLikeMissingOnes() {
        assertRefusedBeforeSending("blank sessionId", new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url())
                .tenantId("acme").sessionId("   ").message("hi").build());
    }

    @Test
    void aMissingOrBlankApiKeyOrEndpointIsRefusedForEveryClient() {
        for (MnemoClient client : new MnemoClient[] {
                new MnemoChatClient.Builder().baseUrl(server.url()).operation(MnemoChatClient.Operation.HEALTH).build(),
                new MnemoRAGClient.Builder().apiKey(" ").baseUrl(server.url()).ragId("r").query("q").build(),
                new MnemoSettingsClient.Builder().baseUrl(server.url()).operation(MnemoSettingsClient.Operation.GET_OPTIONS).build()}) {
            MnemoClientException e = assertThrows(MnemoClientException.class, client::execute);
            assertEquals(MnemoError.Code.MISSING_API_KEY, e.getError().code());
        }
        assertRefusedBeforeSending("no endpoint", new MnemoChatClient.Builder().apiKey("k").baseUrl(" ")
                .operation(MnemoChatClient.Operation.HEALTH).build());
        assertEquals(0, server.count());
    }

    @Test
    void aNullTimeoutIsRefusedNotAnUnexplainedCrash() {
        assertRefusedBeforeSending("null timeout", new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url())
                .timeout(null).operation(MnemoChatClient.Operation.HEALTH).build());
        assertSendsWith(Duration.ofSeconds(5));
    }

    private void assertSendsWith(Duration timeout) {
        assertDoesNotThrow(() -> new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url()).timeout(timeout)
                .operation(MnemoChatClient.Operation.HEALTH).build().execute());
    }
}
