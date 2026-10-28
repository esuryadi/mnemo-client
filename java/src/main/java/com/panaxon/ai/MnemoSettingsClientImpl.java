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
import com.panaxon.ai.model.SettingsResponse;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.GenericType;

import java.util.Map;

/**
 * <b>MnemoSettingsClientImpl</b> is a concrete implementation of the {@link MnemoSettingsClient} interface.
 * It provides the actual logic for executing settings-related operations within the MNEMO system.
 * This class is responsible for handling requests and processing responses in a settings context.
 *
 * @author edward.suryadi
 * @since 1.0
 */
class MnemoSettingsClientImpl extends AbstractMnemoClient implements MnemoSettingsClient {
    private final Builder builder;

    MnemoSettingsClientImpl(Builder builder) {
        super(builder);
        this.builder = builder;
    }

    /** Dispatches to the method that implements the operation chosen on the builder. */
    @Override
    @SuppressWarnings("unchecked")
    public <T> T execute() throws MnemoClientException {
        Operation operation = builder.operation();
        if (operation == null) {
            throw invalid("operation is required");
        }
        return (T) withTarget(base -> switch (operation) {
            case GET_SETTINGS -> getSettings(base);
            case UPDATE_SETTINGS -> updateSettings(base);
            case GET_OPTIONS -> getOptions(base);
        });
    }

    private SettingsResponse getSettings(WebTarget base) throws MnemoClientException {
        return send("GET", base.path("mnemo/account/{id}/settings")
                .resolveTemplate("id", require(builder.accountId(), "accountId")),
                null, new GenericType<SettingsResponse>() { });
    }

    private SettingsResponse updateSettings(WebTarget base) throws MnemoClientException {
        return send("PUT", base.path("mnemo/account/{id}/settings")
                .resolveTemplate("id", require(builder.accountId(), "accountId")),
                body("provider", builder.provider(), "model", builder.model(),
                        "ingestModel", builder.ingestModel(), "apiKey", builder.providerApiKey(),
                        "lookbackDays", builder.lookbackDays(), "encryptData", builder.encryptData(),
                        "sharedMemoryTtlHours", builder.sharedMemoryTtlHours()),
                new GenericType<SettingsResponse>() { });
    }

    private Map<String, Object> getOptions(WebTarget base) throws MnemoClientException {
        return send("GET", base.path("mnemo/account/settings/options"), null, MAP);
    }
}
