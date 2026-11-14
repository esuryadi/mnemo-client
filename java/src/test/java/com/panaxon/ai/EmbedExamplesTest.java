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
import com.panaxon.ai.examples.PlainHttpServerEmbedExample;
import com.panaxon.ai.examples.SpringStyleEmbedController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** The examples under {@code src/test/.../examples} compile and work, so the documentation built on them cannot rot. */
class EmbedExamplesTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private FakeMnemoServer server;

    @BeforeEach
    void start() throws Exception {
        server = new FakeMnemoServer();
        server.reply(200, MnemoEmbedClientTest.MINTED);
    }

    @AfterEach
    void stop() {
        server.close();
    }

    @Test
    void theSpringStyleControllerReturnsTheTokenJsonAndThePage() throws Exception {
        SpringStyleEmbedController controller = new SpringStyleEmbedController("k", server.url(), "acme",
                "https://app.example.com");

        Map<?, ?> json = JSON.readValue(controller.embedToken("user-42"), Map.class);
        assertEquals(Set.of("token", "expiresAt", "tenantId", "sessionPrefix"), json.keySet());
        assertEquals("user-42", JSON.readValue(server.last().body(), Map.class).get("endUserId"));

        String page = controller.chat();
        assertTrue(page.contains("<mnemo-chat token-url=\"/mnemo/embed-token\" width=\"50%\" height=\"600\"></mnemo-chat>"));
    }

    @Test
    void thePlainHttpServerServesThePageAndTheToken() throws Exception {
        try (PlainHttpServerEmbedExample example = new PlainHttpServerEmbedExample(0, "k", server.url(), "acme",
                "https://app.example.com")) {
            HttpClient http = HttpClient.newHttpClient();
            String base = "http://127.0.0.1:" + example.port();

            HttpResponse<String> page = http.send(HttpRequest.newBuilder(URI.create(base + "/chat")).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertEquals(200, page.statusCode());
            assertTrue(page.body().contains("<mnemo-chat token-url=\"/mnemo/embed-token\" height=\"600\">"));

            HttpResponse<String> signedOut = http.send(HttpRequest.newBuilder(URI.create(base + "/mnemo/embed-token")).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertEquals(401, signedOut.statusCode());
            assertEquals(0, server.count());

            HttpResponse<String> token = http.send(HttpRequest.newBuilder(URI.create(base + "/mnemo/embed-token"))
                    .header("X-User", "user-42").build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(200, token.statusCode());
            assertEquals(Set.of("token", "expiresAt", "tenantId", "sessionPrefix"), JSON.readValue(token.body(), Map.class).keySet());
        }
    }
}
