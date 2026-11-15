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

/*
 * A small, safe Markdown renderer for chat answers. An answer is untrusted text, so this never builds HTML from
 * it: every node is made with createElement / createTextNode, which cannot carry markup, and raw HTML in the
 * answer is just text. Links are kept only for http, https and mailto addresses.
 *
 * Supported: paragraphs, line breaks, headings (# to ######), bold, italic, inline code, fenced code blocks,
 * bulleted and numbered lists, block quotes, horizontal rules and [text](url) links.
 */

/** Answers longer than this are shown as plain paragraphs, which keeps a hostile input from costing much. */
const MAX_MARKDOWN_LENGTH = 100_000;
const MAX_INLINE_DEPTH = 4;
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Returns the URL when it is an absolute http, https or mailto address, else {@code null}. */
export function safeHref(href: string): string | null {
    const trimmed = href.trim();
    if (trimmed.length === 0 || /[\u0000-\u001f\u007f\s]/.test(trimmed)) {
        return null;
    }
    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return null;
    }
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
}

/** Renders {@code text} into a fragment owned by {@code doc}. */
export function renderMarkdown(text: string, doc: Document): DocumentFragment {
    const fragment = doc.createDocumentFragment();
    if (text.length > MAX_MARKDOWN_LENGTH) {
        for (const paragraph of text.split(/\n{2,}/)) {
            const p = doc.createElement("p");
            p.textContent = paragraph;
            fragment.appendChild(p);
        }
        return fragment;
    }
    blocks(text.replace(/\r\n?/g, "\n").split("\n"), doc, fragment);
    return fragment;
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

function blocks(lines: string[], doc: Document, parent: Node, depth = 0): void {
    let i = 0;
    while (i < lines.length) {
        const line = lines[i]!;
        if (line.trim().length === 0) {
            i++;
            continue;
        }
        const fence = FENCE.exec(line);
        if (fence) {
            const marker = fence[1]!;
            const code: string[] = [];
            i++;
            while (i < lines.length && !lines[i]!.trim().startsWith(marker)) {
                code.push(lines[i]!);
                i++;
            }
            i++; // the closing fence, or the end of the text
            const pre = doc.createElement("pre");
            const inner = doc.createElement("code");
            inner.textContent = code.join("\n");
            pre.appendChild(inner);
            parent.appendChild(pre);
            continue;
        }
        const heading = HEADING.exec(line);
        if (heading) {
            const h = doc.createElement("h" + Math.min(heading[1]!.length + 2, 6));
            inline(heading[2]!, doc, h, 0);
            parent.appendChild(h);
            i++;
            continue;
        }
        if (RULE.test(line)) {
            parent.appendChild(doc.createElement("hr"));
            i++;
            continue;
        }
        if (QUOTE.test(line) && depth < MAX_INLINE_DEPTH) {
            const inner: string[] = [];
            while (i < lines.length && QUOTE.test(lines[i]!)) {
                inner.push(QUOTE.exec(lines[i]!)![1]!);
                i++;
            }
            const quote = doc.createElement("blockquote");
            blocks(inner, doc, quote, depth + 1);
            parent.appendChild(quote);
            continue;
        }
        const listPattern = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
        if (listPattern) {
            const list = doc.createElement(listPattern === BULLET ? "ul" : "ol");
            while (i < lines.length && listPattern.test(lines[i]!)) {
                const item = doc.createElement("li");
                inline(listPattern.exec(lines[i]!)![1]!, doc, item, 0);
                list.appendChild(item);
                i++;
            }
            parent.appendChild(list);
            continue;
        }
        // a paragraph runs to the next blank line or the start of another block
        const paragraph: string[] = [];
        while (i < lines.length && lines[i]!.trim().length > 0 && (paragraph.length === 0 || !startsBlock(lines[i]!))) {
            paragraph.push(lines[i]!);
            i++;
        }
        const p = doc.createElement("p");
        paragraph.forEach((text, n) => {
            if (n > 0) {
                p.appendChild(doc.createElement("br"));
            }
            inline(text.trim(), doc, p, 0);
        });
        parent.appendChild(p);
    }
}

function startsBlock(line: string): boolean {
    return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line)
        || BULLET.test(line) || NUMBERED.test(line);
}

/** Code spans, links, bold and italic (with asterisks only, so snake_case and __init__ stay as written); the earliest match wins. */
const INLINE = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)|\[([^\]\n]*)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:\s+"[^"\n]*")?\)|\*\*([^\n]+?)\*\*|\*([^*\s](?:[^*\n]*[^*\s])?)\*/g;

function inline(text: string, doc: Document, parent: Node, depth: number): void {
    if (depth >= MAX_INLINE_DEPTH) {
        parent.appendChild(doc.createTextNode(text));
        return;
    }
    const pattern = new RegExp(INLINE.source, "g");
    let last = 0;
    for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
        if (m.index > last) {
            parent.appendChild(doc.createTextNode(text.substring(last, m.index)));
        }
        last = m.index + m[0].length;
        if (m[2] !== undefined) {
            const code = doc.createElement("code");
            code.textContent = m[2].trim();
            parent.appendChild(code);
        } else if (m[3] !== undefined) {
            const href = safeHref(m[4]!);
            if (href === null) {
                inline(m[3], doc, parent, depth + 1);
            } else {
                const a = doc.createElement("a");
                a.setAttribute("href", href);
                a.setAttribute("rel", "noopener noreferrer");
                a.setAttribute("target", "_blank");
                inline(m[3], doc, a, depth + 1);
                parent.appendChild(a);
            }
        } else {
            const node = doc.createElement(m[5] !== undefined ? "strong" : "em");
            inline((m[5] ?? m[6])!, doc, node, depth + 1);
            parent.appendChild(node);
        }
    }
    if (last < text.length) {
        parent.appendChild(doc.createTextNode(text.substring(last)));
    }
}
