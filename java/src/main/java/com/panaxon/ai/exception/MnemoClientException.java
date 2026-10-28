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

/**
 * <b>MnemoClientException</b> is a custom exception class that represents errors specific to the MNEMO client operations.
 * It extends the standard {@link Exception} class and provides constructors for creating exceptions with messages
 * and causes.
 *
 * @author edward.suryadi
 * @since 1.0
 */
public class MnemoClientException extends Exception {
    public MnemoClientException(MnemoError error) {
        super(error.message());
    }

    public MnemoClientException(MnemoError error, Throwable cause) {
        super(error.message(), cause);
    }

    public MnemoClientException(Throwable cause) {
        super(cause);
    }
}
