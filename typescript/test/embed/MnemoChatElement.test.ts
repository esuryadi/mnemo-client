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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    BASE, bubbles, bubbleText, button, errorText, events, Feed, FakeNetwork, input, json, log, mount, PREFIX,
    press, ready, shadow, sse, statusText, tokenReply, TOKEN_URL, type, expiresIn,
} from "./harness.js";

let net: FakeNetwork;

beforeEach(() => {
    net = new FakeNetwork();
    try {
        sessionStorage.clear();
    } catch {
        // none
    }
});

afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

/** Types a message and presses Send. */
async function say(el: Element, text: string) {
    type(el, text);
    button(el).click();
}

const waitForText = (el: Element, text: string) =>
    vi.waitFor(() => expect(bubbles(el).map(bubbleText)).toContain(text), { timeout: 2000 });

describe("structure and accessibility", () => {
    it("renders a labelled region with a live log, a message box and a send button", async () => {
        const el = mount();
        await ready(el);
        const root = shadow(el).querySelector(".root")!;
        expect(root.getAttribute("role")).toBe("region");
        expect(root.getAttribute("aria-label")).toBe("Chat");
        expect(log(el).getAttribute("role")).toBe("log");
        expect(log(el).getAttribute("aria-live")).toBe("polite");
        expect(log(el).getAttribute("tabindex")).toBe("0");
        expect(input(el).getAttribute("aria-label")).toBe("Your message");
        expect(input(el).placeholder).toBe("Ask a question…");
        expect(button(el).type).toBe("submit");
        expect(button(el).textContent).toBe("Send");
        expect(shadow(el).querySelector(".status")!.getAttribute("role")).toBe("status");
        expect(shadow(el).querySelector(".error")!.getAttribute("role")).toBe("alert");
    });

    it("is registered once, and defining it again is harmless", async () => {
        const { defineMnemoChat } = await import("../../src/embed/index.js");
        mount();
        expect(() => defineMnemoChat()).not.toThrow();
        expect(customElements.get("mnemo-chat")).toBeDefined();
    });

    it("marks the log busy while an answer streams, so it is read once at the end", async () => {
        const feed = new Feed();
        net.on("POST", "/mnemo/chat/stream", () => feed.response);
        const el = mount();
        await ready(el);
        await say(el, "hello");
        await vi.waitFor(() => expect(log(el).getAttribute("aria-busy")).toBe("true"));
        expect(button(el).disabled).toBe(true);
        feed.push("event: message\ndata: Hi\n\nevent: done\ndata: {}\n\n");
        feed.end();
        await vi.waitFor(() => expect(log(el).hasAttribute("aria-busy")).toBe(false));
        expect(button(el).disabled).toBe(false);
    });

    it("each bubble starts with a screen-reader-only speaker label", async () => {
        const el = mount();
        await ready(el);
        await say(el, "hello");
        await waitForText(el, "Hi");
        const labels = bubbles(el).map((b) => b.querySelector(".sr-only")!.textContent);
        expect(labels).toEqual(["You: ", "Assistant: "]);
    });

    it("open() puts the focus in the message box", async () => {
        const el = mount();
        await ready(el);
        el.open();
        expect(shadow(el).activeElement).toBe(input(el));
    });
});

describe("attributes", () => {
    it.each([
        ["400", "400px"], [" 400 ", "400px"], ["12.5", "12.5px"], ["50%", "50%"], ["40vh", "40vh"], ["20rem", "20rem"],
        ["calc(100% - 20px)", "calc(100% - 20px)"], ["auto", "auto"],
    ])("width %j becomes %j", async (value, css) => {
        const el = mount({ width: value, height: value });
        expect(el.style.getPropertyValue("width")).toBe(css);
        expect(el.style.getPropertyValue("height")).toBe(css);
    });

    it.each([
        "400; background: url(https://evil.test/x)", "red", "expression(alert(1))", "url(x)", "10px 20px", "-5", "calc(1px",
        "calc(1px))(", "var(--x)", "${'\\'}", "",
    ])("width %j is ignored", async (value) => {
        const el = mount({ width: value });
        expect(el.style.getPropertyValue("width")).toBe("");
    });

    it("changing or removing width and height updates the element", async () => {
        const el = mount({ width: "300", height: "50vh" });
        el.setAttribute("width", "60%");
        expect(el.style.getPropertyValue("width")).toBe("60%");
        el.removeAttribute("height");
        expect(el.style.getPropertyValue("height")).toBe("");
    });

    it.each([["light", "light"], ["dark", "dark"], ["auto", "auto"], ["DARK", "dark"], ["neon", "auto"], ["", "auto"]])(
        "theme %j gives data-theme %j", async (value, expected) => {
            const el = mount({ theme: value });
            expect(shadow(el).querySelector(".root")!.getAttribute("data-theme")).toBe(expected);
        });

    it("no theme attribute means auto", async () => {
        const el = mount();
        expect(shadow(el).querySelector(".root")!.getAttribute("data-theme")).toBe("auto");
    });

    it("placeholder is used as text, never as markup", async () => {
        const el = mount({ placeholder: '"><img src=x onerror=alert(1)><b>x' });
        expect(input(el).placeholder).toBe('"><img src=x onerror=alert(1)><b>x');
        expect(shadow(el).querySelector("img")).toBeNull();
        expect(shadow(el).querySelector("b")).toBeNull();
    });

    it("locale picks the language of the labels and sets lang", async () => {
        const el = mount({ locale: "es-MX" });
        expect(button(el).textContent).toBe("Enviar");
        expect(input(el).placeholder).toBe("Haz una pregunta…");
        expect(shadow(el).querySelector(".root")!.getAttribute("lang")).toBe("es-MX");
    });

    it("an unknown locale falls back to English, and a hostile one sets no lang", async () => {
        const el = mount({ locale: '"><script>' });
        expect(button(el).textContent).toBe("Send");
        expect(shadow(el).querySelector(".root")!.hasAttribute("lang")).toBe(false);
    });

    it("an attribute value is never parsed as HTML anywhere", async () => {
        const el = mount({ "session-id": "<img src=x onerror=alert(1)>", locale: "<b>", theme: "<i>", height: "<u>" });
        await ready(el);
        expect(shadow(el).querySelectorAll("img, b, i, u, script").length).toBe(0);
    });
});

describe("connecting", () => {
    it("fetches the token from token-url with the visitor's cookies, then the history, then initializes", async () => {
        const el = mount();
        const ready_ = events(el, "mnemo-ready");
        await vi.waitFor(() => expect(ready_).toHaveLength(1));
        const [tokenCall] = net.of("GET", TOKEN_URL);
        expect(tokenCall!.init.credentials).toBe("same-origin");
        expect(tokenCall!.headers["x-mnemo-api-token"]).toBeUndefined();

        const history = net.of("GET", "/mnemo/sessions/*/history")[0]!;
        const sessionId = ready_[0]!.detail.sessionId as string;
        expect(sessionId.startsWith(PREFIX)).toBe(true);
        expect(history.url.pathname).toBe(`/api/mnemo/sessions/${sessionId}/history`);
        expect(history.url.search).toBe("?tenantId=acme&size=50");
        expect(history.headers["x-mnemo-api-token"]).toBe("mnemo_embed_one");
        expect(history.headers["authorization"]).toBeUndefined();

        const init = net.of("POST", "/mnemo/init/stream")[0]!;
        expect(init.url.search).toBe("");
        expect(JSON.parse(init.body)).toEqual({ tenantId: "acme", sessionId });
        expect(init.headers["x-mnemo-api-token"]).toBe("mnemo_embed_one");
    });

    it("mnemo-ready bubbles out of the shadow root", async () => {
        const el = mount();
        const seen: Event[] = [];
        document.body.addEventListener("mnemo-ready", (e) => seen.push(e));
        await vi.waitFor(() => expect(seen).toHaveLength(1));
    });

    it("uses the public MNEMO endpoint when there is no base-url", async () => {
        const el = mount();
        el.removeAttribute("base-url");
        await ready(el);
        net.calls.length = 0;
        el.reset();
        await vi.waitFor(() => expect(net.of("POST", "/mnemo/init/stream").length + net.calls.length).toBeGreaterThan(0));
        expect(net.calls.every((c) => c.url.origin === "https://mnemo-api.panaxon.ai" || c.url.origin === "https://page.test")).toBe(true);
    });

    it("shows the earlier turns oldest first and does not initialize an existing session", async () => {
        net.on("GET", "/mnemo/sessions/*/history", () => json({ hasMore: false, entries: [
            { request: { message: "second question", timestamp: 3 }, response: { message: "second answer", timestamp: 4 } },
            { request: { message: "first question", timestamp: 1 }, response: { message: "first answer", timestamp: 2 } },
        ] }));
        const el = mount();
        await ready(el);
        expect(bubbles(el).map(bubbleText)).toEqual(["first question", "first answer", "second question", "second answer"]);
        expect(net.of("POST", "/mnemo/init/stream")).toHaveLength(0);
    });

    it("a session without history (404) is initialized", async () => {
        net.on("GET", "/mnemo/sessions/*/history", () => json({ error: "no such session" }, 404));
        const el = mount();
        await ready(el);
        expect(net.of("POST", "/mnemo/init/stream")).toHaveLength(1);
        expect(errorText(el)).toBe("");
    });

    it("tolerates a history page it does not understand", async () => {
        net.on("GET", "/mnemo/sessions/*/history", () => json({ entries: [null, 5, { request: {} }, { response: { message: 4 } }] }));
        const el = mount();
        await ready(el);
        expect(bubbles(el)).toHaveLength(0);
    });

    it("session-id is appended to the token's prefix", async () => {
        const el = mount({ "session-id": "support-widget" });
        const seen = events(el, "mnemo-ready");
        await vi.waitFor(() => expect(seen).toHaveLength(1));
        expect(seen[0]!.detail.sessionId).toBe(PREFIX + "support-widget");
    });

    it("a session-id that already has the prefix is used as it is", async () => {
        const el = mount({ "session-id": PREFIX + "x" });
        const seen = events(el, "mnemo-ready");
        await vi.waitFor(() => expect(seen).toHaveLength(1));
        expect(seen[0]!.detail.sessionId).toBe(PREFIX + "x");
    });

    it("without session-id, a reload in the same tab keeps the session", async () => {
        const first = mount();
        const a = events(first, "mnemo-ready");
        await vi.waitFor(() => expect(a).toHaveLength(1));
        first.remove();
        const second = mount();
        const b = events(second, "mnemo-ready");
        await vi.waitFor(() => expect(b).toHaveLength(1));
        expect(b[0]!.detail.sessionId).toBe(a[0]!.detail.sessionId);
    });

    it("the tenant can come from the tenant-id attribute when the endpoint does not return one", async () => {
        net.on("GET", TOKEN_URL, () => json({ token: "t", expiresAt: expiresIn(900), sessionPrefix: PREFIX }));
        const el = mount({ "tenant-id": "from-attribute" });
        await ready(el);
        expect(net.of("GET", "/mnemo/sessions/*/history")[0]!.url.search).toBe("?tenantId=from-attribute&size=50");
    });

    it("a changed token-url starts over", async () => {
        const el = mount();
        await ready(el);
        net.on("GET", "/other-token", () => tokenReply("mnemo_embed_two"));
        const seen = events(el, "mnemo-ready");
        el.setAttribute("token-url", "/other-token");
        await vi.waitFor(() => expect(seen).toHaveLength(1));
        expect(net.of("GET", "/other-token")).toHaveLength(1);
        expect(net.of("GET", "/mnemo/sessions/*/history").at(-1)!.headers["x-mnemo-api-token"]).toBe("mnemo_embed_two");
    });

    it("removing the element and adding it back reconnects once", async () => {
        const el = mount();
        await ready(el);
        el.remove();
        expect(bubbles(el)).toHaveLength(0);
        const seen = events(el, "mnemo-ready");
        document.body.appendChild(el);
        await vi.waitFor(() => expect(seen).toHaveLength(1));
    });
});

describe("chatting", () => {
    it("sends the message to chat/stream and shows the answer as it streams", async () => {
        const feed = new Feed();
        net.on("POST", "/mnemo/chat/stream", () => feed.response);
        const el = mount();
        const sent = events(el, "mnemo-message");
        const ready_ = events(el, "mnemo-ready");
        await vi.waitFor(() => expect(ready_).toHaveLength(1));
        await say(el, "  What did I eat?  ");
        await vi.waitFor(() => expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(1));
        const call = net.of("POST", "/mnemo/chat/stream")[0]!;
        expect(call.url.search).toBe("");
        expect(JSON.parse(call.body)).toEqual({ tenantId: "acme", sessionId: ready_[0]!.detail.sessionId, message: "What did I eat?" });
        expect(call.headers["x-mnemo-api-token"]).toBe("mnemo_embed_one");
        expect(call.headers["accept"]).toBe("text/event-stream");
        expect(input(el).value).toBe("");
        expect(bubbles(el).map(bubbleText)).toEqual(["What did I eat?", ""]);
        expect(bubbles(el)[1]!.classList.contains("pending")).toBe(true);

        feed.push("event: message\ndata: You had \n\n");
        await waitForText(el, "You had");
        expect(bubbles(el)[1]!.classList.contains("pending")).toBe(false);
        feed.push("event: message\ndata: pasta.\n\n");
        await waitForText(el, "You had pasta.");
        expect(sent.map((e) => e.detail)).toEqual([{ role: "user", text: "What did I eat?" }]);
        feed.push("event: done\ndata: {}\n\n");
        feed.end();
        await vi.waitFor(() => expect(sent).toHaveLength(2));
        expect(sent[1]!.detail).toEqual({ role: "assistant", text: "You had pasta." });
        expect(errorText(el)).toBe("");
        expect(statusText(el)).toBe("");
    });

    it("a quota warning is shown as status text", async () => {
        net.on("POST", "/mnemo/chat/stream", () => sse(["quota-warning", '{"message":"90% of your quota is used"}'],
            ["message", "ok"], ["done", "{}"]));
        const el = mount();
        await ready(el);
        await say(el, "hi");
        await waitForText(el, "ok");
    });

    it("Enter sends, Shift+Enter does not, and Enter during IME composition does not", async () => {
        const el = mount();
        await ready(el);
        type(el, "one");
        expect(press(el, "Enter", { shiftKey: true }).defaultPrevented).toBe(false);
        expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(0);
        press(el, "Enter", { isComposing: true });
        expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(0);
        expect(press(el, "Enter").defaultPrevented).toBe(true);
        await vi.waitFor(() => expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(1));
    });

    it("an empty or blank message is not sent", async () => {
        const el = mount();
        await ready(el);
        await say(el, "   ");
        press(el, "Enter");
        expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(0);
        expect(bubbles(el)).toHaveLength(0);
    });

    it("a second message while one is streaming is ignored", async () => {
        const feed = new Feed();
        net.on("POST", "/mnemo/chat/stream", () => feed.response);
        const el = mount();
        await ready(el);
        await say(el, "first");
        await vi.waitFor(() => expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(1));
        await say(el, "second");
        press(el, "Enter");
        expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(1);
        feed.push("event: done\ndata: {}\n\n");
        feed.end();
    });

    it("Escape stops waiting for the answer", async () => {
        const feed = new Feed();
        net.on("POST", "/mnemo/chat/stream", () => feed.response);
        const el = mount();
        await ready(el);
        await say(el, "first");
        await vi.waitFor(() => expect(button(el).disabled).toBe(true));
        feed.push("event: message\ndata: partial\n\n");
        await waitForText(el, "partial");
        press(el, "Escape");
        expect(button(el).disabled).toBe(false);
        feed.push("event: message\ndata: more\n\n");
        await new Promise((r) => setTimeout(r, 20));
        expect(bubbles(el).map(bubbleText)).toEqual(["first", "partial"]);
        feed.end();
    });

    it("keeps what arrived when the stream reports an error part way", async () => {
        net.on("POST", "/mnemo/chat/stream", () => sse(["message", "You ate"], ["error", '{"error":"LLM overloaded"}']));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await ready(el);
        await say(el, "hi");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(bubbles(el).map(bubbleText)).toEqual(["hi", "You ate"]);
        expect(errorText(el)).toBe("The message could not be sent. Please try again.");
        expect(failed[0]!.detail).toEqual({ code: "chat-error", message: "LLM overloaded", status: 0 });
        expect(button(el).disabled).toBe(false);
    });

    it("an answer that ends with nothing is an error and leaves no empty bubble", async () => {
        net.on("POST", "/mnemo/chat/stream", () => sse(["done", "{}"]));
        const el = mount();
        await ready(el);
        await say(el, "hi");
        await vi.waitFor(() => expect(errorText(el)).not.toBe(""));
        expect(bubbles(el).map(bubbleText)).toEqual(["hi"]);
    });

    it("the next message clears the earlier error", async () => {
        net.on("POST", "/mnemo/chat/stream", () => json({ error: "boom" }, 500), () => sse(["message", "fine"], ["done", "{}"]));
        const el = mount();
        await ready(el);
        await say(el, "one");
        await vi.waitFor(() => expect(errorText(el)).not.toBe(""));
        await say(el, "two");
        await waitForText(el, "fine");
        expect(errorText(el)).toBe("");
    });
});

describe("tokens", () => {
    it("fetches a new token when the old one is within 60 seconds of expiring", async () => {
        net.on("GET", TOKEN_URL, () => tokenReply("mnemo_embed_short", 70), () => tokenReply("mnemo_embed_new", 900));
        const el = mount();
        await ready(el);
        expect(net.of("GET", TOKEN_URL)).toHaveLength(1);
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 30_000); // 40 s left: inside the margin
        await say(el, "hi");
        await waitForText(el, "Hi");
        expect(net.of("GET", TOKEN_URL)).toHaveLength(2);
        expect(net.of("POST", "/mnemo/chat/stream")[0]!.headers["x-mnemo-api-token"]).toBe("mnemo_embed_new");
    });

    it("keeps a token that still has more than 60 seconds left", async () => {
        net.on("GET", TOKEN_URL, () => tokenReply("mnemo_embed_short", 120));
        const el = mount();
        await ready(el);
        await say(el, "hi");
        await waitForText(el, "Hi");
        expect(net.of("GET", TOKEN_URL)).toHaveLength(1);
    });

    it("replaces the token once and retries when MNEMO answers 401", async () => {
        net.on("GET", TOKEN_URL, () => tokenReply("mnemo_embed_one"), () => tokenReply("mnemo_embed_two"));
        net.on("POST", "/mnemo/chat/stream", () => json({ error: "token expired" }, 401),
            () => sse(["message", "worked"], ["done", "{}"]));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await ready(el);
        await say(el, "hi");
        await waitForText(el, "worked");
        expect(net.of("GET", TOKEN_URL)).toHaveLength(2);
        expect(net.of("POST", "/mnemo/chat/stream").map((c) => c.headers["x-mnemo-api-token"]))
            .toEqual(["mnemo_embed_one", "mnemo_embed_two"]);
        expect(failed).toHaveLength(0);
    });

    it("gives up after one retry and asks the visitor to reload", async () => {
        net.on("POST", "/mnemo/chat/stream", () => json({ error: "token expired" }, 401));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await ready(el);
        await say(el, "hi");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(2);
        expect(errorText(el)).toBe("The chat session has expired. Please reload the page.");
        expect(failed[0]!.detail.status).toBe(401);
        expect(failed[0]!.detail.code).toBe("MNERR-0401");
    });

    it("concurrent needs share one token request", async () => {
        const el = mount();
        await ready(el);
        expect(net.of("GET", TOKEN_URL)).toHaveLength(1);
    });

    it("accepts expiresAt as epoch seconds", async () => {
        net.on("GET", TOKEN_URL, () => json({ token: "t", expiresAt: Math.floor(Date.now() / 1000) + 900,
            sessionPrefix: PREFIX, tenantId: "acme" }));
        const el = mount();
        await ready(el);
        await say(el, "hi");
        await waitForText(el, "Hi");
        expect(net.of("GET", TOKEN_URL)).toHaveLength(1);
    });

    it("never sends the token anywhere but the X-Mnemo-Api-Token header", async () => {
        const el = mount();
        await ready(el);
        await say(el, "hi");
        await waitForText(el, "Hi");
        for (const call of net.calls) {
            expect(call.url.href).not.toContain("mnemo_embed");
            expect(call.body).not.toContain("mnemo_embed");
        }
    });
});

describe("error states", () => {
    it.each([
        ["the token endpoint is down", () => json({ error: "x" }, 500)],
        ["the token endpoint says unauthorized", () => json({}, 401)],
        ["the token reply is not JSON", () => new Response("<html>", { status: 200 })],
        ["the token reply has no token", () => json({ expiresAt: expiresIn(900) })],
        ["the token reply has no usable expiry", () => json({ token: "t", expiresAt: "soon" })],
        ["the token reply is null", () => new Response("null", { status: 200 })],
    ])("%s", async (_name, reply) => {
        net.on("GET", TOKEN_URL, reply);
        const el = mount();
        const failed = events(el, "mnemo-error");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(failed[0]!.detail.code).toBe("token-error");
        expect(errorText(el)).toBe("The chat could not start. Please try again later.");
        expect(statusText(el)).toBe("");
        expect(net.of("GET", "/mnemo/sessions/*/history")).toHaveLength(0);
    });

    it("the token endpoint cannot be reached", async () => {
        net.on("GET", TOKEN_URL, new Error("offline"));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(failed[0]!.detail.message).toContain("offline");
    });

    it("a missing token-url is a configuration error", async () => {
        const el = mount();
        el.removeAttribute("token-url");
        const failed = events(el, "mnemo-error");
        el.setAttribute("token-url", " ");
        await vi.waitFor(() => expect(failed.length).toBeGreaterThan(0));
        expect(failed[0]!.detail.code).toBe("config-error");
    });

    it("no tenant anywhere is a configuration error", async () => {
        net.on("GET", TOKEN_URL, () => json({ token: "t", expiresAt: expiresIn(900), sessionPrefix: PREFIX }));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(failed[0]!.detail.code).toBe("config-error");
        expect(errorText(el)).toBe("The chat is not configured: no tenant was provided.");
    });

    it("a failing history call (403) is reported and nothing is initialized", async () => {
        net.on("GET", "/mnemo/sessions/*/history", () => json({ error: "wrong prefix" }, 403));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(failed[0]!.detail).toEqual({ code: "MNERR-0403", message: "wrong prefix", status: 403 });
        expect(net.of("POST", "/mnemo/init/stream")).toHaveLength(0);
    });

    it("a failed start is retried when the visitor sends a message", async () => {
        net.on("POST", "/mnemo/init/stream", () => json({ error: "busy" }, 503), () => sse(["complete", "{}"]));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        await say(el, "hi");
        await waitForText(el, "Hi");
        expect(net.of("POST", "/mnemo/init/stream")).toHaveLength(2);
        expect(errorText(el)).toBe("");
    });

    it("a failed start with a message waiting leaves the box usable", async () => {
        net.on("POST", "/mnemo/init/stream", () => json({ error: "busy" }, 503));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        await say(el, "hi");
        await vi.waitFor(() => expect(failed).toHaveLength(2));
        expect(button(el).disabled).toBe(false);
        expect(bubbles(el).map(bubbleText)).toEqual(["hi"]);
        expect(errorText(el)).toBe("The chat could not start. Please try again later.");
    });

    it("a rate limit (429) says to wait", async () => {
        net.on("POST", "/mnemo/chat/stream", () => json({ error: "slow" }, 429));
        const el = mount();
        await ready(el);
        await say(el, "hi");
        await vi.waitFor(() => expect(errorText(el)).toBe("Too many messages. Please wait a moment and try again."));
    });

    it("a server error shows a generic message and gives the page the details", async () => {
        net.on("POST", "/mnemo/chat/stream", () => json({ error: "internal detail" }, 500));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await ready(el);
        await say(el, "hi");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(errorText(el)).toBe("The message could not be sent. Please try again.");
        expect(errorText(el)).not.toContain("internal detail");
        expect(failed[0]!.detail).toEqual({ code: "MNERR-0500", message: "internal detail", status: 500 });
    });

    it("a network failure during chat is reported", async () => {
        net.on("POST", "/mnemo/chat/stream", new Error("offline"));
        const el = mount();
        const failed = events(el, "mnemo-error");
        await ready(el);
        await say(el, "hi");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(failed[0]!.detail.code).toBe("MNERR-0600");
    });

    it("errors are localized", async () => {
        net.on("GET", TOKEN_URL, () => json({}, 500));
        const el = mount({ locale: "de" });
        await vi.waitFor(() => expect(errorText(el)).toBe("Der Chat konnte nicht gestartet werden. Bitte versuchen Sie es später erneut."));
    });

    it("an http base-url is refused by the client before anything is sent to it", async () => {
        const el = mount({ "base-url": "http://mnemo.example/api" });
        const failed = events(el, "mnemo-error");
        await vi.waitFor(() => expect(failed).toHaveLength(1));
        expect(failed[0]!.detail.code).toBe("MNERR-0001");
        expect(net.calls.filter((c) => c.url.hostname === "mnemo.example")).toHaveLength(0);
    });
});

describe("reset()", () => {
    it("clears the conversation, starts a new session and does not ask for the old history", async () => {
        const el = mount();
        const seen = events(el, "mnemo-ready");
        await vi.waitFor(() => expect(seen).toHaveLength(1));
        await say(el, "hello");
        await waitForText(el, "Hi");
        const before = net.of("GET", "/mnemo/sessions/*/history").length;
        el.reset();
        expect(bubbles(el)).toHaveLength(0);
        await vi.waitFor(() => expect(seen).toHaveLength(2));
        expect(seen[1]!.detail.sessionId).not.toBe(seen[0]!.detail.sessionId);
        expect(String(seen[1]!.detail.sessionId).startsWith(PREFIX)).toBe(true);
        expect(net.of("GET", "/mnemo/sessions/*/history")).toHaveLength(before);
        expect(net.of("POST", "/mnemo/init/stream")).toHaveLength(2);
        await say(el, "again");
        await vi.waitFor(() => expect(net.of("POST", "/mnemo/chat/stream")).toHaveLength(2));
        expect(JSON.parse(net.of("POST", "/mnemo/chat/stream")[1]!.body).sessionId).toBe(seen[1]!.detail.sessionId);
    });

    it("drops an answer that is still streaming", async () => {
        const feed = new Feed();
        net.on("POST", "/mnemo/chat/stream", () => feed.response);
        const el = mount();
        const seen = events(el, "mnemo-ready");
        await vi.waitFor(() => expect(seen).toHaveLength(1));
        await say(el, "hello");
        await vi.waitFor(() => expect(button(el).disabled).toBe(true));
        el.reset();
        feed.push("event: message\ndata: late\n\n");
        await vi.waitFor(() => expect(seen).toHaveLength(2));
        await new Promise((r) => setTimeout(r, 20));
        expect(bubbles(el)).toHaveLength(0);
        expect(button(el).disabled).toBe(false);
        feed.end();
    });

    it("with a session-id attribute the new session is still under that name", async () => {
        const el = mount({ "session-id": "support" });
        const seen = events(el, "mnemo-ready");
        await vi.waitFor(() => expect(seen).toHaveLength(1));
        el.reset();
        await vi.waitFor(() => expect(seen).toHaveLength(2));
        expect(String(seen[1]!.detail.sessionId).startsWith(PREFIX + "support-")).toBe(true);
    });
});
