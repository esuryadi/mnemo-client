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
import com.panaxon.ai.model.RagQueryResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MnemoRAGClientTest {
    private FakeMnemoServer server;

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
    }

    @AfterEach
    void stop() {
        server.close();
    }

    private MnemoRAGClient.Builder builder() {
        return new MnemoRAGClient.Builder().apiKey("tok-1").baseUrl(server.url());
    }

    @Test
    void queryPostsToRagIdAndParsesAnswer() throws Exception {
        server.reply(200, """
                {"answer":"30 days","found":true,"source":"policy.pdf","authority":"HIGH","confidence":"HIGH",
                 "lastUpdated":"2026-09-01T10:15:30Z","retrievalTier":"TARGETED","subjectsUsed":["Refunds"],
                 "tokenUsage":{"inputTokens":50,"outputTokens":9}}""");

        RagQueryResponse r = builder().ragId("support-kb").query("Refund window?")
                .additionalContext(List.of("annual plans")).build().execute();

        assertTrue(r.found());
        assertEquals("30 days", r.answer());
        assertEquals(Instant.parse("2026-09-01T10:15:30Z"), r.lastUpdated());
        assertEquals(List.of("Refunds"), r.subjectsUsed());
        FakeMnemoServer.Received req = server.last();
        assertEquals("POST", req.method());
        assertEquals("/mnemo/rag/support-kb", req.path());
        assertEquals("tok-1", req.token());
        assertEquals(Map.of("query", "Refund window?", "additionalContext", List.of("annual plans")),
                new ObjectMapper().readValue(req.body(), Map.class));
    }

    @Test
    void additionalContextIsOmittedWhenNotSet() throws Exception {
        server.reply(200, "{\"answer\":\"x\",\"found\":false}");
        builder().ragId("kb").query("q").build().execute();
        assertEquals(Map.of("query", "q"), new ObjectMapper().readValue(server.last().body(), Map.class));
    }

    @Test
    void ragIdAndQueryAreRequired() {
        assertEquals(MnemoError.Code.INVALID_REQUEST, assertThrows(MnemoClientException.class,
                () -> builder().query("q").build().execute()).getError().code());
        assertEquals(MnemoError.Code.INVALID_REQUEST, assertThrows(MnemoClientException.class,
                () -> builder().ragId("kb").build().execute()).getError().code());
        assertEquals(0, server.count());
    }

    @Test
    void planGatedTenantGetsForbidden() {
        server.reply(403, "{\"error\":\"MnemoRAG requires a Pro plan\"}");
        MnemoClientException e = assertThrows(MnemoClientException.class,
                () -> builder().ragId("kb").query("q").build().execute());
        assertEquals(MnemoError.Code.FORBIDDEN, e.getError().code());
        assertEquals("MnemoRAG requires a Pro plan", e.getMessage());
    }
}
