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

import com.panaxon.ai.FakeMnemoServer.Reply;
import com.panaxon.ai.exception.MnemoClientException;
import com.panaxon.ai.exception.MnemoError;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;

class MnemoClientCredentialsTest {
    private static final String TOKEN_PATH = "/oauth/token";
    private static final String LIST_PATH = "/mnemo/network/sharing/private";
    private static final Reply UNAUTHORIZED = new Reply(401, "{\"error\":\"Unauthorized\"}");
    private FakeMnemoServer server;

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
    }

    @AfterEach
    void stop() {
        server.close();
    }

    private static Reply token(String value, int expiresIn) {
        return new Reply(200, "{\"access_token\":\"" + value + "\",\"token_type\":\"Bearer\",\"expires_in\":" + expiresIn + "}");
    }

    private MnemoNetworkClient.Builder builder() {
        return new MnemoNetworkClient.Builder().clientCredentials("mnemo_cid_1", "mnemo_cs_1").baseUrl(server.url())
                .tenantId("acme").operation(MnemoNetworkClient.Operation.LIST_PRIVATE_GRANTS);
    }

    private List<FakeMnemoServer.Received> apiCalls() {
        return server.requests().stream().filter(r -> !r.path().equals(TOKEN_PATH)).toList();
    }

    private long tokenCalls() {
        return server.requests().stream().filter(r -> r.path().equals(TOKEN_PATH)).count();
    }

    @Test
    void exchangesTheCredentialsAndSendsTheBearerToken() throws Exception {
        server.replyOn(TOKEN_PATH, token("tok-a", 3600)).reply(200, "{}");
        builder().build().execute();
        FakeMnemoServer.Received first = server.requests().get(0);
        assertEquals("POST", first.method());
        assertEquals(TOKEN_PATH, first.path());
        assertEquals("grant_type=client_credentials", first.body());
        assertEquals("Basic " + Base64.getEncoder().encodeToString("mnemo_cid_1:mnemo_cs_1".getBytes(StandardCharsets.UTF_8)),
                first.authorization());
        assertEquals("Bearer tok-a", apiCalls().get(0).authorization());
        assertNull(apiCalls().get(0).token());
    }

    @Test
    void reusesTheTokenAcrossCalls() throws Exception {
        server.replyOn(TOKEN_PATH, token("tok-a", 3600)).reply(200, "{}");
        MnemoClient client = builder().build();
        client.execute();
        client.execute();
        assertEquals(1, tokenCalls());
        assertEquals(2, apiCalls().size());
    }

    @Test
    void sharesOneExchangeBetweenConcurrentCalls() throws Exception {
        server.replyOn(TOKEN_PATH, token("tok-a", 3600)).reply(200, "{}");
        MnemoClient client = builder().build();
        CompletableFuture<?>[] calls = new CompletableFuture<?>[3];
        for (int i = 0; i < calls.length; i++) {
            calls[i] = CompletableFuture.runAsync(() -> {
                try {
                    client.execute();
                } catch (MnemoClientException e) {
                    throw new IllegalStateException(e);
                }
            });
        }
        CompletableFuture.allOf(calls).get();
        assertEquals(1, tokenCalls());
    }

    @Test
    void fetchesANewTokenWhenTheOldOneIsAboutToExpire() throws Exception {
        server.replyOn(TOKEN_PATH, token("tok-a", 30), token("tok-b", 3600)).reply(200, "{}");
        MnemoClient client = builder().build();
        client.execute();
        client.execute();
        assertEquals(List.of("Bearer tok-a", "Bearer tok-b"),
                apiCalls().stream().map(FakeMnemoServer.Received::authorization).toList());
    }

    @Test
    void fetchesANewTokenAndRetriesOnceWhenTheServiceRejectsIt() throws Exception {
        server.replyOn(TOKEN_PATH, token("tok-a", 3600), token("tok-b", 3600));
        server.replyOn(LIST_PATH, UNAUTHORIZED, new Reply(200, "{}"));
        builder().build().execute();
        assertEquals(List.of("Bearer tok-a", "Bearer tok-b"),
                apiCalls().stream().map(FakeMnemoServer.Received::authorization).toList());
    }

    @Test
    void givesUpAfterOneRetry() {
        server.replyOn(TOKEN_PATH, token("tok-a", 3600));
        server.replyOn(LIST_PATH, UNAUTHORIZED);
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().build().execute());
        assertEquals(401, e.getHttpStatus());
        assertEquals(2, apiCalls().size());
    }

    @Test
    void aWrongSecretIsUnauthorizedAndNoCallIsSent() {
        server.replyOn(TOKEN_PATH, new Reply(401, "{\"error\":\"invalid_client\"}"));
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().build().execute());
        assertEquals(MnemoError.Code.UNAUTHORIZED, e.getError().code());
        assertEquals(0, apiCalls().size());
    }

    @Test
    void aLockedClientIsRateLimited() {
        server.replyOn(TOKEN_PATH, new Reply(429, "{\"error\":\"too_many_attempts\"}"));
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().build().execute());
        assertEquals(MnemoError.Code.RATE_LIMITED, e.getError().code());
    }

    @Test
    void aTokenReplyWithoutATokenIsASerializationError() {
        server.replyOn(TOKEN_PATH, new Reply(200, "{}"));
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().build().execute());
        assertEquals(MnemoError.Code.SERIALIZATION_ERROR, e.getError().code());
    }

    @Test
    void anApiKeyTogetherWithCredentialsIsRefusedBeforeAnyRequest() {
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().apiKey("tok-1").build().execute());
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        assertEquals(0, server.count());
    }

    @Test
    void anIdWithoutASecretIsRefused() {
        MnemoNetworkClient.Builder b = new MnemoNetworkClient.Builder().clientCredentials("mnemo_cid_1", " ")
                .baseUrl(server.url()).tenantId("acme").operation(MnemoNetworkClient.Operation.LIST_PRIVATE_GRANTS);
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> b.build().execute());
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        assertEquals(0, server.count());
    }

    @Test
    void anApiKeyStillUsesTheTokenHeaderAndNoExchange() throws Exception {
        server.reply(200, "{}");
        new MnemoNetworkClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme")
                .operation(MnemoNetworkClient.Operation.LIST_PRIVATE_GRANTS).build().execute();
        assertEquals("tok-1", server.last().token());
        assertNull(server.last().authorization());
        assertEquals(1, server.count());
    }
}
