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

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The bundled component is the TypeScript build output, byte for byte. */
class EmbedAssetTest {

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    @Test
    void theBundledScriptIsTheTypeScriptBuildOutput() throws Exception {
        byte[] bundled = EmbedAsset.bundledScript();
        assertTrue(bundled.length > 1000);
        Path source = Path.of("..", "typescript", "embed", "mnemo-chat.js");
        assertEquals(sha256(Files.readAllBytes(source)), sha256(bundled), "run: cp typescript/embed/mnemo-chat.js java/src/main/resources/embed/");
    }

    @Test
    void itIsABrowserScript_notAModule() {
        String text = new String(EmbedAsset.bundledScript(), java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(text.contains("mnemo-chat"));
        assertTrue(!text.startsWith("export ") && !text.contains("\nexport "));
    }
}
