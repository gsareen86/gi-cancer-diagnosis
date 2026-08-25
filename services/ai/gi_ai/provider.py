"""Choosing which model answers.

The rest of the service does not care. It hands over a compiled clinical summary and a JSON
Schema and gets a structured object back; whether that came from a hosted model or one running on
the reviewing clinician's own machine is a deployment decision, and a consequential one — a local
model means no clinical content leaves the building, which is the strongest possible answer to the
DPDP cross-border question.

Both paths reach the same place: a response the core application validates against the schema it
generated. The provider is the one thing that varies; the guarantee is not.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from . import local_model, model
from .schemas import AssessmentRequest

Provider = Literal["anthropic", "llamacpp"]


def configured_provider() -> Provider:
    """Reads `AI_PROVIDER`, defaulting to the hosted model.

    An unrecognised value is an error rather than a silent fallback: quietly sending a case to a
    hosted provider when the operator asked for a local one would be exactly the wrong way to be
    forgiving.
    """
    raw = os.environ.get("AI_PROVIDER", "anthropic").strip().lower()
    if raw in ("anthropic", "claude"):
        return "anthropic"
    if raw in ("llamacpp", "llama.cpp", "local"):
        return "llamacpp"
    raise RuntimeError(
        f'AI_PROVIDER is "{raw}", which is not a provider this service knows. '
        'Use "anthropic" or "llamacpp".'
    )


def configured_model_id() -> str:
    """What the deployment claims is loaded. Reported by the health endpoint, never stored."""
    if configured_provider() == "llamacpp":
        return local_model.configured_model_id()
    return model.model_id()


def generate_assessment(
    request: AssessmentRequest, grounding: list[str]
) -> tuple[dict[str, Any], str]:
    """Returns the assessment and the model that actually produced it.

    Both halves matter. The second is what gets stored against the case and shown to the reviewing
    doctor as a version pin, and it has to describe what answered rather than what was configured
    to answer — those came apart once, and a stub on the expected port produced summaries that
    carried a real model's name.
    """
    if configured_provider() == "llamacpp":
        return local_model.generate_assessment(request, grounding)
    return model.generate_assessment(request, grounding)


def describe() -> dict[str, object]:
    """What the health endpoint reports, so a misconfiguration is visible before a case arrives."""
    provider = configured_provider()
    if provider == "llamacpp":
        # Reports what is configured *and* what is actually listening, kept as separate fields
        # rather than merged. When they disagree the disagreement is the useful part.
        return {
            "provider": provider,
            "configuredModel": local_model.configured_model_id(),
            "endpoint": local_model.base_url(),
            "context": str(local_model.context_size()),
            **local_model.probe_server(),
        }
    return {"provider": provider, "configuredModel": model.model_id(), "endpoint": "anthropic-api"}
