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


"""Tests for MnemoChatClient.Operation.CHAT_STREAM."""

from __future__ import annotations

import json
from typing import List

from mnemo_client import MnemoChatClient, MnemoError, StreamEvent
from mnemo_client._abstract import SseEvent, SseParser

from fake_server import FakeServerTestCase

Code = MnemoError.Code
STREAM = (": hello\n\n"
          'event: token\ndata: {"text":"Hel"}\n\n'
          'event: token\ndata: {"text":"lo"}\n\n'
          'event: complete\ndata: {"message":"Hello"}\n\n'
          "event: done\ndata: \n\n")


class MnemoChatStreamTest(FakeServerTestCase):

    def builder(self) -> MnemoChatClient.Builder:
        return MnemoChatClient.Builder().api_key("tok-1").base_url(self.server.url()).tenant_id("acme") \
            .operation(MnemoChatClient.Operation.CHAT_STREAM).session_id("s1").message("hi")

    def test_posts_the_json_body_and_hands_over_every_event_in_order(self) -> None:
        self.server.reply(200, STREAM, "text/event-stream")

        events = list(self.builder().role("user").answer_from_job_text("job-7").build().execute())

        self.assertEqual([StreamEvent("token", '{"text":"Hel"}'), StreamEvent("token", '{"text":"lo"}'),
                          StreamEvent("complete", '{"message":"Hello"}'), StreamEvent("done", "")], events)
        r = self.server.last()
        self.assertEqual("POST", r.method)
        self.assertEqual("/mnemo/chat/stream", r.path)
        self.assertIsNone(r.query)
        self.assertEqual("text/event-stream", r.accept)
        self.assertEqual("tok-1", r.token)
        self.assertEqual({"tenantId": "acme", "sessionId": "s1", "message": "hi", "role": "user",
                          "answerFromJobText": "job-7"}, json.loads(r.body))

    def test_optional_fields_are_omitted_when_not_set(self) -> None:
        self.server.reply(200, STREAM, "text/event-stream")
        list(self.builder().build().execute())
        self.assertEqual({"tenantId": "acme", "sessionId": "s1", "message": "hi"}, json.loads(self.server.last().body))

    def test_an_error_event_is_passed_on_like_any_other(self) -> None:
        self.server.reply(200, 'event: error\ndata: {"error":"boom"}\n\n', "text/event-stream")
        self.assertEqual([StreamEvent("error", '{"error":"boom"}')], list(self.builder().build().execute()))

    def test_an_event_without_a_name_is_a_message(self) -> None:
        self.server.reply(200, "data: plain\n\n", "text/event-stream")
        self.assertEqual([StreamEvent("message", "plain")], list(self.builder().build().execute()))

    def test_an_http_error_carries_the_status_and_no_event_is_delivered(self) -> None:
        self.server.reply(409, '{"error":"session not initialized"}')
        events: List[StreamEvent] = []
        e = self.rejection(lambda: events.extend(self.builder().build().execute()))
        self.assertIs(Code.INVALID_REQUEST, e.error.code)
        self.assertEqual(409, e.http_status)
        self.assertEqual([], events)

    def test_validates_before_sending(self) -> None:
        for b in (self.builder().tenant_id(None), self.builder().session_id(None),  # type: ignore[arg-type]
                  self.builder().message(None)):  # type: ignore[arg-type]
            e = self.rejection(b.build().execute)
            self.assertIs(Code.INVALID_REQUEST, e.error.code)
        self.assertEqual(0, self.server.count())

    def test_event_parser_hands_over_events_as_the_lines_arrive(self) -> None:
        parser = SseParser()
        self.assertIsNone(parser.line("event: a"))
        self.assertIsNone(parser.line("data: one"))
        self.assertEqual(SseEvent("a", "one"), parser.line(""))
        self.assertIsNone(parser.line("data: tail"))
        self.assertEqual(SseEvent("message", "tail"), parser.finish())
        self.assertIsNone(parser.finish())
