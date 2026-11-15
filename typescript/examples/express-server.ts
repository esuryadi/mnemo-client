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
 * Embedding a MNEMO chat in an Express app: the page that carries the chat, and the endpoint that gives it a
 * short-lived embed token. The API key stays on this server; the browser only ever receives the embed token.
 *
 *     npm install express @panaxon/mnemo-client
 *     MNEMO_API_KEY=... MNEMO_TENANT=acme APP_ORIGIN=https://app.example.com node server.js
 */
import express, { type Express, type Request } from "express";
import { EmbedSnippet, EmbedTokenEndpoint, MnemoClientException, MnemoEmbedClient } from "@panaxon/mnemo-client";

export interface ExampleConfig {
    /** An API token with the ADMIN role. Server side only. */
    apiKey: string;
    tenantId: string;
    /** The origin your page is served from, e.g. https://app.example.com: the only place the token works. */
    allowedOrigin: string;
    /** Overrides the MNEMO endpoint (the tests point it at a fake). */
    baseUrl?: string;
    /** Who is signed in? Return their id, or null when nobody is. Replace this with your own session lookup. */
    currentUser: (req: Request) => string | null;
}

export function createApp(config: ExampleConfig): Express {
    // the template holds the credential and the fixed parameters; each request only adds the visitor's id
    const template = new MnemoEmbedClient.Builder()
        .apiKey(config.apiKey)
        .tenantId(config.tenantId)
        .allowedOrigin(config.allowedOrigin);
    if (config.baseUrl) {
        template.baseUrl(config.baseUrl);
    }

    const app = express();

    app.get("/", (_req, res) => {
        res.type("html").send(
            "<!doctype html><title>Support</title><h1>Ask us anything</h1>\n"
            + EmbedSnippet.render({ tokenUrl: "/mnemo/embed-token", width: "50%", height: 600 }));
    });

    app.get("/mnemo/embed-token", async (req, res) => {
        const userId = config.currentUser(req);
        if (userId === null) {
            res.status(401).json({ error: "sign in first" });
            return;
        }
        try {
            res.set("Cache-Control", "no-store").type("application/json")
                .send(await EmbedTokenEndpoint.handle(template, userId));
        } catch (e) {
            // do not pass MNEMO's message on to the browser
            res.status(e instanceof MnemoClientException && e.httpStatus === 429 ? 429 : 502)
                .json({ error: "the chat is not available right now" });
        }
    });

    return app;
}
