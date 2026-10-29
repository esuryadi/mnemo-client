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
 * Multi-Dimensional Neural Elastic Memory Organization (MNEMO) - TypeScript client.
 *
 * Inventor: Edward Suryadi
 * Assignee: PANAXON.AI, LLC
 *
 * Author: edward.suryadi
 * Since: Oct-2026
 */

import type { MnemoClient } from "./MnemoClient.js";

/**
 * <b>MnemoClientBuilder</b> is the base of every client builder. It collects the API key required for
 * authentication and the optional service endpoint and timeout. The builder only collects parameters:
 * {@code build()} hands the builder to the client implementation, which reads every parameter from it when
 * {@link MnemoClient.execute} is called. Setters return {@code this}, typed as the concrete subclass, so they
 * chain into the subclass setters.
 */
export abstract class MnemoClientBuilder {
    /** The public MNEMO service endpoint, used unless {@link baseUrl} is set. */
    static readonly DEFAULT_BASE_URL = "https://mnemo-api.panaxon.ai/api";

    /** @internal */ _apiKey?: string;
    /** @internal */ _baseUrl: string = MnemoClientBuilder.DEFAULT_BASE_URL;
    /** @internal */ _tenantId?: string;
    /** @internal */ _timeoutMs: number = 120_000;

    /** Sets the MNEMO API token, sent as the {@code X-Mnemo-Api-Token} header. */
    apiKey(apiKey: string): this {
        this._apiKey = apiKey;
        return this;
    }

    /** Overrides the service endpoint, e.g. for a self-hosted or test deployment. */
    baseUrl(baseUrl: string): this {
        this._baseUrl = baseUrl;
        return this;
    }

    /** Sets the tenant the call is made for. Required by operations that act on a tenant's memory. */
    tenantId(tenantId: string): this {
        this._tenantId = tenantId;
        return this;
    }

    /**
     * Sets the request timeout in milliseconds; {@code 0} means no timeout. Chat calls run an LLM, so the
     * default is generous (120s).
     */
    timeout(timeoutMs: number): this {
        this._timeoutMs = timeoutMs;
        return this;
    }

    abstract build(): MnemoClient;
}
