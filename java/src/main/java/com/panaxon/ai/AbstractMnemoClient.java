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

import com.panaxon.ai.exception.MnemoClientException;
import com.panaxon.ai.exception.MnemoError;
import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Form;
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.client.jaxrs.internal.ResteasyClientBuilderImpl;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * <b>AbstractMnemoClient</b> holds the plumbing shared by every client implementation: validating the
 * builder settings, calling the MNEMO REST API through a RESTEasy JAX-RS client and translating HTTP
 * failures into {@link MnemoClientException}s. A fresh JAX-RS client is created per
 * {@link #execute()} call and closed afterwards, so instances hold no connections and are thread-safe.
 *
 * @author edward.suryadi
 * @since 1.0
 */
abstract class AbstractMnemoClient implements MnemoClient {
    static final String TOKEN_HEADER = "X-Mnemo-Api-Token";
    /** How long before a client-credentials token expires it is replaced. */
    static final Duration TOKEN_REFRESH_MARGIN = Duration.ofSeconds(60);

    static final GenericType<Map<String, Object>> MAP = new GenericType<>() { };
    static final GenericType<List<Map<String, Object>>> LIST = new GenericType<>() { };

    private final MnemoClientBuilder<?> builder;

    AbstractMnemoClient(MnemoClientBuilder<?> builder) {
        this.builder = builder;
    }

    /** Runs {@code call} against a freshly configured JAX-RS client after validating the builder settings. */
    <T> T withTarget(TargetCall<T> call) throws MnemoClientException {
        boolean hasClient = !(isBlank(builder.clientId()) && isBlank(builder.clientSecret()));
        if (hasClient && !isBlank(builder.apiKey())) {
            throw invalid("set either apiKey or clientCredentials, not both");
        }
        if (hasClient && (isBlank(builder.clientId()) || isBlank(builder.clientSecret()))) {
            throw invalid("clientCredentials needs both a client id and a client secret");
        }
        if (!hasClient && isBlank(builder.apiKey())) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.MISSING_API_KEY, null));
        }
        if (isBlank(builder.baseUrl())) {
            throw invalid("baseUrl is required");
        }
        if (builder.timeout() == null || builder.timeout().isNegative()) {
            throw invalid("timeout must be zero or positive");
        }
        try (Client client = newClient()) {
            return call.run(client.target(builder.baseUrl()));
        } catch (ProcessingException e) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.IO_ERROR, null), e);
        }
    }

    private Client newClient() {
        long millis = builder.timeout().toMillis();
        // RESTEasy is built directly, not found through ClientBuilder.newBuilder(): that picks whichever JAX-RS implementation
        // comes first on the application's classpath, and with Jersey it cannot send PATCH (RENAME_SESSION,
        // UPDATE_SUBJECT_DESCRIPTION). The class is in an "internal" package but has a public constructor and is
        // the documented way to instantiate RESTEasy's client directly.
        return new ResteasyClientBuilderImpl()
                .connectTimeout(millis, TimeUnit.MILLISECONDS)
                .readTimeout(millis, TimeUnit.MILLISECONDS)
                .register(new MnemoObjectMapperProvider())
                .build();
    }

    /** Adds the credentials to a request: the API key header, or the bearer token of the OAuth client. */
    private Invocation.Builder authorize(Invocation.Builder request, boolean replaceToken) throws MnemoClientException {
        return isBlank(builder.clientId())
                ? request.header(TOKEN_HEADER, builder.apiKey())
                : request.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken(replaceToken));
    }

    /**
     * Returns the cached bearer token, fetching one first when there is none, it is about to expire, or
     * {@code replace} is set. The token lives on the builder, which every call of this client shares.
     */
    private String accessToken(boolean replace) throws MnemoClientException {
        synchronized (builder) {
            String cached = replace ? null : builder.cachedToken(System.nanoTime(), TOKEN_REFRESH_MARGIN.toNanos());
            return cached != null ? cached : fetchToken();
        }
    }

    private String fetchToken() throws MnemoClientException {
        String credentials = URLEncoder.encode(builder.clientId(), StandardCharsets.UTF_8) + ":"
                + URLEncoder.encode(builder.clientSecret(), StandardCharsets.UTF_8);
        try (Client client = newClient();
             Response response = client.target(builder.baseUrl()).path("oauth/token").request(MediaType.APPLICATION_JSON)
                     .header(HttpHeaders.AUTHORIZATION, "Basic "
                             + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8)))
                     .post(Entity.form(new Form("grant_type", "client_credentials")))) {
            if (response.getStatus() >= 400) {
                throw failure(response.getStatus(), response);
            }
            Map<String, Object> reply = response.readEntity(MAP);
            if (!(reply.get("access_token") instanceof String accessToken)
                    || !(reply.get("expires_in") instanceof Number expiresIn)) {
                throw new MnemoClientException(new MnemoError(MnemoError.Code.SERIALIZATION_ERROR, null));
            }
            builder.cacheToken(accessToken, System.nanoTime() + TimeUnit.SECONDS.toNanos(expiresIn.longValue()));
            return accessToken;
        } catch (ProcessingException e) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.SERIALIZATION_ERROR, null), e);
        }
    }

    /** Whether a failure means the cached bearer token should be replaced and the call tried once more. */
    private boolean tokenRejected(MnemoClientException e) {
        return !isBlank(builder.clientId()) && e.getHttpStatus() == 401;
    }

    /** Sends one request and maps the response; a {@code null} {@code type} or an empty body yields {@code null}. */
    <T> T send(String method, WebTarget target, Object body, GenericType<T> type) throws MnemoClientException {
        try {
            return attempt(method, target, body, type, false);
        } catch (MnemoClientException e) {
            if (!tokenRejected(e)) {
                throw e;
            }
        }
        // the cached token was revoked or its client was rotated: fetch a new one and try once more
        return attempt(method, target, body, type, true);
    }

    private <T> T attempt(String method, WebTarget target, Object body, GenericType<T> type, boolean replaceToken)
            throws MnemoClientException {
        Invocation.Builder request = authorize(target.request(MediaType.APPLICATION_JSON), replaceToken);
        Invocation invocation = body == null ? request.build(method) : request.build(method, Entity.json(body));
        try (Response response = invocation.invoke()) {
            int status = response.getStatus();
            if (status >= 400) {
                throw failure(status, response);
            }
            if (type == null || status == 204 || !response.hasEntity()) {
                return null;
            }
            try {
                return response.readEntity(type);
            } catch (ProcessingException e) {
                throw new MnemoClientException(new MnemoError(MnemoError.Code.SERIALIZATION_ERROR, null), e);
            }
        }
    }

    /**
     * Sends one request that answers with a server-sent event stream and reads the stream to its end.
     * The stream is finite for the calls that use this (it ends after a final event), so it is read whole.
     */
    List<SseEvent> sendEventStream(String method, WebTarget target, Object body) throws MnemoClientException {
        try {
            return attemptEventStream(method, target, body, false);
        } catch (MnemoClientException e) {
            if (!tokenRejected(e)) {
                throw e;
            }
        }
        return attemptEventStream(method, target, body, true);
    }

    private List<SseEvent> attemptEventStream(String method, WebTarget target, Object body, boolean replaceToken)
            throws MnemoClientException {
        Invocation invocation = authorize(target.request(MediaType.SERVER_SENT_EVENTS), replaceToken)
                .build(method, Entity.json(body));
        try (Response response = invocation.invoke()) {
            if (response.getStatus() >= 400) {
                throw failure(response.getStatus(), response);
            }
            return parseEvents(response.hasEntity() ? response.readEntity(String.class) : "");
        }
    }

    /** One server-sent event: its name ({@code message} when none was given) and its data. */
    record SseEvent(String name, String data) { }

    static List<SseEvent> parseEvents(String text) {
        List<SseEvent> events = new ArrayList<>();
        String name = null;
        StringBuilder data = new StringBuilder();
        boolean open = false;
        for (String line : text.split("\r?\n", -1)) {
            if (line.isEmpty()) {
                if (open) {
                    events.add(new SseEvent(name == null ? "message" : name, data.toString()));
                }
                name = null;
                data.setLength(0);
                open = false;
            } else if (!line.startsWith(":")) {
                int colon = line.indexOf(':');
                String field = colon < 0 ? line : line.substring(0, colon);
                String value = colon < 0 ? "" : line.substring(colon + 1);
                if (value.startsWith(" ")) {
                    value = value.substring(1);
                }
                if (field.equals("event")) {
                    name = value;
                    open = true;
                } else if (field.equals("data")) {
                    if (data.length() > 0) {
                        data.append('\n');
                    }
                    data.append(value);
                    open = true;
                }
            }
        }
        if (open) {
            events.add(new SseEvent(name == null ? "message" : name, data.toString()));
        }
        return events;
    }

    private static MnemoClientException failure(int status, Response response) {
        MnemoError.Code code;
        if (status == 401) code = MnemoError.Code.UNAUTHORIZED;
        else if (status == 403) code = MnemoError.Code.FORBIDDEN;
        else if (status == 404) code = MnemoError.Code.NOT_FOUND;
        else if (status == 429) code = MnemoError.Code.RATE_LIMITED;
        else if (status >= 500) code = MnemoError.Code.SERVER_ERROR;
        else code = MnemoError.Code.INVALID_REQUEST;
        String detail = null;
        try {
            if (response.hasEntity()) {
                Object error = response.readEntity(MAP).get("error");
                detail = error == null ? null : error.toString();
            }
        } catch (RuntimeException ignored) {
            // the body was not the usual {"error": "..."} JSON; fall back to the code's default message
        }
        // the detail travels as a format argument so a '%' inside server text is never re-interpreted
        MnemoError error = detail == null
                ? new MnemoError(code, null)
                : new MnemoError(code, "%s", detail);
        return new MnemoClientException(error, status);
    }

    static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    static String require(String value, String name) throws MnemoClientException {
        if (isBlank(value)) {
            throw invalid(name + " is required");
        }
        return value;
    }

    static MnemoClientException invalid(String message) {
        return new MnemoClientException(new MnemoError(MnemoError.Code.INVALID_REQUEST, "%s", message));
    }

    /** Builds a body map that skips null values, so only the parameters the caller set are sent. */
    static Map<String, Object> body(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            if (keyValues[i + 1] != null) {
                map.put((String) keyValues[i], keyValues[i + 1]);
            }
        }
        return map;
    }

    /** Adds the query parameters whose value is non-null; JAX-RS rejects null query values. */
    static WebTarget query(WebTarget target, Object... keyValues) {
        for (int i = 0; i < keyValues.length; i += 2) {
            if (keyValues[i + 1] != null) {
                target = target.queryParam((String) keyValues[i], keyValues[i + 1]);
            }
        }
        return target;
    }

    String tenantId() {
        return builder.tenantId();
    }

    @FunctionalInterface
    interface TargetCall<T> {
        T run(WebTarget base) throws MnemoClientException;
    }
}
