"""The model call's guardrails.

The provider is asked for exactly one structured answer through exactly one tool. These tests
assert the request shape rather than the response quality: a call that forgets forced tool choice
or sends a parameter the model family rejects fails in production, not in review.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from gi_ai.model import (
    DEFAULT_MODEL,
    MAX_TOKENS,
    ModelOutputError,
    ModelRefusalError,
    generate_assessment,
    model_id,
)
from gi_ai.prompt import TOOL_NAME
from tests.test_prompt import make_request

ASSESSMENT = {"case_id": "case-1", "differential_assessment": []}


class RecordingClient:
    """Captures the request instead of sending it."""

    def __init__(self, response) -> None:
        self.response = response
        self.calls: list[dict] = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        return self.response


def tool_use_response(payload=ASSESSMENT, name=TOOL_NAME, model="claude-opus-5-20260101"):
    return SimpleNamespace(
        stop_reason="tool_use",
        stop_details=None,
        # The response names the snapshot that answered, which is what gets stored — an alias can
        # resolve to a different one than the caller asked for.
        model=model,
        content=[SimpleNamespace(type="tool_use", name=name, input=payload)],
    )


class TestRequestShape:
    def test_forces_the_tool_so_prose_is_not_an_option(self):
        client = RecordingClient(tool_use_response())
        generate_assessment(make_request(), [], client=client)

        choice = client.calls[0]["tool_choice"]
        assert choice["type"] == "tool"
        assert choice["name"] == TOOL_NAME

    def test_disables_parallel_tool_use_so_there_is_one_assessment(self):
        client = RecordingClient(tool_use_response())
        generate_assessment(make_request(), [], client=client)
        assert client.calls[0]["tool_choice"]["disable_parallel_tool_use"] is True

    def test_marks_the_tool_strict_so_the_provider_enforces_the_schema(self):
        client = RecordingClient(tool_use_response())
        generate_assessment(make_request(), [], client=client)

        tool = client.calls[0]["tools"][0]
        assert tool["strict"] is True
        assert tool["name"] == TOOL_NAME

    def test_passes_the_schema_the_caller_generated_rather_than_one_of_its_own(self):
        request = make_request()
        request.outputSchema = {"type": "object", "additionalProperties": False, "marker": True}
        client = RecordingClient(tool_use_response())
        generate_assessment(request, [], client=client)

        assert client.calls[0]["tools"][0]["input_schema"] == request.outputSchema

    def test_uses_adaptive_thinking_at_high_effort(self):
        client = RecordingClient(tool_use_response())
        generate_assessment(make_request(), [], client=client)

        assert client.calls[0]["thinking"] == {"type": "adaptive"}
        assert client.calls[0]["output_config"] == {"effort": "high"}

    def test_sends_no_temperature_or_budget_tokens(self):
        # Both were removed on the Claude 5 family; sending either returns a 400.
        client = RecordingClient(tool_use_response())
        generate_assessment(make_request(), [], client=client)

        call = client.calls[0]
        assert "temperature" not in call
        assert "top_p" not in call
        assert "top_k" not in call
        assert "budget_tokens" not in str(call.get("thinking"))

    def test_defaults_to_opus_5(self):
        assert DEFAULT_MODEL == "claude-opus-5"
        assert model_id() == "claude-opus-5"

    def test_model_is_overridable_by_deployment(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_MODEL", "claude-sonnet-5")
        assert model_id() == "claude-sonnet-5"

    def test_leaves_room_for_a_full_assessment(self):
        client = RecordingClient(tool_use_response())
        generate_assessment(make_request(), [], client=client)
        assert client.calls[0]["max_tokens"] == MAX_TOKENS
        assert MAX_TOKENS >= 8000

    def test_sends_the_system_prompt_and_one_user_message(self):
        client = RecordingClient(tool_use_response())
        generate_assessment(make_request(), ["grounding chunk"], client=client)

        call = client.calls[0]
        assert "Registered Medical Practitioner" in call["system"]
        assert len(call["messages"]) == 1
        assert call["messages"][0]["role"] == "user"
        assert "grounding chunk" in call["messages"][0]["content"]


class TestResponseHandling:
    def test_returns_the_tool_input_verbatim(self):
        client = RecordingClient(tool_use_response({"case_id": "case-1", "extra": "kept"}))
        result, _ = generate_assessment(make_request(), [], client=client)
        # Nothing is cleaned here: the caller validates against the authoritative schema, and
        # quietly dropping a field would hide exactly what that validation exists to catch.
        assert result == {"case_id": "case-1", "extra": "kept"}

    def test_parses_a_tool_input_that_arrives_as_a_string(self):
        client = RecordingClient(tool_use_response('{"case_id": "case-1"}'))
        result, _ = generate_assessment(make_request(), [], client=client)
        assert result == {"case_id": "case-1"}

    def test_reports_the_snapshot_that_answered_not_the_alias_requested(self):
        # What gets stored against the case and shown as a version pin. Reading it back off the
        # response is the only way it describes what actually produced the assessment.
        client = RecordingClient(tool_use_response(model="claude-opus-5-20260101"))
        _, served = generate_assessment(make_request(), [], client=client)
        assert served == "claude-opus-5-20260101"

    def test_raises_when_the_model_answers_without_calling_the_tool(self):
        response = SimpleNamespace(
            stop_reason="end_turn",
            stop_details=None,
            content=[SimpleNamespace(type="text", text="I think this is an ulcer.")],
        )
        with pytest.raises(ModelOutputError, match="never called"):
            generate_assessment(make_request(), [], client=RecordingClient(response))

    def test_ignores_a_tool_call_with_a_different_name(self):
        client = RecordingClient(tool_use_response(name="something_else"))
        with pytest.raises(ModelOutputError):
            generate_assessment(make_request(), [], client=client)

    def test_surfaces_a_refusal_rather_than_retrying_it(self):
        response = SimpleNamespace(
            stop_reason="refusal",
            stop_details=SimpleNamespace(category="bio", explanation="declined"),
            content=[],
        )
        with pytest.raises(ModelRefusalError) as raised:
            generate_assessment(make_request(), [], client=RecordingClient(response))

        assert raised.value.category == "bio"

    def test_checks_stop_reason_before_reading_content(self):
        # A refusal arrives as HTTP 200 with empty content; reading content first would return
        # a confusing "no tool call" error instead of the real reason.
        response = SimpleNamespace(stop_reason="refusal", stop_details=None, content=[])
        with pytest.raises(ModelRefusalError):
            generate_assessment(make_request(), [], client=RecordingClient(response))
