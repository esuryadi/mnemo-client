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
 * <b>MnemoRAGClient</b> is an interface that defines the contract for a Retrieval-Augmented Generation
 * (RAG) client within the MNEMO system. Implementations of this interface should provide methods for
 * integrating retrieval mechanisms with generative models, enabling enhanced information retrieval and
 * generation capabilities.
 *
 * @author edward.suryadi
 * @since 1.0
 */
public interface MnemoRAGClient extends MnemoClient {

    /**
     * <b>Builder</b> is a static inner class that extends {@link MnemoClientBuilder} to provide a fluent interface
     * for constructing instances of {@link MnemoRAGClient}. Implementations of this builder should override
     * the {@link #build()} method to return a concrete instance of {@link MnemoRAGClient}.
     */
    static class Builder extends MnemoClientBuilder {
        @Override
        public MnemoClient build() {
            return null;
        }
    }
}
