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
import com.panaxon.ai.model.SettingsResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MnemoSettingsClientTest {
    private static final String SETTINGS = """
            {"accountId":"acct-1","provider":"anthropic","model":"m","ingestModel":"i","hasApiKey":true,
             "lookbackDays":30,"encryptData":true,"sharedMemoryTtlHours":24,"updatedAt":"2026-10-01T00:00:00Z"}""";
    private FakeMnemoServer server;

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
    }

    @AfterEach
    void stop() {
        server.close();
    }

    private MnemoSettingsClient.Builder builder() {
        return new MnemoSettingsClient.Builder().apiKey("tok-1").baseUrl(server.url());
    }

    @Test
    void getSettingsIsTheDefaultOperation() throws Exception {
        server.reply(200, SETTINGS);
        SettingsResponse s = builder().accountId("acct-1").build().execute();
        assertEquals(30, s.lookbackDays());
        assertTrue(s.hasApiKey());
        assertEquals("GET", server.last().method());
        assertEquals("/mnemo/account/acct-1/settings", server.last().path());
    }

    @Test
    void updateSendsOnlyTheSettingsThatWereSet() throws Exception {
        server.reply(200, SETTINGS);
        builder().accountId("acct-1").operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
                .lookbackDays(30).encryptData(false).providerApiKey("sk-own").build().execute();
        assertEquals("PUT", server.last().method());
        assertEquals(Map.of("apiKey", "sk-own", "lookbackDays", 30, "encryptData", false),
                new ObjectMapper().readValue(server.last().body(), Map.class));
    }

    @Test
    void optionsDoNotNeedAnAccount() throws Exception {
        server.reply(200, "{\"providers\":[\"anthropic\"]}");
        Map<String, Object> options = builder().operation(MnemoSettingsClient.Operation.GET_OPTIONS)
                .build().execute();
        assertNotNull(options.get("providers"));
        assertEquals("/mnemo/account/settings/options", server.last().path());
    }

    @Test
    void accountIdIsRequired() {
        assertThrows(MnemoClientException.class, () -> builder().build().execute());
        assertEquals(0, server.count());
    }
}
