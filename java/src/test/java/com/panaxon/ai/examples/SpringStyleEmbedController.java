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

package com.panaxon.ai.examples;

import com.panaxon.ai.EmbedSnippet;
import com.panaxon.ai.EmbedTokenEndpoint;
import com.panaxon.ai.MnemoEmbedClient;
import com.panaxon.ai.exception.MnemoClientException;

/**
 * What a Spring MVC controller looks like, written as a plain class so this library needs no Spring dependency.
 * In a real project the annotations shown below go on the methods, the visitor id comes from the logged-in user
 * (for example {@code Principal#getName()}), and the API key comes from your configuration, never from the page.
 *
 * <pre>
 * &#64;RestController
 * class ChatController {
 *     &#64;GetMapping(value = "/mnemo/embed-token", produces = "application/json")
 *     String embedToken(Principal user) { ... }
 *
 *     &#64;GetMapping(value = "/chat", produces = "text/html")
 *     String chat() { ... }
 * }
 * </pre>
 */
public class SpringStyleEmbedController {
    private final String apiKey;
    private final String baseUrl;
    private final String tenantId;
    private final String allowedOrigin;

    public SpringStyleEmbedController(String apiKey, String baseUrl, String tenantId, String allowedOrigin) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.tenantId = tenantId;
        this.allowedOrigin = allowedOrigin;
    }

    /** GET /mnemo/embed-token: the JSON the component fetches. Only call it for a signed-in visitor. */
    public String embedToken(String signedInUserId) throws MnemoClientException {
        return EmbedTokenEndpoint.handle(() -> new MnemoEmbedClient.Builder()
                .apiKey(apiKey).baseUrl(baseUrl).tenantId(tenantId).allowedOrigin(allowedOrigin), signedInUserId);
    }

    /** GET /chat: a page that embeds the component. */
    public String chat() throws MnemoClientException {
        return "<!doctype html><title>Chat</title>"
                + EmbedSnippet.render(new EmbedSnippet.Options("/mnemo/embed-token").width("50%").height("600"));
    }
}
