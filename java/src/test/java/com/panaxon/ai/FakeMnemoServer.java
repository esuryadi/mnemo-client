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

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * A throwaway HTTP server on a random port that records every request and answers with a canned reply,
 * so the clients can be tested end to end through the real RESTEasy stack without the MNEMO service.
 */
final class FakeMnemoServer implements AutoCloseable {
    record Received(String method, String path, String rawPath, String query, String token, String body) { }

    private final HttpServer server;
    private final List<Received> requests = new CopyOnWriteArrayList<>();
    private volatile int status = 200;
    private volatile String reply = "{}";

    FakeMnemoServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            requests.add(new Received(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
                    exchange.getRequestURI().getRawPath(), exchange.getRequestURI().getRawQuery(),
                    exchange.getRequestHeaders().getFirst(AbstractMnemoClient.TOKEN_HEADER), body));
            byte[] bytes = reply.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            if (status == 204) {
                exchange.sendResponseHeaders(204, -1);
            } else {
                exchange.sendResponseHeaders(status, bytes.length);
                exchange.getResponseBody().write(bytes);
            }
            exchange.close();
        });
        server.start();
    }

    FakeMnemoServer reply(int status, String json) {
        this.status = status;
        this.reply = json;
        return this;
    }

    String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    Received last() {
        return requests.get(requests.size() - 1);
    }

    int count() {
        return requests.size();
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
