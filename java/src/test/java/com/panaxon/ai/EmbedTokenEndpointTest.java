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

import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class EmbedTokenEndpointTest {
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

    private MnemoEmbedClient.Builder template() {
        return new MnemoEmbedClient.Builder().apiKey("secret-api-key").baseUrl(server.url()).tenantId("acme")
                .allowedOrigin("https://app.example.com");
    }

    @Test
    void returnsOnlyTokenExpiresAtAndSessionPrefix() throws Exception {
        server.reply(200, MnemoEmbedClientTest.MINTED);

        String json = EmbedTokenEndpoint.handle(template(), "user-42");

        Map<?, ?> parsed = JSON.readValue(json, Map.class);
        assertEquals(Set.of("token", "expiresAt", "tenantId", "sessionPrefix"), parsed.keySet());
        assertEquals("mnemo_embed_abc", parsed.get("token"));
        assertEquals("2026-11-14T18:00:00Z", parsed.get("expiresAt"));
        assertEquals("embed-0123456789abcdef-", parsed.get("sessionPrefix"));
        assertFalse(json.contains("secret-api-key"));
        assertEquals("user-42", JSON.readValue(server.last().body(), Map.class).get("endUserId"));
        assertEquals("secret-api-key", server.last().token());
    }

    @Test
    void anAnonymousVisitorSendsNoEndUserId() throws Exception {
        server.reply(200, MnemoEmbedClientTest.MINTED);
        EmbedTokenEndpoint.handle(() -> template(), null);
        assertFalse(JSON.readValue(server.last().body(), Map.class).containsKey("endUserId"));
    }

    @Test
    void aFailureIsRaisedNotTurnedIntoJson() {
        server.reply(403, "{\"error\":\"not an ADMIN token\"}");
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> EmbedTokenEndpoint.handle(template(), "u"));
        assertEquals(MnemoError.Code.FORBIDDEN, e.getError().code());
    }

    @Test
    void anInvalidEndUserIdIsRefusedBeforeSending() {
        assertThrows(MnemoClientException.class, () -> EmbedTokenEndpoint.handle(template(), "has space"));
        assertEquals(0, server.count());
    }

    @Test
    void theTemplateIsRequired() {
        assertThrows(MnemoClientException.class, () -> EmbedTokenEndpoint.handle((MnemoEmbedClient.Builder) null, "u"));
    }

    @Test
    void escapesJsonSpecialCharactersInTheValues() throws Exception {
        server.reply(200, "{\"token\":\"a\\\"b</script>\",\"expiresAt\":\"2026-11-14T18:00:00Z\","
                + "\"tenantId\":\"acme\",\"sessionPrefix\":\"embed-x-\"}");
        String json = EmbedTokenEndpoint.handle(template(), "u");
        assertEquals("a\"b</script>", JSON.readValue(json, Map.class).get("token"));
        assertFalse(json.contains("</script>"));
    }
}
