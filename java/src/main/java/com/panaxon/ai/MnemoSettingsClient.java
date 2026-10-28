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

/**
 * <b>MnemoSettingsClient</b> is an interface that defines the contract for a settings client within the MNEMO system.
 * Implementations of this interface should provide methods for managing configuration settings, retrieving and updating
 * system parameters, and ensuring consistent application behavior.
 *
 * <h2>Example</h2>
 * <pre>{@code
 * SettingsResponse current = new MnemoSettingsClient.Builder()
 *         .apiKey(System.getenv("MNEMO_API_KEY"))
 *         .accountId("acct-123")
 *         .build().execute();
 *
 * SettingsResponse updated = new MnemoSettingsClient.Builder()
 *         .apiKey(System.getenv("MNEMO_API_KEY"))
 *         .accountId("acct-123")
 *         .operation(MnemoSettingsClient.Operation.UPDATE_SETTINGS)
 *         .lookbackDays(30)
 *         .encryptData(true)
 *         .build().execute();
 * }</pre>
 * Only the settings you set on the builder are changed; the rest are left as they are.
 *
 * @author edward.suryadi
 * @since 1.0
 */
public interface MnemoSettingsClient extends MnemoClient {

    /** The settings calls, with the type {@code execute()} returns. */
    enum Operation {
        /** Reads an account's settings; needs accountId. Returns {@link com.panaxon.ai.model.SettingsResponse}. */
        GET_SETTINGS,
        /** Updates the settings that were set on the builder; needs accountId. Returns {@link com.panaxon.ai.model.SettingsResponse}. */
        UPDATE_SETTINGS,
        /** The providers and models that can be chosen. Returns {@code Map<String, Object>}. */
        GET_OPTIONS
    }

    /**
     * <b>Builder</b> is a static inner class that extends {@link MnemoClientBuilder} to provide a fluent interface
     * for constructing instances of {@link MnemoSettingsClient}.
     */
    static class Builder extends MnemoClientBuilder<Builder> {
        private Operation operation = Operation.GET_SETTINGS;
        private String accountId;
        private String provider;
        private String model;
        private String ingestModel;
        private String providerApiKey;
        private Integer lookbackDays;
        private Boolean encryptData;
        private Integer sharedMemoryTtlHours;

        @Override
        protected Builder self() {
            return this;
        }

        public Builder operation(Operation operation) {
            this.operation = operation;
            return this;
        }

        public Builder accountId(String accountId) {
            this.accountId = accountId;
            return this;
        }

        /** The LLM provider to use for chat and ingest. */
        public Builder provider(String provider) {
            this.provider = provider;
            return this;
        }

        public Builder model(String model) {
            this.model = model;
            return this;
        }

        public Builder ingestModel(String ingestModel) {
            this.ingestModel = ingestModel;
            return this;
        }

        /** Your own LLM provider key (bring-your-own-key); distinct from {@link #apiKey(String)}, which authenticates to MNEMO. */
        public Builder providerApiKey(String providerApiKey) {
            this.providerApiKey = providerApiKey;
            return this;
        }

        public Builder lookbackDays(int lookbackDays) {
            this.lookbackDays = lookbackDays;
            return this;
        }

        public Builder encryptData(boolean encryptData) {
            this.encryptData = encryptData;
            return this;
        }

        public Builder sharedMemoryTtlHours(int sharedMemoryTtlHours) {
            this.sharedMemoryTtlHours = sharedMemoryTtlHours;
            return this;
        }

        Operation operation() { return operation; }
        String accountId() { return accountId; }
        String provider() { return provider; }
        String model() { return model; }
        String ingestModel() { return ingestModel; }
        String providerApiKey() { return providerApiKey; }
        Integer lookbackDays() { return lookbackDays; }
        Boolean encryptData() { return encryptData; }
        Integer sharedMemoryTtlHours() { return sharedMemoryTtlHours; }

        @Override
        public MnemoSettingsClient build() {
            return new MnemoSettingsClientImpl(this);
        }
    }
}
