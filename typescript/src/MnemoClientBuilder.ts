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

import { MnemoClientException } from "./exception/MnemoClientException.js";
import { MnemoError } from "./exception/MnemoError.js";
import type { MnemoClient } from "./MnemoClient.js";

/** True when running in a browser page: there is a {@code window} or a {@code document}. */
function runsInBrowser(): boolean {
    return typeof window !== "undefined" || typeof (globalThis as { document?: unknown }).document !== "undefined";
}

/**
 * <b>MnemoClientBuilder</b> is the base of every client builder. It collects the credentials (an API key,
 * or an OAuth client id and secret) and the optional service endpoint and timeout. The builder only collects parameters:
 * {@code build()} hands the builder to the client implementation, which reads every parameter from it when
 * {@link MnemoClient.execute} is called. Setters return {@code this}, typed as the concrete subclass, so they
 * chain into the subclass setters.
 */
export abstract class MnemoClientBuilder {
    /** The public MNEMO service endpoint, used unless {@link baseUrl} is set. */
    static readonly DEFAULT_BASE_URL = "https://mnemo-api.panaxon.ai/api";

    /** @internal */ _apiKey?: string;
    /** @internal */ _clientId?: string;
    /** @internal */ _clientSecret?: string;
    /** @internal */ _embedToken?: string;
    /** @internal */ _allowApiKeyInBrowser = false;
    /**
     * @internal The client-credentials token cache (the token and the time (ms) it expires at) and the token
     * fetch in flight, so concurrent calls share one exchange. An object, so a copy of the builder shares it.
     */
    _oauth: { token?: { value: string; expiresAt: number }; fetch?: Promise<string> } = {};
    /** @internal */ _baseUrl: string = MnemoClientBuilder.DEFAULT_BASE_URL;
    /** @internal */ _tenantId?: string;
    /** @internal */ _timeoutMs: number = 120_000;

    /** Sets the MNEMO API token, sent as the {@code X-Mnemo-Api-Token} header. */
    apiKey(apiKey: string): this {
        this.refuseInBrowser("apiKey");
        this._apiKey = apiKey;
        return this;
    }

    /**
     * Authenticates with an OAuth client instead of an API key. The client id and secret (created in Dorothy
     * under Security, OAuth Clients) are exchanged at {@code {baseUrl}/oauth/token} for a one-hour bearer token.
     * The token is fetched on first use, reused, and fetched again shortly before it expires, or after the
     * service rejects it. Set this or {@link apiKey}, not both.
     */
    clientCredentials(clientId: string, clientSecret: string): this {
        this.refuseInBrowser("clientCredentials");
        this._clientId = clientId;
        this._clientSecret = clientSecret;
        return this;
    }

    /**
     * Authenticates with a short-lived embed token minted by {@code MnemoEmbedClient} on a server, sent as the
     * {@code X-Mnemo-Api-Token} header. This is the only credential meant for a browser. Set this, or
     * {@link apiKey} or {@link clientCredentials}, not more than one. Meant for the browser-facing calls (init stream,
     * chat stream, history); the service refuses an embed token on anything else.
     */
    embedToken(embedToken: string): this {
        this._embedToken = embedToken;
        return this;
    }

    /**
     * Lets {@link apiKey} and {@link clientCredentials} be used while running in a browser, where they would be
     * visible to every visitor of the page. Call this <b>before</b> {@code apiKey()} or {@code clientCredentials()}.
     * Leave it off: a page should hold an embed token only.
     */
    allowApiKeyInBrowser(allow: boolean): this {
        this._allowApiKeyInBrowser = allow;
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

    private refuseInBrowser(what: string): void {
        if (!this._allowApiKeyInBrowser && runsInBrowser()) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.INVALID_REQUEST,
                `${what} would be visible to every visitor of the page; use embedToken in a browser `
                + "(or call allowApiKeyInBrowser(true) first if this is deliberate)"));
        }
    }
}
