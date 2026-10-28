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

import com.panaxon.ai.exception.MnemoClientException;
import com.panaxon.ai.exception.MnemoError;

public class MnemoClientFactory {

    /**
     * Creates a new instance of MnemoClient using the provided MnemoClientBuilder.
     *
     * @param builder The MnemoClientBuilder used to configure and build the MnemoClient.
     * @return A new instance of MnemoClient.
     * @throws MnemoClientException If the builder is null or if there is an error during client creation.
     */
    static public MnemoClient create(MnemoClientBuilder<?> builder) throws MnemoClientException {
        if (builder == null) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.UNDEFINED_ERROR, "MnemoClientBuilder cannot be null"));
        }
        return builder.build();
    }

}
