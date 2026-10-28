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

import java.time.Duration;

/**
 * <b>MnemoClientBuilder</b> is an abstract builder class for constructing instances of {@link MnemoClient}.
 * It provides a fluent interface for setting the API key required for client authentication, and the
 * optional service endpoint and timeout. The builder only collects parameters: {@code build()} hands the
 * builder to the client implementation, which reads every parameter from it when
 * {@link MnemoClient#execute()} is called.
 * Subclasses should implement the {@code build()} method to create specific types of MNEMO clients.
 *
 * @param <B> the concrete builder type, so that the setters below chain into the subclass setters
 * @author edward.suryadi
 * @since 1.0
 */
public abstract class MnemoClientBuilder<B extends MnemoClientBuilder<B>> {
    /** The public MNEMO service endpoint, used unless {@link #baseUrl(String)} is set. */
    public static final String DEFAULT_BASE_URL = "https://mnemo-api.panaxon.ai/api";

    private String apiKey;
    private String baseUrl = DEFAULT_BASE_URL;
    private String tenantId;
    private Duration timeout = Duration.ofSeconds(120);

    /** @return this builder, typed as the concrete subclass */
    protected abstract B self();

    /** Sets the MNEMO API token, sent as the {@code X-Mnemo-Api-Token} header. */
    public B apiKey(String apiKey) {
        this.apiKey = apiKey;
        return self();
    }

    /** Overrides the service endpoint, e.g. for a self-hosted or test deployment. */
    public B baseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
        return self();
    }

    /** Sets the tenant the call is made for. Required by operations that act on a tenant's memory. */
    public B tenantId(String tenantId) {
        this.tenantId = tenantId;
        return self();
    }

    /** Sets the connect and read timeout. Chat calls run an LLM, so the default is generous (120s). */
    public B timeout(Duration timeout) {
        this.timeout = timeout;
        return self();
    }

    String apiKey() {
        return apiKey;
    }

    String baseUrl() {
        return baseUrl;
    }

    String tenantId() {
        return tenantId;
    }

    Duration timeout() {
        return timeout;
    }

    abstract public MnemoClient build();
}
