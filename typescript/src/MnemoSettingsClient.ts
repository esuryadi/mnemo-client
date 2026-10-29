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
import { MnemoClientBuilder } from "./MnemoClientBuilder.js";
import { MnemoSettingsClientImpl } from "./MnemoSettingsClientImpl.js";

/**
 * <b>MnemoSettingsClient</b> reads and updates an account's MNEMO settings.
 *
 * @example
 * const updated = await new MnemoSettingsClient.Builder()
 *     .apiKey(process.env.MNEMO_API_KEY!)
 *     .accountId("acct-123")
 *     .operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
 *     .lookbackDays(30)
 *     .encryptData(true)
 *     .build().execute<SettingsResponse>();
 *
 * Only the settings you set on the builder are changed; the rest are left as they are.
 */
export interface MnemoSettingsClient extends MnemoClient {}

export namespace MnemoSettingsClient {
    /** The settings calls, with the type {@code execute()} resolves with. */
    export enum Operation {
        /** Reads an account's settings; needs accountId. Resolves with {@code SettingsResponse}. */
        GET_SETTINGS = "GET_SETTINGS",
        /** Updates the settings that were set on the builder; needs accountId. Resolves with {@code SettingsResponse}. */
        UPDATE_SETTINGS = "UPDATE_SETTINGS",
        /** The providers and models that can be chosen. Resolves with {@code JsonObject}. */
        GET_OPTIONS = "GET_OPTIONS",
    }

    /** <b>Builder</b> collects the call parameters for a {@link MnemoSettingsClient}. */
    export class Builder extends MnemoClientBuilder {
        /** @internal */ _operation?: Operation = Operation.GET_SETTINGS;
        /** @internal */ _accountId?: string;
        /** @internal */ _provider?: string;
        /** @internal */ _model?: string;
        /** @internal */ _ingestModel?: string;
        /** @internal */ _providerApiKey?: string;
        /** @internal */ _lookbackDays?: number;
        /** @internal */ _encryptData?: boolean;
        /** @internal */ _sharedMemoryTtlHours?: number;

        operation(operation: Operation): this {
            this._operation = operation;
            return this;
        }

        accountId(accountId: string): this {
            this._accountId = accountId;
            return this;
        }

        /** The LLM provider to use for chat and ingest. */
        provider(provider: string): this {
            this._provider = provider;
            return this;
        }

        model(model: string): this {
            this._model = model;
            return this;
        }

        ingestModel(ingestModel: string): this {
            this._ingestModel = ingestModel;
            return this;
        }

        /** Your own LLM provider key (bring-your-own-key); distinct from {@code apiKey()}, which authenticates to MNEMO. */
        providerApiKey(providerApiKey: string): this {
            this._providerApiKey = providerApiKey;
            return this;
        }

        lookbackDays(lookbackDays: number): this {
            this._lookbackDays = lookbackDays;
            return this;
        }

        encryptData(encryptData: boolean): this {
            this._encryptData = encryptData;
            return this;
        }

        sharedMemoryTtlHours(sharedMemoryTtlHours: number): this {
            this._sharedMemoryTtlHours = sharedMemoryTtlHours;
            return this;
        }

        build(): MnemoSettingsClient {
            return new MnemoSettingsClientImpl(this);
        }
    }
}
