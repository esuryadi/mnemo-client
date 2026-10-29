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

/**
 * A structured client error: a {@link MnemoError.Code} and the message to show. When no message is given,
 * the code's default message is used.
 */
export class MnemoError {
    readonly code: MnemoError.Code;
    readonly message: string;

    constructor(code: MnemoError.Code, message?: string | null) {
        this.code = code;
        this.message = message ?? MnemoError.defaultMessage(code);
    }
}

export namespace MnemoError {
    /** The error codes; each value is the stable {@code MNERR-xxxx} identifier. */
    export enum Code {
        UNDEFINED_ERROR = "MNERR-0000",
        INVALID_REQUEST = "MNERR-0001",
        MISSING_API_KEY = "MNERR-0002",
        UNAUTHORIZED = "MNERR-0401",
        FORBIDDEN = "MNERR-0403",
        NOT_FOUND = "MNERR-0404",
        RATE_LIMITED = "MNERR-0429",
        SERVER_ERROR = "MNERR-0500",
        IO_ERROR = "MNERR-0600",
        SERIALIZATION_ERROR = "MNERR-0601",
        INIT_FAILED = "MNERR-0700",
    }

    const DEFAULT_MESSAGES: Record<Code, string> = {
        [Code.UNDEFINED_ERROR]: "Undefined error",
        [Code.INVALID_REQUEST]: "Invalid request",
        [Code.MISSING_API_KEY]: "API key is required",
        [Code.UNAUTHORIZED]: "Missing or invalid API key",
        [Code.FORBIDDEN]: "Access denied or plan does not include this feature",
        [Code.NOT_FOUND]: "Resource not found",
        [Code.RATE_LIMITED]: "Rate limit or quota exceeded",
        [Code.SERVER_ERROR]: "MNEMO server error",
        [Code.IO_ERROR]: "Unable to reach the MNEMO service",
        [Code.SERIALIZATION_ERROR]: "Unable to read the MNEMO response",
        [Code.INIT_FAILED]: "Session initialization failed",
    };

    /** @returns the message used when an error of this code carries none of its own */
    export function defaultMessage(code: Code): string {
        return DEFAULT_MESSAGES[code];
    }
}
