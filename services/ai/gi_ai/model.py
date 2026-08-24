"""The model call.

This is the only place in the whole system that talks to a model provider. Three things make the
call itself a control rather than a request-and-hope:

- The response must come through a tool whose schema was generated from the same Zod schema the
  core application validates against. Forced `tool_choice` plus `strict` means the provider
  rejects a malformed shape before we ever see it.
- Parallel tool use is disabled. One assessment per case; two competing answers would leave the
  pipeline choosing between them, which is a clinical decision no code should make.
- Adaptive thinking at high effort. Reading a history and holding several possibilities open is
  exactly the kind of work that gets worse without it.

Note there is no `temperature`: it was removed on the Claude 5 family and sending it returns a
400. Determinism is not what makes this safe anyway — the schema validation in the core
application is, and it runs on every response regardless of how the model was sampled.
"""

from __future__ import annotations

import json
import os
from typing import Any

import anthropic

from .prompt import SYSTEM_PROMPT, TOOL_DESCRIPTION, TOOL_NAME, build_user_message
from .schemas import AssessmentRequest

DEFAULT_MODEL = "claude-opus-5"

MAX_TOKENS = 16000
"""Comfortably above a full assessment, and below the point where a non-streaming request risks
an HTTP timeout."""


class ModelRefusalError(RuntimeError):
    """The provider's safety classifier declined the request.

    Surfaced rather than retried: a refusal on a clinical history is something the reviewing
    service should see, and the case still reaches the doctor with the assessment marked
    unavailable.
    """

    def __init__(self, category: str | None, explanation: str | None) -> None:
        super().__init__(f"Model declined the request (category={category}): {explanation}")
        self.category = category
        self.explanation = explanation


class ModelOutputError(RuntimeError):
    """The model answered without calling the tool, so there is no structured result to return."""


def _client() -> anthropic.Anthropic:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. This service is the only component that holds it."
        )
    return anthropic.Anthropic()


def model_id() -> str:
    return os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL)


def generate_assessment(
    request: AssessmentRequest,
    grounding: list[str],
    client: anthropic.Anthropic | None = None,
) -> dict[str, Any]:
    """Calls the model and returns the tool input verbatim.

    Deliberately does not inspect or clean the result. The core application validates it against
    the authoritative schema; a second, looser validation here would only mask the cases that
    validation is meant to catch.
    """
    anthropic_client = client or _client()

    tool = {
        "name": TOOL_NAME,
        "description": TOOL_DESCRIPTION,
        "input_schema": request.outputSchema,
        # Guarantees the tool input validates against the schema exactly, rather than
        # approximately. The schema already sets additionalProperties: false and lists every
        # required field, which strict mode needs.
        "strict": True,
    }

    response = anthropic_client.messages.create(
        model=model_id(),
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_message(request, grounding)}],
        tools=[tool],
        # The tool is the only way to answer, and there is exactly one answer.
        tool_choice={"type": "tool", "name": TOOL_NAME, "disable_parallel_tool_use": True},
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
    )

    if response.stop_reason == "refusal":
        details = response.stop_details
        raise ModelRefusalError(
            getattr(details, "category", None), getattr(details, "explanation", None)
        )

    for block in response.content:
        if block.type == "tool_use" and block.name == TOOL_NAME:
            # Tool inputs arrive already parsed by the SDK. Where a raw string is involved,
            # json.loads is the only safe reader — escaping varies between models.
            if isinstance(block.input, str):
                return json.loads(block.input)
            return dict(block.input)

    raise ModelOutputError(
        f"Model responded with stop_reason={response.stop_reason} and never called {TOOL_NAME}"
    )
