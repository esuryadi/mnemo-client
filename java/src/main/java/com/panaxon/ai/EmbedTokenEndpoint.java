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
import com.panaxon.ai.model.EmbedToken;

import java.time.format.DateTimeFormatter;
import java.util.function.Supplier;

/**
 * The framework-neutral body of the "give the page a token" endpoint that {@code <mnemo-chat token-url="...">}
 * calls. The caller (a Spring controller, a servlet, any handler) authenticates its own visitor first, then passes
 * the visitor's id here and returns the string as {@code application/json}.
 *
 * <p>The result holds only {@code token}, {@code expiresAt} and {@code sessionPrefix}: never the API key and
 * nothing else. The {@link MnemoEmbedClient.Builder} template carries the credential, the tenant and the allowed
 * origin; this class sets the end user on it and runs the call.
 *
 * @author edward.suryadi
 * @since 1.2
 */
public final class EmbedTokenEndpoint {
    private EmbedTokenEndpoint() {
    }

    /**
     * Mints a token for {@code endUserId} and returns the JSON the component expects.
     *
     * @param template  a builder with the credential, tenantId and allowedOrigin set (not modified apart from
     *                  its end user, so use one builder per request or per thread)
     * @param endUserId the authenticated visitor's id, or {@code null} for an anonymous visitor
     * @throws MnemoClientException when the call is invalid or the service refuses it
     */
    public static String handle(MnemoEmbedClient.Builder template, String endUserId) throws MnemoClientException {
        if (template == null) {
            throw AbstractMnemoClient.invalid("template is required");
        }
        EmbedToken token = template.endUserId(endUserId).operation(MnemoEmbedClient.Operation.MINT_TOKEN).build().execute();
        return "{\"token\":" + quote(token.token())
                + ",\"expiresAt\":" + quote(DateTimeFormatter.ISO_INSTANT.format(token.expiresAt()))
                + ",\"tenantId\":" + quote(token.tenantId())
                + ",\"sessionPrefix\":" + quote(token.sessionPrefix()) + "}";
    }

    /**
     * Same as {@link #handle(MnemoEmbedClient.Builder, String)}, with a fresh builder per call, which is the safe
     * form when requests are handled on several threads.
     */
    public static String handle(Supplier<MnemoEmbedClient.Builder> template, String endUserId) throws MnemoClientException {
        if (template == null) {
            throw AbstractMnemoClient.invalid("template is required");
        }
        return handle(template.get(), endUserId);
    }

    private static String quote(String value) {
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20 || c == '<' || c == '>' || c == '&' || c == ' ' || c == ' ') {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.append('"').toString();
    }
}
