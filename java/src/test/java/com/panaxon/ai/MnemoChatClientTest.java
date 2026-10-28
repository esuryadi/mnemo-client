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
import com.panaxon.ai.model.ChatMessageResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MnemoChatClientTest {
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

    private MnemoChatClient.Builder builder() {
        return new MnemoChatClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme");
    }

    @Test
    void chatPostsRequestAndParsesReply() throws Exception {
        server.reply(200, """
                {"tenantId":"acme","sessionId":"s1","id":"m1","message":"You had pasta.","attachments":null,
                 "timestamp":1700000000000,"timing":{"memoryOperationMs":5,"llmPostprocessMs":7,"totalMs":12},
                 "sessionName":"Meals","reasoningTrace":null,"quotaWarning":null,
                 "tokenUsage":{"inputTokens":10,"outputTokens":4},"someFutureField":true}""");

        ChatMessageResponse reply = builder().sessionId("s1").message("What did I eat?").build().execute();

        assertEquals("You had pasta.", reply.message());
        assertEquals(12, reply.timing().totalMs());
        assertEquals(4, reply.tokenUsage().outputTokens());
        FakeMnemoServer.Received r = server.last();
        assertEquals("POST", r.method());
        assertEquals("/mnemo/chat", r.path());
        assertEquals("tok-1", r.token());
        Map<?, ?> sent = JSON.readValue(r.body(), Map.class);
        assertEquals(Map.of("tenantId", "acme", "sessionId", "s1", "message", "What did I eat?"), sent);
    }

    @Test
    void missingApiKeyFailsBeforeAnyRequest() {
        MnemoClientException e = assertThrows(MnemoClientException.class,
                () -> new MnemoChatClient.Builder().baseUrl(server.url()).tenantId("acme")
                        .sessionId("s").message("hi").build().execute());
        assertEquals(MnemoError.Code.MISSING_API_KEY, e.getError().code());
        assertEquals(0, server.count());
    }

    @Test
    void missingRequiredParameterNamesTheField() {
        MnemoClientException e = assertThrows(MnemoClientException.class,
                () -> builder().sessionId("s1").build().execute());
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        assertTrue(e.getMessage().contains("message"), e.getMessage());
        assertEquals(0, server.count());
    }

    @Test
    void serviceErrorsCarryStatusAndServerMessage() {
        server.reply(429, "{\"error\":\"Daily quota 100% used\"}");
        MnemoClientException e = assertThrows(MnemoClientException.class,
                () -> builder().sessionId("s1").message("hi").build().execute());
        assertEquals(429, e.getHttpStatus());
        assertEquals(MnemoError.Code.RATE_LIMITED, e.getError().code());
        assertEquals("Daily quota 100% used", e.getMessage());
    }

    @Test
    void statusCodesMapToErrorCodes() {
        Map<Integer, MnemoError.Code> expected = Map.of(
                401, MnemoError.Code.UNAUTHORIZED, 403, MnemoError.Code.FORBIDDEN,
                404, MnemoError.Code.NOT_FOUND, 500, MnemoError.Code.SERVER_ERROR,
                400, MnemoError.Code.INVALID_REQUEST);
        expected.forEach((status, code) -> {
            server.reply(status, "not json");
            MnemoClientException e = assertThrows(MnemoClientException.class,
                    () -> builder().operation(MnemoChatClient.Operation.GET_PLAN).build().execute());
            assertEquals(code, e.getError().code(), "status " + status);
            assertEquals(status, e.getHttpStatus());
        });
    }

    @Test
    void unreachableServiceIsAnIoError() throws Exception {
        String dead = server.url();
        server.close();
        MnemoClientException e = assertThrows(MnemoClientException.class,
                () -> builder().baseUrl(dead).sessionId("s").message("hi").build().execute());
        assertEquals(MnemoError.Code.IO_ERROR, e.getError().code());
        assertEquals(0, e.getHttpStatus());
    }

    @Test
    void listSubjectsReturnsList() throws Exception {
        server.reply(200, "[{\"name\":\"Meals\"},{\"name\":\"Travel\"}]");
        List<Map<String, Object>> subjects = builder()
                .operation(MnemoChatClient.Operation.LIST_SUBJECTS).build().execute();
        assertEquals(2, subjects.size());
        assertEquals("Travel", subjects.get(1).get("name"));
        assertEquals("GET", server.last().method());
        assertEquals("tenantId=acme", server.last().query());
    }

    @Test
    void listSessionsSendsOnlyParametersThatWereSet() throws Exception {
        server.reply(200, "{\"content\":[],\"totalElements\":0}");
        Map<String, Object> page = builder().operation(MnemoChatClient.Operation.LIST_SESSIONS)
                .query("trip").size(10).build().execute();
        assertEquals(0, ((Number) page.get("totalElements")).intValue());
        assertEquals("/mnemo/sessions", server.last().path());
        assertEquals("tenantId=acme&q=trip&size=10", server.last().query());
    }

    @Test
    void deleteSubjectEncodesNameAndReturnsNullOn204() throws Exception {
        server.reply(204, "");
        Object result = builder().operation(MnemoChatClient.Operation.DELETE_SUBJECT)
                .subjectName("Q3 plan/2026").build().execute();
        assertNull(result);
        assertEquals("DELETE", server.last().method());
        assertEquals("/mnemo/subject/Q3%20plan%2F2026", server.last().rawPath());
    }

    @Test
    void renameSessionUsesPatch() throws Exception {
        server.reply(200, "{\"sessionName\":\"Trip\"}");
        Map<String, Object> result = builder().operation(MnemoChatClient.Operation.RENAME_SESSION)
                .sessionId("s1").sessionName("Trip").build().execute();
        assertEquals("Trip", result.get("sessionName"));
        assertEquals("PATCH", server.last().method());
        assertEquals("/mnemo/sessions/s1/name", server.last().path());
        assertEquals(Map.of("sessionName", "Trip"), JSON.readValue(server.last().body(), Map.class));
    }

    @Test
    void closeSessionPassesPermanentFlag() throws Exception {
        server.reply(204, "");
        builder().operation(MnemoChatClient.Operation.CLOSE_SESSION).sessionId("s1").permanent(true)
                .build().execute();
        assertEquals("tenantId=acme&permanent=true", server.last().query());
    }

    @Test
    void historyPassesCursor() throws Exception {
        server.reply(200, "{\"messages\":[]}");
        builder().operation(MnemoChatClient.Operation.GET_HISTORY).sessionId("s1").before(99L).size(5)
                .build().execute();
        assertEquals("/mnemo/sessions/s1/history", server.last().path());
        assertEquals("tenantId=acme&before=99&size=5", server.last().query());
    }

    @Test
    void healthNeedsNoTenant() throws Exception {
        server.reply(200, "{\"status\":\"UP\"}");
        Map<String, Object> health = new MnemoChatClient.Builder().apiKey("k").baseUrl(server.url())
                .operation(MnemoChatClient.Operation.HEALTH).build().execute();
        assertEquals("UP", health.get("status"));
    }

    @Test
    void factoryRejectsNullBuilderAndBuildsClient() throws Exception {
        assertThrows(MnemoClientException.class, () -> MnemoClientFactory.create(null));
        assertInstanceOf(MnemoChatClient.class, MnemoClientFactory.create(builder()));
    }
}
