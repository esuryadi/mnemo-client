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
import com.panaxon.ai.model.StreamEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MnemoChatStreamTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String STREAM = ": hello\n\n"
            + "event: token\ndata: {\"text\":\"Hel\"}\n\n"
            + "event: token\ndata: {\"text\":\"lo\"}\n\n"
            + "event: complete\ndata: {\"message\":\"Hello\"}\n\n"
            + "event: done\ndata: \n\n";
    private FakeMnemoServer server;
    private final List<StreamEvent> events = new ArrayList<>();

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
    }

    @AfterEach
    void stop() {
        server.close();
    }

    private MnemoChatClient.Builder builder() {
        return new MnemoChatClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme")
                .operation(MnemoChatClient.Operation.CHAT_STREAM).sessionId("s1").message("hi").onEvent(events::add);
    }

    @Test
    void postsTheJsonBodyAndHandsOverEveryEventInOrder() throws Exception {
        server.reply(200, STREAM, "text/event-stream");

        Object result = builder().role("user").answerFromJobText("job-7").build().execute();

        assertNull(result);
        assertEquals(List.of(new StreamEvent("token", "{\"text\":\"Hel\"}"), new StreamEvent("token", "{\"text\":\"lo\"}"),
                new StreamEvent("complete", "{\"message\":\"Hello\"}"), new StreamEvent("done", "")), events);
        FakeMnemoServer.Received r = server.last();
        assertEquals("POST", r.method());
        assertEquals("/mnemo/chat/stream", r.path());
        assertNull(r.query());
        assertEquals("text/event-stream", r.accept());
        assertEquals("tok-1", r.token());
        assertEquals(Map.of("tenantId", "acme", "sessionId", "s1", "message", "hi", "role", "user",
                "answerFromJobText", "job-7"), JSON.readValue(r.body(), Map.class));
    }

    @Test
    void optionalFieldsAreOmittedWhenNotSet() throws Exception {
        server.reply(200, STREAM, "text/event-stream");
        builder().build().execute();
        assertEquals(Map.of("tenantId", "acme", "sessionId", "s1", "message", "hi"),
                JSON.readValue(server.last().body(), Map.class));
    }

    @Test
    void anErrorEventIsPassedOnLikeAnyOther() throws Exception {
        server.reply(200, "event: error\ndata: {\"error\":\"boom\"}\n\n", "text/event-stream");
        builder().build().execute();
        assertEquals(List.of(new StreamEvent("error", "{\"error\":\"boom\"}")), events);
    }

    @Test
    void anEventWithoutANameIsAMessage() throws Exception {
        server.reply(200, "data: plain\n\n", "text/event-stream");
        builder().build().execute();
        assertEquals(List.of(new StreamEvent("message", "plain")), events);
    }

    @Test
    void anHttpErrorCarriesTheStatusAndNoEventIsDelivered() {
        server.reply(409, "{\"error\":\"session not initialized\"}");
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> builder().build().execute());
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        assertEquals(409, e.getHttpStatus());
        assertTrue(events.isEmpty());
    }

    @Test
    void validatesBeforeSending() {
        for (MnemoChatClient.Builder b : List.of(builder().tenantId(null), builder().sessionId(null),
                builder().message(null), builder().onEvent(null))) {
            MnemoClientException e = assertThrows(MnemoClientException.class, () -> b.build().execute());
            assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        }
        assertEquals(0, server.count());
    }

    @Test
    void eventParserHandsOverEventsAsTheLinesArrive() {
        List<AbstractMnemoClient.SseEvent> seen = new ArrayList<>();
        AbstractMnemoClient.SseParser parser = new AbstractMnemoClient.SseParser(seen::add);
        parser.line("event: a");
        parser.line("data: one");
        assertTrue(seen.isEmpty());
        parser.line("");
        assertEquals(1, seen.size());
        parser.line("data: tail");
        parser.finish();
        assertEquals(2, seen.size());
        assertEquals("message", seen.get(1).name());
    }
}
