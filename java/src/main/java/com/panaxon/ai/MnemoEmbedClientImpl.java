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
import com.panaxon.ai.model.EmbedToken;
import jakarta.ws.rs.client.WebTarget;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * <b>MnemoEmbedClientImpl</b> implements {@link MnemoEmbedClient}: one private method per operation.
 *
 * @author edward.suryadi
 * @since 1.2
 */
class MnemoEmbedClientImpl extends AbstractMnemoClient implements MnemoEmbedClient {
    static final Pattern ORIGIN = Pattern.compile(
            "(https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|http://(localhost|127\\.0\\.0\\.1))(:[0-9]{1,5})?");
    static final Pattern END_USER_ID = Pattern.compile("[A-Za-z0-9._@-]{1,128}");

    private final Builder builder;

    MnemoEmbedClientImpl(Builder builder) {
        super(builder);
        this.builder = builder;
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> T execute() throws MnemoClientException {
        Operation operation = builder.operation();
        if (operation == null) {
            throw invalid("operation is required");
        }
        return (T) withTarget(base -> switch (operation) {
            case MINT_TOKEN -> mintToken(base);
        });
    }

    private EmbedToken mintToken(WebTarget base) throws MnemoClientException {
        if (!isBlank(builder.embedToken())) {
            throw invalid("an embed token cannot mint tokens; use apiKey or clientCredentials");
        }
        String tenantId = require(tenantId(), "tenantId");
        String origin = require(builder.allowedOrigin(), "allowedOrigin");
        if (!ORIGIN.matcher(origin).matches()) {
            throw invalid("allowedOrigin must be one origin, https://host[:port] "
                    + "(http only for localhost and 127.0.0.1), with no path and no wildcard");
        }
        if (builder.endUserId() != null && !END_USER_ID.matcher(builder.endUserId()).matches()) {
            throw invalid("endUserId must be 1 to 128 characters of A-Z a-z 0-9 . _ @ -");
        }
        Integer ttl = builder.ttlSeconds();
        if (ttl != null && (ttl < 60 || ttl > 900)) {
            throw invalid("ttlSeconds must be between 60 and 900");
        }
        Map<String, Object> reply = send("POST", base.path("mnemo/embed/token"),
                body("tenantId", tenantId, "allowedOrigin", origin, "endUserId", builder.endUserId(),
                        "ttlSeconds", ttl), MAP);
        if (reply == null || !(reply.get("token") instanceof String token)
                || !(reply.get("expiresAt") instanceof String expiresAt)
                || !(reply.get("sessionPrefix") instanceof String sessionPrefix)) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.SERIALIZATION_ERROR, null));
        }
        try {
            return new EmbedToken(token, Instant.parse(expiresAt),
                    reply.get("tenantId") instanceof String t ? t : tenantId, sessionPrefix);
        } catch (DateTimeParseException e) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.SERIALIZATION_ERROR, null), e);
        }
    }
}
