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

import { invalid } from "./AbstractMnemoClient.js";
import { MnemoEmbedClient } from "./MnemoEmbedClient.js";
import type { EmbedToken } from "./model/index.js";

/**
 * <b>EmbedTokenEndpoint</b> is the framework-neutral body of the endpoint the page's {@code token-url} points to.
 * Your route authenticates the visitor with your own session, then calls {@link handle} with the visitor's id and
 * writes the string it returns as the JSON response ({@code Content-Type: application/json}). The string holds
 * exactly {@code token}, {@code expiresAt}, {@code tenantId} and {@code sessionPrefix}: never the API key, never anything else.
 *
 * @example
 * app.get("/mnemo/embed-token", async (req, res) => {
 *     res.type("application/json").send(await EmbedTokenEndpoint.handle(template, req.user.id));
 * });
 */
export class EmbedTokenEndpoint {
    private constructor() {}

    /**
     * Mints a token for {@code endUserId} (or an anonymous visitor when it is null or blank) and returns the JSON
     * the component expects. {@code template} is a configured {@link MnemoEmbedClient.Builder} (credential,
     * tenantId, allowedOrigin, optionally baseUrl and ttlSeconds), or a function that returns one; it is not
     * changed: each call works on a copy, which shares the OAuth token cache. Rejects with a
     * {@code MnemoClientException} when minting fails; map that to an HTTP error in your route.
     */
    static async handle(template: MnemoEmbedClient.Builder | (() => MnemoEmbedClient.Builder),
                        endUserId?: string | null): Promise<string> {
        const source = typeof template === "function" ? template() : template;
        if (source == null) {
            throw invalid("template is required");
        }
        const builder = source.copy().operation(MnemoEmbedClient.Operation.MINT_TOKEN);
        const user = endUserId == null || endUserId.trim().length === 0 ? null : endUserId;
        const token = await builder.endUserId(user).build().execute<EmbedToken>();
        return json({ token: token.token, expiresAt: token.expiresAt, tenantId: token.tenantId, sessionPrefix: token.sessionPrefix });
    }
}

/** JSON that is also safe inside an HTML page: {@code <}, {@code >}, {@code &} and the line separators are escaped. */
function json(value: Record<string, string>): string {
    return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,
        (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}
