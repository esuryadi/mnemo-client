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
// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { renderMarkdown, safeHref } from "../../src/embed/markdown.js";

function html(markdown: string): string {
    const holder = document.createElement("div");
    holder.appendChild(renderMarkdown(markdown, document));
    return holder.innerHTML;
}

function dom(markdown: string): HTMLElement {
    const holder = document.createElement("div");
    holder.appendChild(renderMarkdown(markdown, document));
    return holder;
}

const ALLOWED_TAGS = new Set(["P", "BR", "H3", "H4", "H5", "H6", "STRONG", "EM", "CODE", "PRE", "UL", "OL", "LI",
    "BLOCKQUOTE", "HR", "A"]);

/** Whatever the input, only these tags, no event handler attributes, and only safe links may come out. */
function assertSafe(markdown: string): void {
    const root = dom(markdown);
    for (const el of Array.from(root.querySelectorAll("*"))) {
        expect(ALLOWED_TAGS.has(el.tagName), `tag ${el.tagName} from ${JSON.stringify(markdown)}`).toBe(true);
        for (const attr of Array.from(el.attributes)) {
            if (el.tagName === "A") {
                expect(["href", "rel", "target"]).toContain(attr.name);
            } else {
                expect(attr.name, `attribute on ${el.tagName}`).toBe("__none__");
            }
        }
    }
    for (const a of Array.from(root.querySelectorAll("a"))) {
        expect(a.getAttribute("rel")).toBe("noopener noreferrer");
        expect(a.getAttribute("target")).toBe("_blank");
        expect(/^(https?:|mailto:)/.test(a.getAttribute("href")!)).toBe(true);
    }
}

describe("markdown rendering", () => {
    it("plain text is one paragraph", () => {
        expect(html("Hello there")).toBe("<p>Hello there</p>");
    });

    it("blank lines separate paragraphs and a single newline is a line break", () => {
        expect(html("one\ntwo\n\nthree")).toBe("<p>one<br>two</p><p>three</p>");
    });

    it("handles CRLF line endings", () => {
        expect(html("one\r\n\r\ntwo")).toBe("<p>one</p><p>two</p>");
    });

    it("bold, italic and inline code", () => {
        expect(html("a **b** and *c* and `d`")).toBe("<p>a <strong>b</strong> and <em>c</em> and <code>d</code></p>");
    });

    it("emphasis nests, and code is not formatted inside", () => {
        expect(html("**a *b* c**")).toBe("<p><strong>a <em>b</em> c</strong></p>");
        expect(html("`**not bold**`")).toBe("<p><code>**not bold**</code></p>");
    });

    it("snake_case and __init__ are left alone", () => {
        expect(html("call my_func_name and __init__ now")).toBe("<p>call my_func_name and __init__ now</p>");
    });

    it("a lone asterisk and unbalanced markers stay text", () => {
        expect(html("2 * 3 = 6 and **open")).toBe("<p>2 * 3 = 6 and **open</p>");
    });

    it("headings start at h3 so they do not outrank the page", () => {
        expect(html("# One\n## Two\n###### Six")).toBe("<h3>One</h3><h4>Two</h4><h6>Six</h6>");
    });

    it("bulleted and numbered lists", () => {
        expect(html("- a\n- **b**\n* c")).toBe("<ul><li>a</li><li><strong>b</strong></li><li>c</li></ul>");
        expect(html("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
    });

    it("fenced code keeps its text exactly, markup characters included", () => {
        expect(html("```js\nif (a < b && c) { **x** }\n```\nafter")).toBe(
            "<pre><code>if (a &lt; b &amp;&amp; c) { **x** }</code></pre><p>after</p>");
    });

    it("an unclosed fence runs to the end", () => {
        expect(html("```\ncode")).toBe("<pre><code>code</code></pre>");
    });

    it("block quotes and rules", () => {
        expect(html("> quoted\n> more\n\n---")).toBe("<blockquote><p>quoted<br>more</p></blockquote><hr>");
    });

    it("links are anchors that open in a new tab without an opener", () => {
        expect(html("[MNEMO](https://example.com/a?b=1&c=2)")).toBe(
            '<p><a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer" target="_blank">MNEMO</a></p>');
    });

    it("mailto and http links are allowed", () => {
        expect(html("[mail](mailto:a@b.example) [plain](http://example.com)")).toContain('href="mailto:a@b.example"');
        expect(html("[plain](http://example.com)")).toContain('href="http://example.com/"');
    });

    it("a link may contain emphasis, and a url may contain parentheses", () => {
        expect(html("[**bold** link](https://en.wikipedia.org/wiki/Foo_(bar))")).toContain(
            'href="https://en.wikipedia.org/wiki/Foo_(bar)"');
    });

    it("an empty answer renders nothing", () => {
        expect(html("")).toBe("");
        expect(html("\n\n  \n")).toBe("");
    });

    it("a very long answer is shown as plain paragraphs, not parsed", () => {
        const long = "**x** ".repeat(30_000);
        const root = dom(long);
        expect(root.querySelector("strong")).toBeNull();
        expect(root.textContent).toBe(long);
    });

    it("deeply nested emphasis and quotes do not blow up", () => {
        const nested = "> ".repeat(200) + "*".repeat(300) + "x" + "*".repeat(300);
        expect(() => html(nested)).not.toThrow();
        assertSafe(nested);
    });
});

describe("links are limited to http, https and mailto", () => {
    it.each([
        "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)",
        "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "file:///etc/passwd", "ftp://example.com",
        "blob:https://example.com/x", "//evil.example/x", "/relative/path", "relative", "#fragment", "?q=1", "",
        "https://", "\u0001https://example.com", "https://exa mple.com", "tel:+15551234567", "sms:1", "intent://x#Intent;end",
    ])("%j is refused", (href) => {
        expect(safeHref(href)).toBeNull();
        const out = html(`[click](${href})`);
        expect(out).not.toContain("<a");
        expect(out).toContain("click");
    });

    it.each(["https://example.com", "http://example.com/x?y#z", "mailto:a@b.example", "HTTPS://EXAMPLE.COM"])(
        "%j is kept", (href) => {
            expect(safeHref(href)).not.toBeNull();
        });
});

describe("untrusted text never becomes markup", () => {
    const attacks = [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        "<svg/onload=alert(1)>",
        "<iframe src=javascript:alert(1)></iframe>",
        "<a href=\"javascript:alert(1)\">x</a>",
        "<div style=\"background:url(javascript:alert(1))\">x</div>",
        "<style>*{display:none}</style>",
        "<!-- comment --><b>bold</b>",
        "<math><mi xlink:href=\"javascript:alert(1)\">x</mi></math>",
        "</p><script>alert(1)</script><p>",
        "[x](javascript:alert(1))",
        "[x](  javascript:alert(1))",
        "[<img src=x onerror=alert(1)>](https://example.com)",
        "[x](https://example.com \"title\" onclick=\"alert(1)\")",
        "[x](https://example.com\" onmouseover=\"alert(1))",
        "**<img src=x onerror=alert(1)>**",
        "`<script>alert(1)</script>`",
        "```\n</code></pre><script>alert(1)</script>\n```",
        "# <img src=x onerror=alert(1)>",
        "- <img src=x onerror=alert(1)>",
        "> <img src=x onerror=alert(1)>",
        "&lt;script&gt;alert(1)&lt;/script&gt;",
        "&#x3C;img src=x onerror=alert(1)&#x3E;",
        "<a href=\"https://example.com\" target=\"_self\">x</a>",
        "\u0000<script>alert(1)</script>",
        "[x](https://example.com/\u0000)",
    ];

    it.each(attacks)("%j", (attack) => {
        assertSafe(attack);
    });

    it("raw HTML shows up as the text it is", () => {
        expect(html("<b>not bold</b>")).toBe("<p>&lt;b&gt;not bold&lt;/b&gt;</p>");
        expect(dom("<script>alert(1)</script>").textContent).toBe("<script>alert(1)</script>");
    });

    it("a script in an answer is never executed", () => {
        const w = window as unknown as { __pwned?: boolean };
        w.__pwned = false;
        const root = dom("<img src=x onerror=\"window.__pwned=true\"><script>window.__pwned=true</script>");
        document.body.appendChild(root);
        expect(w.__pwned).toBe(false);
        root.remove();
    });

    it("entities in the answer stay as typed", () => {
        expect(dom("&lt;b&gt; &amp;").textContent).toBe("&lt;b&gt; &amp;");
    });
});
