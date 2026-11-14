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

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Renders the two lines of HTML that put a {@code <mnemo-chat>} on a page: the component script and the element.
 * Every attribute value is HTML-escaped, so a value that came from a request or a configuration file cannot break
 * out of its attribute. No framework is needed; put the returned string in any template without escaping it again.
 *
 * <pre>{@code
 * String html = EmbedSnippet.render(new EmbedSnippet.Options("/mnemo/embed-token").height("600").width("50%"));
 * }</pre>
 *
 * @author edward.suryadi
 * @since 1.2
 */
public final class EmbedSnippet {
    private EmbedSnippet() {
    }

    /** The jsDelivr URL of the component script of this exact client version. */
    public static String defaultScriptUrl() {
        return "https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@" + MnemoClientVersion.VERSION + "/embed/mnemo-chat.js";
    }

    /**
     * The snippet options. {@code tokenUrl} (the page's own endpoint that returns the embed token, see
     * {@link EmbedTokenEndpoint}) is required; everything else is optional and omitted when {@code null}.
     */
    public static final class Options {
        private final String tokenUrl;
        private String scriptUrl;
        private String baseUrl;
        private String width;
        private String height;
        private String theme;
        private String placeholder;
        private String sessionId;
        private String locale;

        public Options(String tokenUrl) {
            this.tokenUrl = tokenUrl;
        }

        /** Where the component script is loaded from; defaults to {@link EmbedSnippet#defaultScriptUrl()}. */
        public Options scriptUrl(String scriptUrl) {
            this.scriptUrl = scriptUrl;
            return this;
        }

        /** The MNEMO endpoint the component calls, when it is not the public one. */
        public Options baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        /** A bare number means pixels (the component reads it); anything else is a CSS length such as {@code 50%}. */
        public Options width(String width) {
            this.width = width;
            return this;
        }

        /** A bare number means pixels; anything else is a CSS length such as {@code 40vh}. */
        public Options height(String height) {
            this.height = height;
            return this;
        }

        /** {@code light}, {@code dark} or {@code auto}. */
        public Options theme(String theme) {
            this.theme = theme;
            return this;
        }

        public Options placeholder(String placeholder) {
            this.placeholder = placeholder;
            return this;
        }

        public Options sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        public Options locale(String locale) {
            this.locale = locale;
            return this;
        }
    }

    /**
     * Returns {@code <script src="..." async></script>} followed by {@code <mnemo-chat ...></mnemo-chat>}.
     *
     * @throws MnemoClientException {@code INVALID_REQUEST} when {@code options} or its token URL is missing
     */
    public static String render(Options options) throws MnemoClientException {
        if (options == null) {
            throw AbstractMnemoClient.invalid("options is required");
        }
        String tokenUrl = AbstractMnemoClient.require(options.tokenUrl, "tokenUrl");
        String scriptUrl = AbstractMnemoClient.isBlank(options.scriptUrl) ? defaultScriptUrl() : options.scriptUrl;
        Map<String, String> attributes = new LinkedHashMap<>();
        attributes.put("token-url", tokenUrl);
        attributes.put("base-url", options.baseUrl);
        attributes.put("width", options.width);
        attributes.put("height", options.height);
        attributes.put("theme", options.theme);
        attributes.put("placeholder", options.placeholder);
        attributes.put("session-id", options.sessionId);
        attributes.put("locale", options.locale);
        StringBuilder html = new StringBuilder("<script src=\"").append(escape(scriptUrl)).append("\" async></script>\n")
                .append("<mnemo-chat");
        attributes.forEach((name, value) -> {
            if (value != null) {
                html.append(' ').append(name).append("=\"").append(escape(value)).append('"');
            }
        });
        return html.append("></mnemo-chat>").toString();
    }

    /** Escapes the five characters that matter inside a double-quoted HTML attribute (and in text). */
    static String escape(String value) {
        StringBuilder out = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}
