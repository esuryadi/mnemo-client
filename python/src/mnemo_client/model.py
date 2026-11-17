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

"""Typed responses for the core calls (chat, RAG, settings).

Attribute names are the snake_case form of the service's JSON fields. Fields this client does not know about are
ignored and missing ones take their default, so a newer service never breaks an older client.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


def _instant(value: Any) -> Optional[datetime]:
    """Parses an ISO-8601 timestamp; ``fromisoformat`` only accepts a trailing ``Z`` from Python 3.11."""
    if value is None:
        return None
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    # fromisoformat (before 3.11) takes only 3 or 6 fractional digits; the service sends up to 9 (nanoseconds).
    text = re.sub(r"\.(\d+)", lambda m: "." + m.group(1)[:6].ljust(6, "0"), text, count=1)
    return datetime.fromisoformat(text)


@dataclass(frozen=True)
class TokenUsage:
    """Input and output token counts consumed by an LLM call."""

    input_tokens: int = 0
    output_tokens: int = 0

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> Optional[TokenUsage]:
        if data is None:
            return None
        return cls(input_tokens=data.get("inputTokens") or 0, output_tokens=data.get("outputTokens") or 0)


@dataclass(frozen=True)
class ResponseTiming:
    """Server-side timing of a chat response, in milliseconds."""

    memory_operation_ms: int = 0
    llm_postprocess_ms: int = 0
    total_ms: int = 0

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> Optional[ResponseTiming]:
        if data is None:
            return None
        return cls(memory_operation_ms=data.get("memoryOperationMs") or 0,
                   llm_postprocess_ms=data.get("llmPostprocessMs") or 0,
                   total_ms=data.get("totalMs") or 0)


@dataclass(frozen=True)
class Attachment:
    """A file or knowledge item returned alongside a chat message."""

    subject: Optional[str] = None
    content: Optional[str] = None
    mime_type: Optional[str] = None
    file_name: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Attachment:
        return cls(subject=data.get("subject"), content=data.get("content"),
                   mime_type=data.get("mimeType"), file_name=data.get("fileName"))


@dataclass(frozen=True)
class Groundedness:
    """The opt-in groundedness check's result for one answer: whether the stored text supports it (not that the answer or the data is true).

    ``verdict`` is GROUNDED, PARTIAL or UNVERIFIED; ``notice`` is the sentence to show for the last two; ``follow_up`` and
    ``follow_up_text`` are only on a streamed chat reply. Strings, so a value added later does not break an older client.
    """

    score: float = 0.0
    verdict: Optional[str] = None
    reason: Optional[str] = None
    unsupported_claims: List[str] = field(default_factory=list)
    notice: Optional[str] = None
    follow_up: Optional[str] = None
    follow_up_text: Optional[str] = None
    truncated: bool = False

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> Optional[Groundedness]:
        if data is None:
            return None
        return cls(score=float(data.get("score") or 0.0), verdict=data.get("verdict"), reason=data.get("reason"),
                   unsupported_claims=list(data.get("unsupportedClaims") or []), notice=data.get("notice"),
                   follow_up=data.get("followUp"), follow_up_text=data.get("followUpText"),
                   truncated=bool(data.get("truncated")))


@dataclass(frozen=True)
class ChatMessageResponse:
    """The assistant reply to a chat message (result of ``MnemoChatClient.Operation.CHAT``)."""

    tenant_id: Optional[str] = None
    session_id: Optional[str] = None
    id: Optional[str] = None
    message: Optional[str] = None
    attachments: Optional[List[Attachment]] = None
    timestamp: int = 0
    timing: Optional[ResponseTiming] = None
    session_name: Optional[str] = None
    reasoning_trace: Optional[str] = None
    quota_warning: Optional[str] = None
    token_usage: Optional[TokenUsage] = None
    # Additive, None when the server did not send them. reason/explanation: why a plain not-found is one. source/authority/confidence
    # (high, medium or low): where an answer built from stored data came from. groundedness: the opt-in check's result.
    reason: Optional[str] = None
    source: Optional[str] = None
    authority: Optional[str] = None
    confidence: Optional[str] = None
    explanation: Optional[str] = None
    groundedness: Optional[Groundedness] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ChatMessageResponse:
        attachments = data.get("attachments")
        return cls(tenant_id=data.get("tenantId"), session_id=data.get("sessionId"), id=data.get("id"),
                   message=data.get("message"),
                   attachments=None if attachments is None else [Attachment.from_dict(a) for a in attachments],
                   timestamp=data.get("timestamp") or 0, timing=ResponseTiming.from_dict(data.get("timing")),
                   session_name=data.get("sessionName"), reasoning_trace=data.get("reasoningTrace"),
                   quota_warning=data.get("quotaWarning"), token_usage=TokenUsage.from_dict(data.get("tokenUsage")),
                   reason=data.get("reason"), source=data.get("source"), authority=data.get("authority"),
                   confidence=data.get("confidence"), explanation=data.get("explanation"),
                   groundedness=Groundedness.from_dict(data.get("groundedness")))


@dataclass(frozen=True)
class RagQueryResponse:
    """The answer to a MnemoRAG query (result of ``MnemoRAGClient.Operation.QUERY``)."""

    answer: Optional[str] = None
    found: bool = False
    source: Optional[str] = None
    authority: Optional[str] = None
    confidence: Optional[str] = None
    last_updated: Optional[datetime] = None
    retrieval_tier: Optional[str] = None
    subjects_used: List[str] = field(default_factory=list)
    token_usage: Optional[TokenUsage] = None
    # Only on a not-found, when the server knows why: OUT_OF_SCOPE, NOT_IN_MEMORY, AMBIGUOUS_ENTITY, PARTIAL_MATCH,
    # INDEX_NOT_READY, UNVERIFIED_ANSWER, INCOMPLETE_DATA (STALE is reserved and never sent). A string, so a later code does not break an older client.
    reason: Optional[str] = None
    # The one plain sentence for ``reason``; present exactly when ``reason`` is.
    explanation: Optional[str] = None
    # Only for a configuration created with checkGroundedness on, a found answer the check ran on, and when it finished in time.
    # Such a configuration adds up to about 4 seconds to every response.
    groundedness: Optional[Groundedness] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> RagQueryResponse:
        return cls(answer=data.get("answer"), found=bool(data.get("found")), source=data.get("source"),
                   authority=data.get("authority"), confidence=data.get("confidence"),
                   last_updated=_instant(data.get("lastUpdated")), retrieval_tier=data.get("retrievalTier"),
                   subjects_used=list(data.get("subjectsUsed") or []),
                   token_usage=TokenUsage.from_dict(data.get("tokenUsage")), reason=data.get("reason"),
                   explanation=data.get("explanation"), groundedness=Groundedness.from_dict(data.get("groundedness")))


@dataclass(frozen=True)
class SettingsResponse:
    """An account's MNEMO settings. The provider API key is never returned, only whether one is stored."""

    account_id: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    ingest_model: Optional[str] = None
    has_api_key: bool = False
    lookback_days: int = 0
    encrypt_data: bool = False
    shared_memory_ttl_hours: int = 0
    updated_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SettingsResponse:
        return cls(account_id=data.get("accountId"), provider=data.get("provider"), model=data.get("model"),
                   ingest_model=data.get("ingestModel"), has_api_key=bool(data.get("hasApiKey")),
                   lookback_days=data.get("lookbackDays") or 0, encrypt_data=bool(data.get("encryptData")),
                   shared_memory_ttl_hours=data.get("sharedMemoryTtlHours") or 0,
                   updated_at=_instant(data.get("updatedAt")))


@dataclass(frozen=True)
class EmbedToken:
    """A short-lived token for the ``<mnemo-chat>`` component (result of ``MnemoEmbedClient.Operation.MINT_TOKEN``).

    It is safe to hand to one visitor's browser; the API key that minted it is not. ``session_prefix`` is what every
    session id used with the token must start with.
    """

    token: str
    expires_at: datetime
    tenant_id: Optional[str] = None
    session_prefix: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> EmbedToken:
        expires_at = _instant(data["expiresAt"])
        if not isinstance(data["token"], str) or not isinstance(data["sessionPrefix"], str) or expires_at is None:
            raise TypeError("malformed embed token")
        return cls(token=data["token"], expires_at=expires_at, tenant_id=data.get("tenantId"),
                   session_prefix=data["sessionPrefix"])


@dataclass(frozen=True)
class StreamEvent:
    """One server-sent event of a streamed call (``MnemoChatClient.Operation.CHAT_STREAM``): the event name
    (``message`` when the server gave none) and its data text, which is JSON for the MNEMO events."""

    event: str
    data: str
