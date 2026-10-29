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
 * Since: Oct-2026
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type JsonObject, MnemoError, MnemoNetworkClient } from "../src/index.js";
import { FakeMnemoServer, rejection } from "./FakeMnemoServer.js";

const Op = MnemoNetworkClient.Operation;

describe("MnemoNetworkClient", () => {
    let server: FakeMnemoServer;

    beforeEach(async () => {
        server = await FakeMnemoServer.start();
    });

    afterEach(async () => {
        await server.close();
    });

    const builder = () => new MnemoNetworkClient.Builder().apiKey("tok-1").baseUrl(server.url()).tenantId("acme");

    it("the operation is required", async () => {
        await rejection(() => builder().build().execute());
        expect(server.count()).toBe(0);
    });

    it("grant private posts the grant", async () => {
        server.reply(200, `{"status":"PENDING"}`);
        const r = await builder().operation(Op.GRANT_PRIVATE).counterpartTenantId("globex")
            .subject("Roadmap").description("shared").build().execute<JsonObject>();
        expect(r.status).toBe("PENDING");
        expect(server.last().path).toBe("/mnemo/network/sharing/private");
        expect(JSON.parse(server.last().body)).toEqual({
            ownerTenantId: "acme", subject: "Roadmap", targetTenantId: "globex", description: "shared",
        });
    });

    it("revoke private is a DELETE with owner and target", async () => {
        server.reply(204, "");
        expect(await builder().operation(Op.REVOKE_PRIVATE).counterpartTenantId("globex").subject("Road map")
            .build().execute()).toBeNull();
        expect(server.last().method).toBe("DELETE");
        expect(server.last().rawPath).toBe("/mnemo/network/sharing/private/Road%20map");
        expect(server.last().query).toBe("ownerTenantId=acme&targetTenantId=globex");
    });

    it("accept inbound grant maps borrower and owner", async () => {
        server.reply(200, "{}");
        await builder().operation(Op.ACCEPT_INBOUND_GRANT).counterpartTenantId("globex").subject("Roadmap")
            .build().execute();
        expect(server.last().method).toBe("POST");
        expect(server.last().path).toBe("/mnemo/network/sharing/private/inbound/Roadmap/accept");
        expect(server.last().query).toBe("borrowerTenantId=acme&ownerTenantId=globex");
    });

    it("publish sends the visibility in the body", async () => {
        server.reply(200, "{}");
        await builder().operation(Op.PUBLISH).subject("Roadmap").description("d").affiliatedOnly(true)
            .build().execute();
        expect(server.last().path).toBe("/mnemo/network/sharing/public/Roadmap");
        expect(server.last().query).toBe("ownerTenantId=acme");
        expect(JSON.parse(server.last().body)).toEqual({ description: "d", affiliatedOnly: true });
    });

    it("publish without visibility options sends an empty body", async () => {
        server.reply(200, "{}");
        await builder().operation(Op.PUBLISH).subject("Roadmap").build().execute();
        expect(JSON.parse(server.last().body)).toEqual({});
    });

    it("browse registry returns a page and sends only the filters set", async () => {
        server.reply(200, `{"content":[{"subject":"Roadmap"}],"totalElements":1}`);
        const page = await builder().operation(Op.BROWSE_PUBLIC_REGISTRY).page(1).build().execute<JsonObject>();
        expect((page.content as JsonObject[])[0]!.subject).toBe("Roadmap");
        expect(server.last().query).toBe("callerTenantId=acme&page=1");
    });

    it("subscribe and unsubscribe", async () => {
        server.reply(200, "{}");
        await builder().operation(Op.SUBSCRIBE).counterpartTenantId("globex").subject("Roadmap").build().execute();
        expect(JSON.parse(server.last().body)).toEqual({
            subscriberTenantId: "acme", ownerTenantId: "globex", subject: "Roadmap",
        });

        server.reply(204, "");
        await builder().operation(Op.UNSUBSCRIBE).counterpartTenantId("globex").subject("Roadmap").build().execute();
        expect(server.last().path).toBe("/mnemo/network/sharing/subscriptions/globex/Roadmap");
        expect(server.last().query).toBe("subscriberTenantId=acme");
    });

    it("approve affiliation puts the requester in the path", async () => {
        server.reply(200, "{}");
        await builder().operation(Op.APPROVE_AFFILIATION).counterpartTenantId("globex").build().execute();
        expect(server.last().path).toBe("/mnemo/network/affiliates/requests/globex/approve");
        expect(server.last().query).toBe("targetTenantId=acme");
    });

    it("the counterpart is required where the operation has one", async () => {
        const e = await rejection(() => builder().operation(Op.REQUEST_AFFILIATION).build().execute());
        expect(e.error.code).toBe(MnemoError.Code.INVALID_REQUEST);
        expect(e.message).toContain("counterpartTenantId");
        expect(server.count()).toBe(0);
    });

    it("every operation is wired", async () => {
        server.reply(200, "{}");
        const ops = Object.values(Op);
        for (const op of ops) {
            await builder().operation(op).counterpartTenantId("globex").subject("S").query("q").build().execute();
        }
        expect(server.count()).toBe(ops.length);
    });
});
