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

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildEmbed, OUTPUT } from "../../scripts/build-embed.mjs";

const BUDGET_GZIP_BYTES = 40 * 1024;

describe("embed/mnemo-chat.js", () => {
    it("builds to one file under the 40 KB gzip budget", async () => {
        const bundle = await buildEmbed({ write: false });
        const gzipped = gzipSync(bundle, { level: 9 }).length;
        console.log(`mnemo-chat.js: ${Buffer.byteLength(bundle)} bytes, ${gzipped} gzipped`);
        expect(gzipped).toBeLessThan(BUDGET_GZIP_BYTES);
    });

    it("is a plain script: no import or export, no source map, no dynamic require", async () => {
        const bundle = await buildEmbed({ write: false });
        expect(bundle).toMatch(/^\/\*! @panaxon\/mnemo-client <mnemo-chat>/);
        expect(bundle).not.toMatch(/^\s*(import|export)\s/m);
        expect(bundle).not.toMatch(/\bimport\s*\(/);
        expect(bundle).not.toContain("sourceMappingURL");
        expect(bundle).not.toMatch(/\brequire\s*\(/);
    });

    it("uses no Node-only globals or modules", async () => {
        const bundle = await buildEmbed({ write: false });
        for (const forbidden of [/\bprocess\./, /\bBuffer\b/, /node:[a-z]/, /\b__dirname\b/, /\b__filename\b/, /\bglobal\./]) {
            expect(bundle, String(forbidden)).not.toMatch(forbidden);
        }
    });

    it("contains no token, key or host that is not meant to ship", async () => {
        const bundle = await buildEmbed({ write: false });
        expect(bundle).toContain("https://mnemo-api.panaxon.ai/api"); // the only host: the default base-url
        expect(bundle.match(/https?:\/\/[a-z0-9.-]+/g)!.filter((u) => !/panaxon\.ai|w3\.org/.test(u))).toEqual([]);
        expect(bundle).not.toMatch(/mnemo_embed_|MNEMO_API_KEY|master/i);
    });

    it("builds the same bytes every time", async () => {
        expect(await buildEmbed({ write: false })).toBe(await buildEmbed({ write: false }));
    });

    it("the committed file is up to date (run npm run build:embed after changing src/embed)", async () => {
        expect(readFileSync(OUTPUT, "utf8")).toBe(await buildEmbed({ write: false }));
    });

    it("loaded as a script it registers <mnemo-chat>, and loading it twice is harmless", () => {
        const source = readFileSync(OUTPUT, "utf8");
        new Function(source)();
        expect(customElements.get("mnemo-chat")).toBeDefined();
        expect(() => new Function(source)()).not.toThrow();
        const el = document.createElement("mnemo-chat");
        document.body.appendChild(el);
        expect(el.shadowRoot!.querySelector("textarea")).not.toBeNull();
        expect(typeof (el as unknown as { open: unknown }).open).toBe("function");
        expect(typeof (el as unknown as { reset: unknown }).reset).toBe("function");
        el.remove();
    });
});
