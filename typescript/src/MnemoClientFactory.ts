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

import { MnemoClientException } from "./exception/MnemoClientException.js";
import { MnemoError } from "./exception/MnemoError.js";
import type { MnemoClient } from "./MnemoClient.js";
import type { MnemoClientBuilder } from "./MnemoClientBuilder.js";

export class MnemoClientFactory {
    /**
     * Creates a new MnemoClient from the given builder.
     *
     * @throws MnemoClientException if the builder is null or undefined
     */
    static create(builder: MnemoClientBuilder | null | undefined): MnemoClient {
        if (builder == null) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.UNDEFINED_ERROR,
                "MnemoClientBuilder cannot be null"));
        }
        return builder.build();
    }
}
