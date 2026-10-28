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
 * <b>MnemoClientBuilder</b> is an abstract builder class for constructing instances of {@link MnemoClient}.
 * It provides a fluent interface for setting the API key required for client authentication.
 * Subclasses should implement the {@code build()} method to create specific types of MNEMO clients.
 *
 * @author edward.suryadi
 * @since 1.0
 */
public abstract class MnemoClientBuilder {
    private String apiKey;

    public MnemoClientBuilder apiKey(String apiKey) {
        this.apiKey = apiKey;
        return this;
    }

    abstract public MnemoClient build();
}
