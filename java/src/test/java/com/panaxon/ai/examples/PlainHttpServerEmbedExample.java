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

package com.panaxon.ai.examples;

import com.panaxon.ai.EmbedSnippet;
import com.panaxon.ai.EmbedTokenEndpoint;
import com.panaxon.ai.MnemoEmbedClient;
import com.panaxon.ai.exception.MnemoClientException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

/**
 * The whole integration on the JDK's built-in HTTP server: a page that embeds the component, and the token
 * endpoint it calls. The visitor id is read from an {@code X-User} header here, standing in for your own login
 * session; a real endpoint must refuse a request that is not signed in.
 */
public final class PlainHttpServerEmbedExample implements AutoCloseable {
    private final HttpServer server;

    public PlainHttpServerEmbedExample(int port, String apiKey, String baseUrl, String tenantId, String allowedOrigin)
            throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/chat", exchange -> send(exchange, 200, "text/html; charset=utf-8", page()));
        server.createContext("/mnemo/embed-token", exchange -> {
            String user = exchange.getRequestHeaders().getFirst("X-User");
            if (user == null) {
                send(exchange, 401, "application/json", "{\"error\":\"sign in first\"}");
                return;
            }
            try {
                send(exchange, 200, "application/json", EmbedTokenEndpoint.handle(() -> new MnemoEmbedClient.Builder()
                        .apiKey(apiKey).baseUrl(baseUrl).tenantId(tenantId).allowedOrigin(allowedOrigin), user));
            } catch (MnemoClientException e) {
                send(exchange, 502, "application/json", "{\"error\":\"could not get a chat token\"}");
            }
        });
        server.start();
    }

    private static String page() {
        try {
            return "<!doctype html><title>Chat</title>"
                    + EmbedSnippet.render(new EmbedSnippet.Options("/mnemo/embed-token").height("600"));
        } catch (MnemoClientException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void send(HttpExchange exchange, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", type);
        exchange.getResponseHeaders().add("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    public int port() {
        return server.getAddress().getPort();
    }

    @Override
    public void close() {
        server.stop(0);
    }

    public static void main(String[] args) throws IOException {
        PlainHttpServerEmbedExample example = new PlainHttpServerEmbedExample(8080, System.getenv("MNEMO_API_KEY"),
                "https://mnemo-api.panaxon.ai/api", "acme", "http://localhost:8080");
        System.out.println("open http://localhost:" + example.port() + "/chat");
    }
}
