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

import { AbstractMnemoClient, body, invalid, isBlank, path, require } from "./AbstractMnemoClient.js";
import { MnemoClientException } from "./exception/MnemoClientException.js";
import { MnemoError } from "./exception/MnemoError.js";
import { MnemoEmbedClient } from "./MnemoEmbedClient.js";
import type { EmbedToken } from "./model/index.js";

/** One origin: https://host[:port], or http://localhost or http://127.0.0.1 with an optional port. */
const ORIGIN = /^(https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|http:\/\/(localhost|127\.0\.0\.1))(:[0-9]{1,5})?$/;
const END_USER_ID = /^[A-Za-z0-9._@-]{1,128}$/;

/**
 * <b>MnemoEmbedClientImpl</b> implements {@link MnemoEmbedClient}: one private method per operation.
 *
 * @internal
 */
export class MnemoEmbedClientImpl extends AbstractMnemoClient implements MnemoEmbedClient {
    private readonly builder: MnemoEmbedClient.Builder;

    constructor(builder: MnemoEmbedClient.Builder) {
        super(builder);
        this.builder = builder;
    }

    /** Dispatches to the method that implements the operation chosen on the builder. */
    async execute<T = unknown>(): Promise<T> {
        const operation = this.builder._operation;
        if (operation == null) {
            throw invalid("operation is required");
        }
        const Op = MnemoEmbedClient.Operation;
        return this.withTarget(async (base): Promise<unknown> => {
            switch (operation) {
                case Op.MINT_TOKEN: return this.mintToken(base);
                default: throw invalid(`unknown operation ${String(operation)}`);
            }
        }) as Promise<T>;
    }

    private async mintToken(base: string): Promise<EmbedToken> {
        const b = this.builder;
        if (!isBlank(b._embedToken)) {
            throw invalid("an embed token cannot mint tokens; use apiKey or clientCredentials");
        }
        const tenantId = require(this.tenantId(), "tenantId");
        const origin = require(b._allowedOrigin, "allowedOrigin");
        if (!ORIGIN.test(origin)) {
            throw invalid("allowedOrigin must be one origin, https://host[:port] "
                + "(http only for localhost and 127.0.0.1), with no path and no wildcard");
        }
        if (b._endUserId != null && !END_USER_ID.test(b._endUserId)) {
            throw invalid("endUserId must be 1 to 128 characters of A-Z a-z 0-9 . _ @ -");
        }
        const ttl = b._ttlSeconds;
        if (ttl != null && (!Number.isInteger(ttl) || ttl < 60 || ttl > 900)) {
            throw invalid("ttlSeconds must be a whole number between 60 and 900");
        }
        const reply = await this.send<Partial<EmbedToken> | null>("POST", path(base, "mnemo/embed/token"),
            body({ tenantId, allowedOrigin: origin, endUserId: b._endUserId, ttlSeconds: ttl }));
        if (typeof reply?.token !== "string" || typeof reply.expiresAt !== "string"
            || typeof reply.sessionPrefix !== "string") {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.SERIALIZATION_ERROR));
        }
        return { ...reply, token: reply.token, expiresAt: reply.expiresAt, sessionPrefix: reply.sessionPrefix,
            tenantId: typeof reply.tenantId === "string" ? reply.tenantId : tenantId };
    }
}
