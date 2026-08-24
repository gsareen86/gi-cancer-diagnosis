"""The AI service HTTP surface.

Two endpoints, both called only by the core application from inside the trust boundary. Neither
takes a patient identifier: the core application sends a compiled clinical summary and gets a
structured response back, so this service holds no patient identity and needs no consent context
of its own — the consent check already happened before the call was made.
"""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException

from . import embeddings, retrieval
from .extraction import extract_document
from .model import ModelOutputError, ModelRefusalError, generate_assessment, model_id
from .schemas import (
    AssessmentRequest,
    AssessmentResponse,
    ExtractionRequest,
    ExtractionResponse,
)

app = FastAPI(
    title="GI Compass AI service",
    version="0.1.0",
    description=(
        "Retrieval, document extraction, and the guarded model call. Produces decision support "
        "for a reviewing doctor; every response is validated against the authoritative schema by "
        "the caller before it reaches a database."
    ),
)


def require_service_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Shared-secret check.

    This service sits inside the trust boundary and is never exposed publicly; the token stops a
    misconfiguration from turning it into an open relay to the model provider.
    """
    expected = os.environ.get("AI_SERVICE_TOKEN")
    if not expected:
        # Refusing to start unauthenticated is safer than defaulting to open.
        raise HTTPException(status_code=500, detail="AI_SERVICE_TOKEN is not configured")
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "model": model_id(),
        "semanticRetrieval": embeddings.semantic_retrieval_available(),
    }


@app.post("/assess", response_model=AssessmentResponse)
def assess(
    request: AssessmentRequest,
    _: Annotated[None, Depends(require_service_token)] = None,
) -> AssessmentResponse:
    """Retrieves grounding, calls the model, and returns the tool output verbatim."""
    clusters = retrieval.clusters_for([fact.cluster for fact in request.clinicalSummary.facts])

    chunks = []
    grounded = False
    if embeddings.semantic_retrieval_available():
        query = _retrieval_query(request)
        try:
            chunks = retrieval.retrieve(embeddings.embed(query), clusters)
            grounded = len(chunks) > 0
        except Exception as error:
            # An assessment marked ungrounded is honest and still useful; a failed request is not.
            print(f"[retrieval] failed, continuing ungrounded: {error}")

    try:
        assessment = generate_assessment(request, [chunk.text for chunk in chunks])
    except ModelRefusalError as error:
        raise HTTPException(
            status_code=422,
            detail={"reason": "model_refusal", "category": error.category},
        ) from error
    except ModelOutputError as error:
        raise HTTPException(status_code=502, detail={"reason": "no_tool_call"}) from error

    return AssessmentResponse(
        assessment=assessment,
        modelVersion=model_id(),
        kbVersion=_kb_version(),
        retrievedChunkIds=[chunk.chunk_id for chunk in chunks],
        grounded=grounded,
    )


@app.post("/extract", response_model=ExtractionResponse)
def extract(
    request: ExtractionRequest,
    _: Annotated[None, Depends(require_service_token)] = None,
) -> ExtractionResponse:
    """Extracts a structured summary from a prior report, labelled unverified."""
    result = extract_document(request.contentType, request.contentBase64)
    return ExtractionResponse(
        documentId=request.documentId,
        machineReadable=result.machine_readable,
        reportType=result.report_type,
        reportDate=result.report_date,
        keyFindings=result.key_findings,
        abnormalValues=result.abnormal_values,
        aiGeneratedUnverified=True,
    )


def _retrieval_query(request: AssessmentRequest) -> str:
    """What retrieval matches against: the findings, not the whole narrative.

    The narrative carries scaffolding — headings, denials, provenance notes — that dilutes the
    signal. The present findings are what a clinician would search on.
    """
    summary = request.clinicalSummary
    parts = list(summary.presentFindings)
    parts.extend(flag.basis for flag in summary.redFlags)
    for document in summary.documents:
        parts.extend(document.keyFindings)
    return "\n".join(parts) if parts else summary.narrative


def _kb_version() -> str:
    try:
        return retrieval.knowledge_base_version()
    except Exception:
        return "kb-unavailable"
