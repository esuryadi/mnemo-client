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

import { MnemoError } from "./MnemoError.js";

/**
 * <b>MnemoClientException</b> is the error every client rejects with. It carries the structured
 * {@link MnemoError} and, when the failure came from the MNEMO service, the HTTP status
 * ({@code 0} when no response was received).
 */
export class MnemoClientException extends Error {
    readonly error: MnemoError;
    readonly httpStatus: number;

    constructor(error: MnemoError, httpStatus = 0, options?: { cause?: unknown }) {
        super(error.message, options);
        this.name = "MnemoClientException";
        this.error = error;
        this.httpStatus = httpStatus;
    }
}
