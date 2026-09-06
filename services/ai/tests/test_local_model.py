"""The locally hosted model path.

Exercised against a stub server rather than a live llama.cpp, so these assertions are about the
request this service builds — which is where the safety property lives. Constrained decoding is
what replaces the hosted model's forced tool call, and a request that forgets to ask for it would
still look like it worked right up until a model returned prose.
"""

from __future__ import annotations

import json

import httpx
import pytest

from gi_ai import local_model, provider
from gi_ai.local_model import LocalModelError, context_budget_warning
from gi_ai.prompt import TOOL_NAME
from tests.test_prompt import make_request

ASSESSMENT = {"case_id": "case-1", "differential_assessment": []}


def stub_client(
    handler,
) -> httpx.Client:
    """An httpx client whose requests are answered in-process."""
    return httpx.Client(transport=httpx.MockTransport(handler))


def completion(
    content: object, status: int = 200, model: str = "qwen3-27b-q4_k_m"
) -> httpx.Response:
    body = content if isinstance(content, str) else json.dumps(content)
    return httpx.Response(
        status,
        json={
            # llama-server names what it actually loaded, regardless of what the request asked for.
            "model": model,
            "choices": [{"message": {"role": "assistant", "content": body}}],
        },
    )


class TestRequestShape:
    def capture(self, monkeypatch) -> list[dict]:
        captured: list[dict] = []

        def handler(request: httpx.Request) -> httpx.Response:
            captured.append(json.loads(request.content))
            return completion(ASSESSMENT)

        local_model.generate_assessment(make_request(), [], client=stub_client(handler))
        return captured

    def test_asks_for_constrained_decoding_against_the_caller_s_schema(self, monkeypatch):
        request = make_request()
        request.outputSchema = {"type": "object", "additionalProperties": False, "marker": True}

        captured: list[dict] = []

        def handler(http_request: httpx.Request) -> httpx.Response:
            captured.append(json.loads(http_request.content))
            return completion(ASSESSMENT)

        local_model.generate_assessment(request, [], client=stub_client(handler))

        response_format = captured[0]["response_format"]
        assert response_format["type"] == "json_schema"
        assert response_format["json_schema"]["strict"] is True
        # The schema the core application generated, not one invented here.
        assert response_format["json_schema"]["schema"] == request.outputSchema
        assert response_format["json_schema"]["name"] == TOOL_NAME

    def test_pins_sampling_low_so_a_rerun_does_not_change_the_differential(self, monkeypatch):
        captured = self.capture(monkeypatch)
        assert captured[0]["temperature"] <= 0.2

    def test_disables_the_reasoning_block_that_fights_constrained_decoding(self, monkeypatch):
        captured = self.capture(monkeypatch)
        assert captured[0]["chat_template_kwargs"]["enable_thinking"] is False

    def test_sends_the_system_prompt_and_the_case(self, monkeypatch):
        captured = self.capture(monkeypatch)
        messages = captured[0]["messages"]
        assert messages[0]["role"] == "system"
        assert "Registered Medical Practitioner" in messages[0]["content"]
        assert messages[1]["role"] == "user"
        assert "PERMITTED CONDITIONS" in messages[1]["content"]

    def test_posts_to_the_openai_compatible_endpoint(self, monkeypatch):
        seen: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(str(request.url))
            return completion(ASSESSMENT)

        monkeypatch.setenv("LLAMA_SERVER_URL", "http://127.0.0.1:9999/")
        local_model.generate_assessment(make_request(), [], client=stub_client(handler))
        # Trailing slash in configuration must not produce a doubled path.
        assert seen == ["http://127.0.0.1:9999/v1/chat/completions"]


class TestResponseHandling:
    def test_returns_the_structured_result_verbatim(self):
        payload = {"case_id": "case-1", "extra": "kept"}

        def handler(_: httpx.Request) -> httpx.Response:
            return completion(payload)

        result, _ = local_model.generate_assessment(
            make_request(), [], client=stub_client(handler)
        )
        # Not cleaned here: the caller validates against the authoritative schema, and quietly
        # dropping a field would hide what that validation exists to catch.
        assert result == payload

    def test_names_the_model_the_server_actually_served(self, monkeypatch):
        # The whole point. A stub answering on the configured port once produced summaries that
        # carried the real model's name, because the name came from configuration rather than from
        # whatever replied — so a doctor reading the version pins had no way to tell.
        monkeypatch.setenv("LOCAL_MODEL_NAME", "qwen3-27b-q4_k_m")

        def handler(_: httpx.Request) -> httpx.Response:
            return completion({"case_id": "case-1"}, model="stub-llama-server/not-a-real-model")

        _, served = local_model.generate_assessment(
            make_request(), [], client=stub_client(handler)
        )
        assert served == "stub-llama-server/not-a-real-model"

    def test_falls_back_to_the_configured_name_when_the_server_declines_to_say(self, monkeypatch):
        monkeypatch.setenv("LOCAL_MODEL_NAME", "qwen3-27b-q4_k_m")

        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": "{}"}}]},
            )

        _, served = local_model.generate_assessment(
            make_request(), [], client=stub_client(handler)
        )
        assert served == "qwen3-27b-q4_k_m"

    def test_reports_a_server_that_is_not_running_in_terms_an_operator_can_act_on(self):
        def handler(_: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        with pytest.raises(LocalModelError, match="Is it running"):
            local_model.generate_assessment(make_request(), [], client=stub_client(handler))

    def test_reports_a_non_json_completion_as_missing_constrained_decoding(self):
        def handler(_: httpx.Request) -> httpx.Response:
            return completion("I think this patient has an ulcer.")

        with pytest.raises(LocalModelError, match="constrained decoding"):
            local_model.generate_assessment(make_request(), [], client=stub_client(handler))

    def test_rejects_an_empty_completion(self):
        def handler(_: httpx.Request) -> httpx.Response:
            return completion("")

        with pytest.raises(LocalModelError, match="empty"):
            local_model.generate_assessment(make_request(), [], client=stub_client(handler))

    def test_surfaces_an_error_status_with_the_server_s_own_message(self):
        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(500, text="failed to load model")

        with pytest.raises(LocalModelError, match="failed to load model"):
            local_model.generate_assessment(make_request(), [], client=stub_client(handler))

    def test_rejects_json_that_is_not_an_object(self):
        def handler(_: httpx.Request) -> httpx.Response:
            return completion([1, 2, 3])

        with pytest.raises(LocalModelError, match="not an object"):
            local_model.generate_assessment(make_request(), [], client=stub_client(handler))


class TestContextBudget:
    def test_is_silent_when_the_prompt_fits(self, monkeypatch):
        monkeypatch.setenv("LOCAL_MODEL_CONTEXT", "8192")
        monkeypatch.setenv("LOCAL_MODEL_MAX_TOKENS", "2048")
        assert context_budget_warning("short prompt") is None

    def test_warns_before_a_prompt_silently_overruns_the_window(self, monkeypatch):
        # An overrun is not an error at the server: it truncates, and the model answers from a
        # half-read case. Saying so is the only way anyone finds out.
        monkeypatch.setenv("LOCAL_MODEL_CONTEXT", "8192")
        monkeypatch.setenv("LOCAL_MODEL_MAX_TOKENS", "2048")
        warning = context_budget_warning("x" * 40_000)
        assert warning is not None
        assert "larger -c" in warning


class TestProviderSelection:
    def test_defaults_to_the_hosted_model(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER", raising=False)
        assert provider.configured_provider() == "anthropic"

    @pytest.mark.parametrize("value", ["llamacpp", "llama.cpp", "local", "LlamaCpp"])
    def test_accepts_the_names_people_actually_type(self, monkeypatch, value):
        monkeypatch.setenv("AI_PROVIDER", value)
        assert provider.configured_provider() == "llamacpp"

    def test_refuses_an_unknown_provider_rather_than_falling_back(self, monkeypatch):
        # Quietly sending a case to a hosted provider when the operator asked for a local one
        # would be the wrong way to be forgiving.
        monkeypatch.setenv("AI_PROVIDER", "openai")
        with pytest.raises(RuntimeError, match="not a provider"):
            provider.configured_provider()

    def test_health_describes_where_a_local_model_is_expected(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "llamacpp")
        monkeypatch.setenv("LLAMA_SERVER_URL", "http://127.0.0.1:8080")
        described = provider.describe()
        assert described["provider"] == "llamacpp"
        assert described["endpoint"] == "http://127.0.0.1:8080"
        assert "context" in described


class TestServerProbe:
    """What the health endpoint reports about the far end.

    Configuration can only ever confirm itself back to whoever wrote it. Asking the endpoint what
    it is turns "the operator believes a 27B model is loaded" into something checkable, which is
    the difference between noticing a stub on the wrong port in a second and not at all.
    """

    def test_names_the_model_the_endpoint_reports(self):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/props"
            return httpx.Response(200, json={"model_alias": "qwen3-27b-q4_k_m", "is_sleeping": False})

        result = local_model.probe_server(client=stub_client(handler))
        assert result == {"reachable": True, "servedModel": "qwen3-27b-q4_k_m", "modelState": "ready", "sleeping": False}

    def test_sleep_is_healthy_and_polling_never_uses_a_waking_endpoint(self):
        paths = []
        def handler(request):
            paths.append(request.url.path)
            return httpx.Response(200, json={"model_alias": "real-model", "is_sleeping": True})
        client = stub_client(handler)
        for _ in range(3):
            result = local_model.probe_server(client)
            assert result["reachable"] is True
            assert result["modelState"] == "sleeping"
            assert result["servedModel"] == "real-model"
        assert paths == ["/props"] * 3

    def test_loading_is_distinct_from_unavailable(self):
        result = local_model.probe_server(stub_client(lambda _: httpx.Response(503)))
        assert result["modelState"] == "loading"
        assert result["reachable"] is True

    @pytest.mark.parametrize("body", [{}, {"model_alias": "configured-only"}, [], {"model_alias": "x", "is_sleeping": "false"}])
    def test_malformed_status_does_not_claim_a_ready_model(self, body):
        result = local_model.probe_server(stub_client(lambda _: httpx.Response(200, json=body)))
        assert result["modelState"] == "unknown"
        assert result["servedModel"] is None

    def test_says_nothing_is_listening_rather_than_reporting_the_configured_name(self):
        def handler(_: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        result = local_model.probe_server(client=stub_client(handler))
        assert result["reachable"] is False
        assert result["servedModel"] is None

    def test_flags_something_that_is_listening_but_is_not_a_llama_server(self):
        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"error": "not found"})

        result = local_model.probe_server(client=stub_client(handler))
        assert result["reachable"] is True
        assert result["servedModel"] is None
        assert result["modelState"] == "unknown"
