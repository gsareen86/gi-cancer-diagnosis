"""A local model served by llama.cpp.

Talks to `llama-server`'s OpenAI-compatible endpoint, which is what makes a locally hosted model
a drop-in for the hosted one: no clinical content leaves the machine, and the guarantee the rest
of the system depends on is preserved by a different mechanism.

That guarantee is structured output. Against Claude it comes from a forced tool call with a strict
schema; here it comes from llama.cpp's constrained decoding, which compiles the same JSON Schema
into a grammar and makes a non-conforming token literally unsamplable. Both produce the shape the
core application then validates server-side anyway — that validation is the actual control, and it
runs whichever provider answered.

Unlike the Claude 5 family, sampling parameters exist here and are worth setting: temperature is
pinned low so the same case does not produce a different differential on a rerun.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from .prompt import SYSTEM_PROMPT, TOOL_NAME, build_user_message
from .schemas import AssessmentRequest

DEFAULT_BASE_URL = "http://127.0.0.1:8080"

DEFAULT_MAX_TOKENS = 2048
"""Enough for a full assessment.

Deliberately modest: a local deployment may be running an 8192-token context, and the prompt has
to fit alongside whatever is generated. `context_budget_warning` reports when it will not.
"""

REQUEST_TIMEOUT_SECONDS = 600.0
"""Generous. A 27B model on an APU produces tokens far slower than a hosted endpoint, and a
timeout here becomes an assessment the reviewing doctor never sees."""


class LocalModelError(RuntimeError):
    """The local server was unreachable or answered with something unusable."""


def base_url() -> str:
    return os.environ.get("LLAMA_SERVER_URL", DEFAULT_BASE_URL).rstrip("/")


def model_id() -> str:
    # llama-server ignores the model name and serves whatever was loaded, but recording it means
    # a stored assessment still names what produced it.
    return os.environ.get("LOCAL_MODEL_NAME", "llamacpp/local")


def max_tokens() -> int:
    return int(os.environ.get("LOCAL_MODEL_MAX_TOKENS", DEFAULT_MAX_TOKENS))


def context_size() -> int:
    """The `-c` the server was started with. Only used to warn before a prompt overruns it."""
    return int(os.environ.get("LOCAL_MODEL_CONTEXT", "8192"))


def estimate_tokens(text: str) -> int:
    """A deliberately rough character-per-token estimate.

    Exact counting would mean loading the model's tokenizer into this service. The estimate only
    has to be good enough to warn before a prompt silently overruns the context window, where the
    server truncates and the model answers from a half-read case.
    """
    return len(text) // 3


def context_budget_warning(prompt: str) -> str | None:
    """Returns a message when the prompt plus its output will not fit the configured context."""
    needed = estimate_tokens(prompt) + max_tokens()
    available = context_size()
    if needed <= available:
        return None
    return (
        f"prompt is roughly {estimate_tokens(prompt)} tokens and up to {max_tokens()} more will be "
        f"generated, against a {available}-token context. Start llama-server with a larger -c, or "
        f"lower LOCAL_MODEL_MAX_TOKENS. Continuing, but the model may be reading a truncated case."
    )


def generate_assessment(
    request: AssessmentRequest,
    grounding: list[str],
    client: httpx.Client | None = None,
) -> dict[str, Any]:
    """Calls the local server and returns the structured result verbatim.

    Nothing is cleaned or repaired here, for the same reason as the hosted path: the core
    application validates against the authoritative schema, and a second, looser pass here would
    mask exactly the responses that validation exists to catch.
    """
    prompt = build_user_message(request, grounding)

    warning = context_budget_warning(SYSTEM_PROMPT + prompt)
    if warning is not None:
        print(f"[local-model] {warning}")

    payload = {
        "model": model_id(),
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens(),
        # Pinned low rather than zero: greedy decoding on a quantised model tends to loop.
        "temperature": 0.1,
        "top_p": 0.9,
        # Constrained decoding. llama.cpp compiles this schema into a grammar, so a response that
        # does not fit the shape cannot be produced in the first place.
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": TOOL_NAME,
                "strict": True,
                "schema": request.outputSchema,
            },
        },
        # Qwen3 and similar reasoning models interleave a thinking block by default, which fights
        # constrained decoding. Servers that do not understand this key ignore it.
        "chat_template_kwargs": {"enable_thinking": False},
    }

    http = client or httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS)
    close_after = client is None
    try:
        response = http.post(f"{base_url()}/v1/chat/completions", json=payload)
    except httpx.HTTPError as error:
        raise LocalModelError(
            f"could not reach llama-server at {base_url()}: {error}. Is it running?"
        ) from error
    finally:
        if close_after:
            http.close()

    if response.status_code != 200:
        raise LocalModelError(
            f"llama-server answered {response.status_code}: {response.text[:400]}"
        )

    body = response.json()
    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as error:
        raise LocalModelError(f"unexpected response shape from llama-server: {body}") from error

    if not isinstance(content, str) or content.strip() == "":
        raise LocalModelError("llama-server returned an empty completion")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as error:
        # Constrained decoding should make this impossible; when it happens the server was almost
        # certainly started without grammar support, which is worth saying plainly.
        raise LocalModelError(
            "llama-server returned content that is not JSON, so constrained decoding is probably "
            f"not active. First 200 characters: {content[:200]}"
        ) from error

    if not isinstance(parsed, dict):
        raise LocalModelError("llama-server returned JSON that is not an object")

    return parsed
