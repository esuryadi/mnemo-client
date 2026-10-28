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
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.apache.commons.lang3.StringUtils;

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

    static final GenericType<Map<String, Object>> MAP = new GenericType<>() { };
    static final GenericType<List<Map<String, Object>>> LIST = new GenericType<>() { };

    private final MnemoClientBuilder<?> builder;

    AbstractMnemoClient(MnemoClientBuilder<?> builder) {
        this.builder = builder;
    }

    /** Runs {@code call} against a freshly configured JAX-RS client after validating the builder settings. */
    <T> T withTarget(TargetCall<T> call) throws MnemoClientException {
        if (StringUtils.isBlank(builder.apiKey())) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.MISSING_API_KEY, null));
        }
        if (StringUtils.isBlank(builder.baseUrl())) {
            throw invalid("baseUrl is required");
        }
        long millis = builder.timeout().toMillis();
        try (Client client = ClientBuilder.newBuilder()
                .connectTimeout(millis, TimeUnit.MILLISECONDS)
                .readTimeout(millis, TimeUnit.MILLISECONDS)
                .register(new MnemoObjectMapperProvider())
                .build()) {
            return call.run(client.target(builder.baseUrl()));
        } catch (ProcessingException e) {
            throw new MnemoClientException(new MnemoError(MnemoError.Code.IO_ERROR, null), e);
        }
    }

    /** Sends one request and maps the response; a {@code null} {@code type} or an empty body yields {@code null}. */
    <T> T send(String method, WebTarget target, Object body, GenericType<T> type) throws MnemoClientException {
        Invocation.Builder request = target.request(MediaType.APPLICATION_JSON).header(TOKEN_HEADER, builder.apiKey());
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

    static String require(String value, String name) throws MnemoClientException {
        if (StringUtils.isBlank(value)) {
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
