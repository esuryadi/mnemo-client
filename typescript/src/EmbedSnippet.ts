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
 * Since: Nov-2026
 */

import { invalid, isBlank } from "./AbstractMnemoClient.js";
import { CLIENT_VERSION } from "./version.js";

/**
 * <b>EmbedSnippet</b> renders the two lines of HTML that put a {@code <mnemo-chat>} on a page: the script tag
 * that loads the component and the element itself. Every value is HTML-escaped, so it is safe to build the
 * options from configuration or from the request. Pure string work: no framework, no network.
 *
 * @example
 * const html = EmbedSnippet.render({ tokenUrl: "/mnemo/embed-token", width: 400, height: "60vh" });
 */
export class EmbedSnippet {
    private constructor() {}

    /** The jsDelivr URL of the component in this exact version of the package. */
    static defaultScriptUrl(): string {
        return `https://cdn.jsdelivr.net/npm/@panaxon/mnemo-client@${CLIENT_VERSION}/embed/mnemo-chat.js`;
    }

    /** Returns the {@code <script>} and {@code <mnemo-chat>} HTML; {@code tokenUrl} is required. */
    static render(options: EmbedSnippet.Options): string {
        if (options == null) {
            throw invalid("options is required");
        }
        if (isBlank(options.tokenUrl)) {
            throw invalid("tokenUrl is required");
        }
        const scriptUrl = isBlank(options.scriptUrl) ? EmbedSnippet.defaultScriptUrl() : options.scriptUrl!;
        const attributes: [string, string | number | null | undefined][] = [
            ["token-url", options.tokenUrl],
            ["base-url", options.baseUrl],
            ["width", options.width],
            ["height", options.height],
            ["theme", options.theme],
            ["placeholder", options.placeholder],
            ["session-id", options.sessionId],
            ["locale", options.locale],
        ];
        let html = `<script src="${escapeHtml(scriptUrl)}" async></script>\n<mnemo-chat`;
        for (const [name, value] of attributes) {
            if (value != null) {
                html += ` ${name}="${escapeHtml(String(value))}"`;
            }
        }
        return html + "></mnemo-chat>";
    }
}

export namespace EmbedSnippet {
    export interface Options {
        /** Where the page fetches its embed token: your own endpoint (see {@code EmbedTokenEndpoint}). Required. */
        tokenUrl: string;
        /** The component script; by default the jsDelivr URL of this package version. */
        scriptUrl?: string;
        /** The MNEMO service endpoint, when it is not the public one. */
        baseUrl?: string;
        /** A bare number is pixels; or any CSS length such as {@code "50%"} or {@code "40vh"}. */
        width?: number | string;
        /** A bare number is pixels; or any CSS length. */
        height?: number | string;
        /** {@code light}, {@code dark} or {@code auto}. */
        theme?: string;
        placeholder?: string;
        /** Stable name for the visitor's chat session, appended to the token's session prefix. */
        sessionId?: string;
        /** A language tag such as {@code es} or {@code fr-CA}; picks the language of the component's own text. */
        locale?: string;
    }
}

/** Escapes the five characters that matter in HTML text and in a double- or single-quoted attribute. */
function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (c) => (
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"));
}
