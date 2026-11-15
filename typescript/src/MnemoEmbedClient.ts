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
 * Since: Nov-2026
 */

import type { MnemoClient } from "./MnemoClient.js";
import { MnemoClientBuilder } from "./MnemoClientBuilder.js";
import { MnemoEmbedClientImpl } from "./MnemoEmbedClientImpl.js";

/**
 * <b>MnemoEmbedClient</b> mints the short-lived embed tokens that let a browser chat with MNEMO without ever
 * holding the API key. Run it on <b>your server</b>, authenticated with an API token that has the ADMIN role
 * (or OAuth client credentials), never in a page: the page gets only the token it returns.
 *
 * @example
 * const token = await new MnemoEmbedClient.Builder()
 *     .apiKey(process.env.MNEMO_API_KEY!)
 *     .tenantId("acme")
 *     .allowedOrigin("https://app.example.com")
 *     .endUserId("user-42")
 *     .build().execute<EmbedToken>();
 */
export interface MnemoEmbedClient extends MnemoClient {}

export namespace MnemoEmbedClient {
    /** The embed calls, with the builder parameters each one reads and the type {@code execute()} resolves with. */
    export enum Operation {
        /**
         * Mints an embed token; needs tenantId and allowedOrigin (one origin: {@code https://host[:port]}, or
         * {@code http://localhost} / {@code http://127.0.0.1} with an optional port; no path, no wildcard),
         * optional endUserId (1 to 128 characters of {@code A-Z a-z 0-9 . _ @ -}) and ttlSeconds (60 to 900,
         * default 900). Needs an API key or client credentials: an embed token cannot mint. Resolves with
         * {@code EmbedToken}.
         */
        MINT_TOKEN = "MINT_TOKEN",
    }

    /**
     * <b>Builder</b> collects the call parameters for a {@link MnemoEmbedClient} and passes itself to the client
     * implementation in {@link build}.
     */
    export class Builder extends MnemoClientBuilder {
        /** @internal */ _operation?: Operation = Operation.MINT_TOKEN;
        /** @internal */ _endUserId?: string;
        /** @internal */ _allowedOrigin?: string;
        /** @internal */ _ttlSeconds?: number;

        operation(operation: Operation): this {
            this._operation = operation;
            return this;
        }

        /** Ties the token to one visitor: the same id always gets the same session prefix, so history survives a refresh. */
        endUserId(endUserId: string | null | undefined): this {
            this._endUserId = endUserId ?? undefined;
            return this;
        }

        /** The one origin the token may be used from, e.g. {@code https://app.example.com}. */
        allowedOrigin(allowedOrigin: string): this {
            this._allowedOrigin = allowedOrigin;
            return this;
        }

        /** How long the token lives, 60 to 900 seconds (default 900). */
        ttlSeconds(ttlSeconds: number): this {
            this._ttlSeconds = ttlSeconds;
            return this;
        }

        build(): MnemoEmbedClient {
            return new MnemoEmbedClientImpl(this);
        }

        /**
         * A new builder with the same settings, for one call that differs in a parameter (the end user id). The copy
         * shares the OAuth token cache, so client credentials are still exchanged once.
         *
         * @internal
         */
        copy(): Builder {
            return Object.assign(new Builder(), this);
        }
    }
}
