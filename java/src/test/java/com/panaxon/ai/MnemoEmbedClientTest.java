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
import com.panaxon.ai.model.EmbedToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MnemoEmbedClientTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    static final String MINTED = "{\"token\":\"mnemo_embed_abc\",\"expiresAt\":\"2026-11-14T18:00:00Z\","
            + "\"tenantId\":\"acme\",\"sessionPrefix\":\"embed-0123456789abcdef-\",\"extra\":1}";
    private FakeMnemoServer server;

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
    }

    @AfterEach
    void stop() {
        server.close();
    }

    private MnemoEmbedClient.Builder builder() {
        return new MnemoEmbedClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme")
                .allowedOrigin("https://app.example.com");
    }

    private void assertRefused(MnemoEmbedClient.Builder builder, String mentions) {
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder.build().execute());
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        assertTrue(e.getMessage().contains(mentions), e.getMessage());
        assertEquals(0, server.count());
    }

    @Test
    void mintTokenPostsTheBodyAndReturnsTheToken() throws Exception {
        server.reply(200, MINTED);
        EmbedToken token = builder().endUserId("user-42").ttlSeconds(600).build().execute();

        assertEquals(new EmbedToken("mnemo_embed_abc", Instant.parse("2026-11-14T18:00:00Z"), "acme",
                "embed-0123456789abcdef-"), token);
        FakeMnemoServer.Received r = server.last();
        assertEquals("POST", r.method());
        assertEquals("/mnemo/embed/token", r.path());
        assertEquals("tok-1", r.token());
        assertEquals(Map.of("tenantId", "acme", "allowedOrigin", "https://app.example.com", "endUserId", "user-42",
                "ttlSeconds", 600), JSON.readValue(r.body(), Map.class));
    }

    @Test
    void optionalFieldsAreOmittedWhenNotSet() throws Exception {
        server.reply(200, MINTED);
        builder().build().execute();
        assertEquals(Map.of("tenantId", "acme", "allowedOrigin", "https://app.example.com"),
                JSON.readValue(server.last().body(), Map.class));
    }

    @Test
    void localhostOriginsAreAccepted() throws Exception {
        server.reply(200, MINTED);
        builder().allowedOrigin("http://localhost:3000").build().execute();
        builder().allowedOrigin("http://127.0.0.1").build().execute();
        builder().allowedOrigin("https://app.example.com:8443").build().execute();
        assertEquals(3, server.count());
    }

    @Test
    void validatesBeforeSending() {
        assertRefused(builder().tenantId(null), "tenantId");
        assertRefused(builder().allowedOrigin(null), "allowedOrigin");
        for (String origin : new String[] {"https://app.example.com/", "https://app.example.com/path", "*",
                "https://*.example.com", "http://app.example.com", "app.example.com", "ftp://app.example.com",
                "https://", "https://a.com,https://b.com", "https://app.example.com:abc"}) {
            assertRefused(builder().allowedOrigin(origin), "allowedOrigin");
        }
        assertRefused(builder().ttlSeconds(59), "ttlSeconds");
        assertRefused(builder().ttlSeconds(901), "ttlSeconds");
        assertRefused(builder().endUserId(""), "endUserId");
        assertRefused(builder().endUserId("a b"), "endUserId");
        assertRefused(builder().endUserId("x".repeat(129)), "endUserId");
    }

    @Test
    void boundaryValuesAreAccepted() throws Exception {
        server.reply(200, MINTED);
        builder().ttlSeconds(60).endUserId("x".repeat(128)).build().execute();
        builder().ttlSeconds(900).endUserId("a.b_c@d-e").build().execute();
        assertEquals(2, server.count());
    }

    @Test
    void anEmbedTokenCannotMint() {
        assertRefused(new MnemoEmbedClient.Builder().embedToken("mnemo_embed_x").baseUrl(server.url())
                .tenantId("acme").allowedOrigin("https://app.example.com"), "cannot mint");
    }

    @Test
    void anErrorAnswerCarriesTheStatusAndMessage() {
        server.reply(403, "{\"error\":\"not an ADMIN token\"}");
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().build().execute());
        assertEquals(MnemoError.Code.FORBIDDEN, e.getError().code());
        assertEquals(403, e.getHttpStatus());
        assertEquals("not an ADMIN token", e.getMessage());
    }

    @Test
    void aReplyWithoutATokenIsASerializationError() {
        server.reply(200, "{\"tenantId\":\"acme\"}");
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().build().execute());
        assertEquals(MnemoError.Code.SERIALIZATION_ERROR, e.getError().code());
    }

    @Test
    void factoryBuildsTheClient() throws Exception {
        assertInstanceOf(MnemoEmbedClient.class, MnemoClientFactory.create(builder()));
    }
}
