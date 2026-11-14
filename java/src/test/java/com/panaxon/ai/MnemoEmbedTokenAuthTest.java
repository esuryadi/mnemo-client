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

import static org.junit.jupiter.api.Assertions.*;

class MnemoEmbedTokenAuthTest {
    private FakeMnemoServer server;

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
    }

    @AfterEach
    void stop() {
        server.close();
    }

    private MnemoChatClient.Builder builder() {
        return new MnemoChatClient.Builder().baseUrl(server.url()).tenantId("acme").sessionId("embed-anon-1")
                .operation(MnemoChatClient.Operation.GET_HISTORY);
    }

    private void assertRefused(MnemoChatClient.Builder builder, String mentions) {
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder.build().execute());
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        assertTrue(e.getMessage().contains(mentions), e.getMessage());
        assertEquals(0, server.count());
    }

    @Test
    void sendsTheEmbedTokenAsTheApiTokenHeader() throws Exception {
        server.reply(200, "{}");
        builder().embedToken("mnemo_embed_abc").build().execute();
        FakeMnemoServer.Received r = server.last();
        assertEquals("/mnemo/sessions/embed-anon-1/history", r.path());
        assertEquals("mnemo_embed_abc", r.token());
        assertNull(r.authorization());
    }

    @Test
    void isMutuallyExclusiveWithTheApiKey() {
        assertRefused(builder().embedToken("mnemo_embed_abc").apiKey("k"), "apiKey or embedToken");
    }

    @Test
    void isMutuallyExclusiveWithClientCredentials() {
        assertRefused(builder().embedToken("mnemo_embed_abc").clientCredentials("id", "secret"),
                "clientCredentials or embedToken");
    }

    @Test
    void aBlankEmbedTokenIsTheSameAsNoCredential() {
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().embedToken(" ").build().execute());
        assertEquals(MnemoError.Code.MISSING_API_KEY, e.getError().code());
        assertEquals(0, server.count());
    }

    @Test
    void aRejectedEmbedTokenIsNotRetried() {
        server.reply(401, "{\"error\":\"expired\"}");
        MnemoClientException e = assertThrows(MnemoClientException.class,
                () -> builder().embedToken("mnemo_embed_abc").build().execute());
        assertEquals(401, e.getHttpStatus());
        assertEquals(1, server.count());
    }
}
