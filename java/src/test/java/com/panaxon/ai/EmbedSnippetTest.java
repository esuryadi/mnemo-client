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
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class EmbedSnippetTest {

    @Test
    void rendersTheScriptAndTheElementWithTheDefaultScriptUrlOfThisVersion() throws Exception {
        String html = EmbedSnippet.render(new EmbedSnippet.Options("/mnemo/embed-token"));
        assertEquals("<script src=\"https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@" + MnemoClientVersion.VERSION
                + "/embed/mnemo-chat.js\" async></script>\n<mnemo-chat token-url=\"/mnemo/embed-token\"></mnemo-chat>", html);
    }

    @Test
    void theVersionConstantMatchesThePom() throws Exception {
        Matcher m = Pattern.compile("<artifactId>mnemo-client</artifactId>\\s*<version>([^<]+)</version>")
                .matcher(Files.readString(Path.of("pom.xml")));
        assertTrue(m.find());
        assertEquals(m.group(1), MnemoClientVersion.VERSION);
    }

    @Test
    void rendersEveryOptionInOrder() throws Exception {
        String html = EmbedSnippet.render(new EmbedSnippet.Options("/t").scriptUrl("/static/mnemo-chat.js")
                .baseUrl("https://mnemo.example.com/api").width("50%").height("600").theme("dark")
                .placeholder("Ask me").sessionId("embed-anon-1").locale("fr"));
        assertEquals("<script src=\"/static/mnemo-chat.js\" async></script>\n<mnemo-chat token-url=\"/t\" "
                + "base-url=\"https://mnemo.example.com/api\" width=\"50%\" height=\"600\" theme=\"dark\" "
                + "placeholder=\"Ask me\" session-id=\"embed-anon-1\" locale=\"fr\"></mnemo-chat>", html);
    }

    @Test
    void escapesEveryAttributeValue() throws Exception {
        String evil = "\"><script>alert('x')</script>&";
        String html = EmbedSnippet.render(new EmbedSnippet.Options(evil).scriptUrl(evil).baseUrl(evil).width(evil)
                .height(evil).theme(evil).placeholder(evil).sessionId(evil).locale(evil));
        String escaped = "&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;";
        assertFalse(html.contains("<script>alert"));
        assertEquals(4, html.chars().filter(c -> c == '<').count()); // only the two elements' own tags
        assertEquals(9, html.split(Pattern.quote(escaped), -1).length - 1);
        // the markup around the values is still exactly the two elements
        assertTrue(html.startsWith("<script src=\"" + escaped + "\" async></script>\n<mnemo-chat token-url=\""));
        assertTrue(html.endsWith("></mnemo-chat>"));
    }

    @Test
    void theTokenUrlIsRequired() {
        MnemoClientException e = assertThrows(MnemoClientException.class, () -> EmbedSnippet.render(new EmbedSnippet.Options(" ")));
        assertEquals(MnemoError.Code.INVALID_REQUEST, e.getError().code());
        assertTrue(e.getMessage().contains("tokenUrl"));
        assertThrows(MnemoClientException.class, () -> EmbedSnippet.render(null));
    }
}
