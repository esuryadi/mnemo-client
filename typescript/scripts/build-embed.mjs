/*
 * Copyright (c) 2026, PANAXON.AI, LLC. All rights reserved.
 * Licensed under the Apache License, Version 2.0; see the LICENSE file.
 *
 * Bundles src/embed/main.ts into embed/mnemo-chat.js: one minified file in the IIFE format (it loads from a
 * plain <script> tag), with no runtime dependency. esbuild is a dev dependency only. The options live here so
 * that `npm run build:embed` and the size test build exactly the same bytes.
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OUTPUT = resolve(root, "embed", "mnemo-chat.js");

/** Builds the bundle and returns its text; writes embed/mnemo-chat.js unless {@code write} is false. */
export async function buildEmbed({ write = true } = {}) {
    const result = await build({
        entryPoints: [resolve(root, "src", "embed", "main.ts")],
        bundle: true,
        minify: true,
        format: "iife",
        platform: "browser",
        target: ["es2020"],
        charset: "utf8",
        legalComments: "none",
        banner: { js: "/*! @panaxon/mnemo-client <mnemo-chat> - Apache-2.0 - (c) PANAXON.AI, LLC */" },
        tsconfig: resolve(root, "tsconfig.json"),
        write: false,
        logLevel: "warning",
    });
    const text = result.outputFiles[0].text;
    if (write) {
        mkdirSync(dirname(OUTPUT), { recursive: true });
        writeFileSync(OUTPUT, text);
    }
    return text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const text = await buildEmbed();
    console.log(`embed/mnemo-chat.js: ${Buffer.byteLength(text)} bytes`);
}
