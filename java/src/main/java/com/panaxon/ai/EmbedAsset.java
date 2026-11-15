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

import java.io.IOException;
import java.io.InputStream;

/**
 * The {@code <mnemo-chat>} web component, bundled in this jar as the classpath resource {@code /embed/mnemo-chat.js}
 * (the same file as the npm package's {@code embed/mnemo-chat.js}; a test checks the hashes match). Serve it from your own
 * server instead of a CDN when you prefer: return {@link #bundledScript()} with content type
 * {@code text/javascript} and point {@link EmbedSnippet.Options#scriptUrl(String)} at that URL.
 *
 * @author edward.suryadi
 * @since 1.2
 */
public final class EmbedAsset {
    /** Classpath location of the bundled script. */
    public static final String RESOURCE = "/embed/mnemo-chat.js";

    private EmbedAsset() {
    }

    /** The bytes of {@code mnemo-chat.js}. @throws IllegalStateException if the jar does not contain it */
    public static byte[] bundledScript() {
        try (InputStream in = EmbedAsset.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("mnemo-chat.js is missing from this jar");
            }
            return in.readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException("could not read mnemo-chat.js", e);
        }
    }
}
