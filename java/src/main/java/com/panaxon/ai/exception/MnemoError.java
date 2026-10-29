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

package com.panaxon.ai.exception;

public record MnemoError(Code code, String message, String... args) {
    public enum Code {
        UNDEFINED_ERROR("MNERR-0000", "Undefined error"),
        INVALID_REQUEST("MNERR-0001", "Invalid request"),
        MISSING_API_KEY("MNERR-0002", "API key is required"),
        UNAUTHORIZED("MNERR-0401", "Missing or invalid API key"),
        FORBIDDEN("MNERR-0403", "Access denied or plan does not include this feature"),
        NOT_FOUND("MNERR-0404", "Resource not found"),
        RATE_LIMITED("MNERR-0429", "Rate limit or quota exceeded"),
        SERVER_ERROR("MNERR-0500", "MNEMO server error"),
        IO_ERROR("MNERR-0600", "Unable to reach the MNEMO service"),
        SERIALIZATION_ERROR("MNERR-0601", "Unable to read the MNEMO response"),
        INIT_FAILED("MNERR-0700", "Session initialization failed");

        private String code;
        private String defaultMessage;

        Code(String code, String defaultMessage) {
            this.code = code;
            this.defaultMessage = defaultMessage;
        }

        public String getCode() {
            return code;
        }

        public String getDefaultMessage() {
            return defaultMessage;
        }
    }

    public String message() {
        if (message == null) {
            return code.getDefaultMessage();
        }
        if (args != null && args.length > 0) {
            return String.format(message, (Object[]) args);
        }
        return message;
    }
}
