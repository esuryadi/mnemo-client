# Copyright (c) 2026, PANAXON.AI, LLC. All rights reserved.
# DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Multi-Dimensional Neural Elastic Memory Organization (MNEMO) - Python client.
#
# Inventor: Edward Suryadi
# Assignee: PANAXON.AI, LLC
#
# Author: edward.suryadi
# Since: Oct-2026

"""Tests for MnemoChatClient and the shared plumbing."""

from __future__ import annotations

import json

from mnemo_client import ChatMessageResponse, MnemoChatClient, MnemoClientException, MnemoClientFactory, MnemoError
from mnemo_client._abstract import TOKEN_HEADER, SseEvent, parse_events

from fake_server import FakeMnemoServer, FakeServerTestCase

Op = MnemoChatClient.Operation
Code = MnemoError.Code

INIT_STREAM = (
    "\n\n"
    'event: init-stage\ndata: {"stage":"load-subjects","status":"start","elapsedMs":0,"message":"Loading"}\n\n'
    'event: init-stage\ndata: {"stage":"load-subjects","status":"finish","elapsedMs":42,"message":"Loaded 2"}\n\n'
    'event: complete\ndata: {"tenantId":"acme","sessionId":"s1","status":"complete","totalMs":50,'
    '"message":"Initialization complete. Chat is ready."}\n\n'
    "event: done\ndata: \n\n"
)


class MnemoChatClientTest(FakeServerTestCase):

    def builder(self) -> MnemoChatClient.Builder:
        return MnemoChatClient.Builder().api_key("tok-1").base_url(self.server.url()).tenant_id("acme")

    def test_chat_posts_request_and_parses_reply(self) -> None:
        self.server.reply(200, """{"tenantId":"acme","sessionId":"s1","id":"m1","message":"You had pasta.",
            "attachments":[{"subject":"Meals","mimeType":"text/plain"}],"timestamp":1700000000000,
            "timing":{"memoryOperationMs":5,"llmPostprocessMs":7,"totalMs":12},"sessionName":"Meals",
            "reasoningTrace":null,"quotaWarning":null,"tokenUsage":{"inputTokens":10,"outputTokens":4},
            "someFutureField":true}""")

        reply = self.builder().session_id("s1").message("What did I eat?").build().execute()

        self.assertIsInstance(reply, ChatMessageResponse)
        self.assertEqual("You had pasta.", reply.message)
        self.assertEqual(12, reply.timing.total_ms)
        self.assertEqual(4, reply.token_usage.output_tokens)
        self.assertEqual("text/plain", reply.attachments[0].mime_type)
        r = self.server.last()
        self.assertEqual("POST", r.method)
        self.assertEqual("/mnemo/chat", r.path)
        self.assertEqual("tok-1", r.token)
        self.assertEqual({"tenantId": "acme", "sessionId": "s1", "message": "What did I eat?"}, json.loads(r.body))

    def test_uses_the_documented_token_header(self) -> None:
        self.assertEqual("X-Mnemo-Api-Token", TOKEN_HEADER)

    def test_missing_api_key_fails_before_any_request(self) -> None:
        e = self.rejection(lambda: MnemoChatClient.Builder().base_url(self.server.url()).tenant_id("acme")
                           .session_id("s").message("hi").build().execute())
        self.assertIs(Code.MISSING_API_KEY, e.error.code)
        self.assertEqual(0, self.server.count())

    def test_missing_required_parameter_names_the_field(self) -> None:
        e = self.rejection(lambda: self.builder().session_id("s1").build().execute())
        self.assertIs(Code.INVALID_REQUEST, e.error.code)
        self.assertIn("message", str(e))
        self.assertEqual(0, self.server.count())

    def test_service_errors_carry_status_and_server_message(self) -> None:
        self.server.reply(429, '{"error":"Daily quota 100% used"}')
        e = self.rejection(lambda: self.builder().session_id("s1").message("hi").build().execute())
        self.assertEqual(429, e.http_status)
        self.assertIs(Code.RATE_LIMITED, e.error.code)
        self.assertEqual("Daily quota 100% used", str(e))
        self.assertEqual("MNERR-0429", e.error.code.code)

    def test_uninitialized_session_409_is_an_invalid_request(self) -> None:
        self.server.reply(409, '{"error":"This session has not been initialized yet. Please call /init/stream first."}')
        e = self.rejection(lambda: self.builder().session_id("s1").message("hi").build().execute())
        self.assertEqual(409, e.http_status)
        self.assertIs(Code.INVALID_REQUEST, e.error.code)
        self.assertIn("not been initialized", e.message)

    def test_status_codes_map_to_error_codes(self) -> None:
        expected = {401: Code.UNAUTHORIZED, 403: Code.FORBIDDEN, 404: Code.NOT_FOUND, 500: Code.SERVER_ERROR,
                    400: Code.INVALID_REQUEST}
        for status, code in expected.items():
            with self.subTest(status=status):
                self.server.reply(status, "not json")
                e = self.rejection(lambda: self.builder().operation(Op.GET_PLAN).build().execute())
                self.assertIs(code, e.error.code)
                self.assertEqual(status, e.http_status)
                self.assertEqual(code.default_message, e.message)

    def test_unreachable_service_is_an_io_error(self) -> None:
        client = self.builder().session_id("s").message("hi").build()
        self.server.close()
        e = self.rejection(client.execute)
        self.assertIs(Code.IO_ERROR, e.error.code)
        self.assertEqual(0, e.http_status)
        self.server = FakeMnemoServer()

    def test_a_reply_that_is_not_json_is_a_serialization_error(self) -> None:
        self.server.reply(200, "<html>oops</html>", "text/html")
        e = self.rejection(lambda: self.builder().operation(Op.GET_PLAN).build().execute())
        self.assertIs(Code.SERIALIZATION_ERROR, e.error.code)

    def test_a_reply_of_the_wrong_shape_is_a_serialization_error(self) -> None:
        self.server.reply(200, '["not", "a", "message"]')
        e = self.rejection(lambda: self.builder().session_id("s1").message("hi").build().execute())
        self.assertIs(Code.SERIALIZATION_ERROR, e.error.code)

    def test_list_subjects_returns_a_list(self) -> None:
        self.server.reply(200, '[{"name":"Meals"},{"name":"Travel"}]')
        subjects = self.builder().operation(Op.LIST_SUBJECTS).build().execute()
        self.assertEqual(2, len(subjects))
        self.assertEqual("Travel", subjects[1]["name"])
        self.assertEqual("GET", self.server.last().method)
        self.assertEqual("tenantId=acme", self.server.last().query)

    def test_list_sessions_sends_only_parameters_that_were_set(self) -> None:
        self.server.reply(200, '{"content":[],"totalElements":0}')
        page = self.builder().operation(Op.LIST_SESSIONS).query("trip").size(10).build().execute()
        self.assertEqual(0, page["totalElements"])
        self.assertEqual("/mnemo/sessions", self.server.last().path)
        self.assertEqual("tenantId=acme&q=trip&size=10", self.server.last().query)

    def test_query_values_are_percent_encoded(self) -> None:
        self.server.reply(200, "{}")
        self.builder().operation(Op.LIST_SESSIONS).query("my trip & more").build().execute()
        self.assertEqual("tenantId=acme&q=my%20trip%20%26%20more", self.server.last().query)

    def test_delete_subject_encodes_name_and_returns_none_on_204(self) -> None:
        self.server.reply(204, "")
        result = self.builder().operation(Op.DELETE_SUBJECT).subject_name("Q3 plan/2026").build().execute()
        self.assertIsNone(result)
        self.assertEqual("DELETE", self.server.last().method)
        self.assertEqual("/mnemo/subject/Q3%20plan%2F2026", self.server.last().raw_path)

    def test_rename_session_uses_patch(self) -> None:
        self.server.reply(200, '{"sessionName":"Trip"}')
        result = self.builder().operation(Op.RENAME_SESSION).session_id("s1").session_name("Trip").build().execute()
        self.assertEqual("Trip", result["sessionName"])
        self.assertEqual("PATCH", self.server.last().method)
        self.assertEqual("/mnemo/sessions/s1/name", self.server.last().path)
        self.assertEqual({"tenantId": "acme", "sessionName": "Trip"}, json.loads(self.server.last().body))

    def test_close_session_always_passes_the_permanent_flag_in_lower_case(self) -> None:
        self.server.reply(204, "")
        self.builder().operation(Op.CLOSE_SESSION).session_id("s1").permanent(True).build().execute()
        self.assertEqual("tenantId=acme&permanent=true", self.server.last().query)
        self.builder().operation(Op.CLOSE_SESSION).session_id("s1").build().execute()
        self.assertEqual("tenantId=acme&permanent=false", self.server.last().query)

    def test_history_passes_the_cursor(self) -> None:
        self.server.reply(200, '{"messages":[]}')
        self.builder().operation(Op.GET_HISTORY).session_id("s1").before(99).size(5).build().execute()
        self.assertEqual("/mnemo/sessions/s1/history", self.server.last().path)
        self.assertEqual("tenantId=acme&before=99&size=5", self.server.last().query)

    def test_health_needs_no_tenant(self) -> None:
        self.server.reply(200, '{"status":"UP"}')
        health = MnemoChatClient.Builder().api_key("k").base_url(self.server.url()) \
            .operation(Op.HEALTH).build().execute()
        self.assertEqual("UP", health["status"])

    def test_a_trailing_slash_on_the_base_url_is_tolerated(self) -> None:
        self.server.reply(200, '{"status":"UP"}')
        MnemoChatClient.Builder().api_key("k").base_url(self.server.url() + "/").operation(Op.HEALTH).build().execute()
        self.assertEqual("/mnemo/health", self.server.last().path)

    def test_init_session_reads_the_event_stream_and_reports_ready(self) -> None:
        self.server.reply(200, INIT_STREAM, "text/event-stream")

        result = self.builder().operation(Op.INIT_SESSION).session_id("s1").session_name("My session") \
            .build().execute()

        self.assertIs(True, result["ready"])
        self.assertEqual("Initialization complete. Chat is ready.", result["message"])
        self.assertEqual(50, result["totalMs"])
        self.assertEqual(2, len(result["stages"]))
        self.assertEqual("finish", result["stages"][1]["status"])
        r = self.server.last()
        self.assertEqual("POST", r.method)
        self.assertEqual("/mnemo/init/stream", r.path)
        self.assertEqual("text/event-stream", r.accept)
        self.assertEqual("tok-1", r.token)
        self.assertEqual({"tenantId": "acme", "sessionId": "s1", "sessionName": "My session"}, json.loads(r.body))

    def test_init_error_event_becomes_an_exception(self) -> None:
        self.server.reply(200, 'event: error\ndata: {"error":"Access denied: token does not belong to tenantId=x"}\n\n'
                               "event: done\ndata: \n\n", "text/event-stream")
        e = self.rejection(lambda: self.builder().operation(Op.INIT_SESSION).session_id("s1").build().execute())
        self.assertIs(Code.INIT_FAILED, e.error.code)
        self.assertEqual("Access denied: token does not belong to tenantId=x", str(e))

    def test_init_stream_that_ends_without_completing_is_an_error(self) -> None:
        self.server.reply(200, 'event: init-stage\ndata: {"stage":"load-subjects","status":"start"}\n\n',
                          "text/event-stream")
        e = self.rejection(lambda: self.builder().operation(Op.INIT_SESSION).session_id("s1").build().execute())
        self.assertIs(Code.INIT_FAILED, e.error.code)

    def test_init_http_error_carries_the_status(self) -> None:
        self.server.reply(401, '{"error":"Invalid or revoked API token."}')
        e = self.rejection(lambda: self.builder().operation(Op.INIT_SESSION).session_id("s1").build().execute())
        self.assertIs(Code.UNAUTHORIZED, e.error.code)
        self.assertEqual(401, e.http_status)

    def test_init_session_needs_a_session_id(self) -> None:
        e = self.rejection(lambda: self.builder().operation(Op.INIT_SESSION).build().execute())
        self.assertIn("session_id", str(e))
        self.assertEqual(0, self.server.count())

    def test_event_parser_handles_comments_crlf_and_multi_line_data(self) -> None:
        events = parse_events(": keep-alive\r\n\r\nevent: a\r\ndata: one\r\ndata: two\r\n\r\ndata: bare\n")
        self.assertEqual([SseEvent("a", "one\ntwo"), SseEvent("message", "bare")], events)

    def test_a_client_can_be_executed_more_than_once(self) -> None:
        self.server.reply(200, '{"status":"UP"}')
        client = MnemoChatClient.Builder().api_key("k").base_url(self.server.url()).operation(Op.HEALTH).build()
        client.execute()
        client.execute()
        self.assertEqual(2, self.server.count())

    def test_factory_rejects_none_and_builds_a_client(self) -> None:
        with self.assertRaises(MnemoClientException):
            MnemoClientFactory.create(None)
        self.assertIsInstance(MnemoClientFactory.create(self.builder()), MnemoChatClient)
