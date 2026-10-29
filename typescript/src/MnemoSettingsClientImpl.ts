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
import { MnemoSettingsClient } from "./MnemoSettingsClient.js";
import type { JsonObject, SettingsResponse } from "./model/index.js";

/**
 * <b>MnemoSettingsClientImpl</b> implements {@link MnemoSettingsClient}: one private method per operation.
 *
 * @internal
 */
export class MnemoSettingsClientImpl extends AbstractMnemoClient implements MnemoSettingsClient {
    private readonly builder: MnemoSettingsClient.Builder;

    constructor(builder: MnemoSettingsClient.Builder) {
        super(builder);
        this.builder = builder;
    }

    /** Dispatches to the method that implements the operation chosen on the builder. */
    async execute<T = unknown>(): Promise<T> {
        const operation = this.builder._operation;
        if (operation == null) {
            throw invalid("operation is required");
        }
        const Op = MnemoSettingsClient.Operation;
        return this.withTarget(async (base): Promise<unknown> => {
            switch (operation) {
                case Op.GET_SETTINGS: return this.getSettings(base);
                case Op.UPDATE_SETTINGS: return this.updateSettings(base);
                case Op.GET_OPTIONS: return this.getOptions(base);
                default: throw invalid(`unknown operation ${String(operation)}`);
            }
        }) as Promise<T>;
    }

    private getSettings(base: string): Promise<SettingsResponse> {
        return this.send("GET", path(base, "mnemo/account/{id}/settings",
            { id: require(this.builder._accountId, "accountId") }));
    }

    private updateSettings(base: string): Promise<SettingsResponse> {
        const b = this.builder;
        return this.send("PUT", path(base, "mnemo/account/{id}/settings", { id: require(b._accountId, "accountId") }),
            body({
                provider: b._provider, model: b._model, ingestModel: b._ingestModel, apiKey: b._providerApiKey,
                lookbackDays: b._lookbackDays, encryptData: b._encryptData,
                sharedMemoryTtlHours: b._sharedMemoryTtlHours,
            }));
    }

    private getOptions(base: string): Promise<JsonObject> {
        return this.send("GET", path(base, "mnemo/account/settings/options"));
    }
}
