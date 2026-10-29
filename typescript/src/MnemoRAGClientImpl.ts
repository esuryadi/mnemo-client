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

import { AbstractMnemoClient, body, invalid, path, require } from "./AbstractMnemoClient.js";
import { MnemoRAGClient } from "./MnemoRAGClient.js";
import type { RagQueryResponse } from "./model/index.js";

/**
 * <b>MnemoRAGClientImpl</b> implements {@link MnemoRAGClient}: one private method per operation.
 *
 * @internal
 */
export class MnemoRAGClientImpl extends AbstractMnemoClient implements MnemoRAGClient {
    private readonly builder: MnemoRAGClient.Builder;

    constructor(builder: MnemoRAGClient.Builder) {
        super(builder);
        this.builder = builder;
    }

    /** Dispatches to the method that implements the operation chosen on the builder. */
    async execute<T = unknown>(): Promise<T> {
        const operation = this.builder._operation;
        if (operation == null) {
            throw invalid("operation is required");
        }
        const Op = MnemoRAGClient.Operation;
        return this.withTarget(async (base): Promise<unknown> => {
            switch (operation) {
                case Op.QUERY: return this.query(base);
                default: throw invalid(`unknown operation ${String(operation)}`);
            }
        }) as Promise<T>;
    }

    private query(base: string): Promise<RagQueryResponse> {
        return this.send("POST", path(base, "mnemo/rag/{ragId}", { ragId: require(this.builder._ragId, "ragId") }),
            body({ query: require(this.builder._query, "query"), additionalContext: this.builder._additionalContext }));
    }
}
