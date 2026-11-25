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

import com.panaxon.ai.model.ChatMessageResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Integration tests for the operations {@link MnemoClientIT} does not cover, against a real MNEMO deployment.
 * Run through failsafe ({@code mvn verify -DskipITs=false -Dgpg.skip=true}); every test skips itself when its
 * environment is missing. Needs {@code MNEMO_API_KEY} and {@code MNEMO_TENANT_ID} (and optionally {@code MNEMO_BASE_URL}).
 *
 * <p>Tests that write data also need {@code MNEMO_IT_WRITE=true}, and point at a throwaway tenant such as the QA
 * account: the chat session is deleted afterwards.
 */
class MnemoClientOperationsIT {
    private static String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? null : value;
    }

    private static String need(String name) {
        String value = env(name);
        assumeTrue(value != null, name + " is not set");
        return value;
    }

    private static void needWrite() {
        assumeTrue("true".equalsIgnoreCase(env("MNEMO_IT_WRITE")), "MNEMO_IT_WRITE is not true");
    }

    private static String baseUrl() {
        String url = env("MNEMO_BASE_URL");
        return url == null ? MnemoClientBuilder.DEFAULT_BASE_URL : url;
    }

    private static MnemoChatClient.Builder chat() {
        return new MnemoChatClient.Builder().apiKey(need("MNEMO_API_KEY")).baseUrl(baseUrl())
                .tenantId(need("MNEMO_TENANT_ID"));
    }

    @Test
    void sessionsArePageable() throws Exception {
        Map<String, Object> page = chat().operation(MnemoChatClient.Operation.LIST_SESSIONS).size(2).build().execute();
        assertTrue(page.containsKey("content"), page.keySet().toString());
        assertTrue(((List<?>) page.get("content")).size() <= 2);
    }

    @Test
    void sessionLifecycle() throws Exception {
        needWrite();
        assumeTrue("true".equalsIgnoreCase(env("MNEMO_IT_CHAT")), "MNEMO_IT_CHAT is not true");
        String session = "it-lifecycle-" + UUID.randomUUID();
        String marker = "marker-" + UUID.randomUUID();
        try {
            Map<String, Object> init = chat().sessionId(session).sessionName("IT lifecycle")
                    .operation(MnemoChatClient.Operation.INIT_SESSION).build().execute();
            assertEquals(true, init.get("ready"));

            ChatMessageResponse reply = chat().sessionId(session)
                    .message("Please reply with one short sentence. Reference: " + marker).build().execute();
            assertEquals(session, reply.sessionId());
            assertFalse(reply.message().contains("not been initialized"), reply.message());

            // the turn is saved asynchronously, so poll for it rather than reading once
            String history = "";
            for (int i = 0; i < 15 && !history.contains(marker); i++) {
                Map<String, Object> page = chat().sessionId(session)
                        .operation(MnemoChatClient.Operation.GET_HISTORY).size(10).build().execute();
                history = String.valueOf(page);
                if (!history.contains(marker)) Thread.sleep(1000);
            }
            assertTrue(history.contains(marker), "turn never appeared in history: " + history);

            assertNull(chat().sessionId(session).operation(MnemoChatClient.Operation.CLOSE_SESSION)
                    .build().execute());
        } finally {
            chat().sessionId(session).operation(MnemoChatClient.Operation.CLOSE_SESSION).permanent(true)
                    .build().execute();
        }
    }
}
