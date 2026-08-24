"""The system prompt and its guardrails.

Instructions are not a control — the core application validates every response against a fixed
schema regardless of what this prompt says. But the prompt is where the model is told the shape
of the job, and a vague one produces responses that fail validation and burn the retry budget.

Two rules shape the wording. The output is decision support for a Registered Medical
Practitioner, never a diagnosis for a patient — India's Telemedicine Practice Guidelines 2020
allow AI only in that supporting role. And the red flags in the summary were raised by
deterministic clinician-authored rules before any model ran; the model is told plainly that they
are context, not something for it to revise.
"""

from __future__ import annotations

from .schemas import AssessmentRequest, Rejection

PROMPT_VERSION = "assessment-v1"

SYSTEM_PROMPT = """\
You are a clinical decision-support assistant for a gastroenterology service in India. You are \
reading a structured summary of what a patient reported through a guided questionnaire, together \
with any prior reports they uploaded.

Your output goes to a Registered Medical Practitioner who will review it before anything reaches \
the patient. It is never shown to the patient in the form you produce it.

WHAT YOU PRODUCE
- A differential list: conditions worth considering, each with a likelihood of high, moderate, or \
low, the findings that support it, and the findings that argue against it or sit oddly with it.
- Suggested confirmatory steps: investigations that would distinguish between the possibilities.
- A concise summary written for the reviewing doctor, in clinical language.

HARD CONSTRAINTS
- Never state or imply a diagnosis. Every item is a possibility with a likelihood, not a finding.
- Never name a medication, a dose, a route, a frequency, or a treatment regimen. Not even a drug \
class as a suggestion. Prescribing is entirely the doctor's, outside this system.
- Only name conditions from the permitted list you are given. If the presentation suggests \
something outside it, say so in the summary rather than inventing a term for the list.
- Malignancy appears as a single urgent-referral category. Do not attempt to distinguish between \
cancer subtypes: that is a specialist judgement made after imaging and histology.
- The red flags in the summary were raised by clinician-authored deterministic rules before you \
were involved. Restate them if they are relevant, but do not raise, lower, or suppress them — \
they do not depend on you, and the patient has already been advised on them.
- Reason only from the information given. Absence of a symptom in the summary means it was never \
asked, unless it is explicitly listed as denied. Do not treat silence as reassurance.
- Where the information is too thin to support a differential, say so in the summary. An honest \
"not enough information" is more useful to the doctor than a confident guess.

You must call the provided tool with your answer. Emit nothing outside it.\
"""


def _rejection_reminder(rejections: list[Rejection]) -> str:
    """Turns the core application's refusal into a specific correction.

    A generic "please try again" wastes the attempt. Naming what was wrong is the difference
    between a retry that converges and three identical failures.
    """
    lines = [
        "",
        "YOUR PREVIOUS RESPONSE WAS REJECTED. It was not saved. Correct these specific problems:",
    ]
    for rejection in rejections:
        detail = "; ".join(rejection.details[:5]) if rejection.details else ""
        suffix = f" ({detail})" if detail else ""
        lines.append(f"- [{rejection.code}] {rejection.message}{suffix}")
    lines.append(
        "Emit a complete response through the tool. Do not explain the correction; just produce a "
        "conforming answer."
    )
    return "\n".join(lines)


def build_user_message(request: AssessmentRequest, grounding: list[str]) -> str:
    """Assembles the prompt body: permitted vocabulary, curated guidance, then the case."""
    summary = request.clinicalSummary
    permitted = "\n".join(
        f"- {entry.label}" + (" (urgent referral category)" if entry.urgentReferralOnly else "")
        for entry in request.taxonomy
    )

    parts = [
        "PERMITTED CONDITIONS — name only these in the differential:",
        permitted,
        "",
    ]

    if grounding:
        parts += [
            "CURATED CLINICAL GUIDANCE from the reviewing service's own knowledge base. Reason "
            "from this in preference to general recall where they differ:",
            "",
            *[f"[{index + 1}] {chunk}" for index, chunk in enumerate(grounding)],
            "",
        ]
    else:
        parts += [
            "No curated guidance matched this presentation. Say so in your summary so the doctor "
            "knows this assessment is ungrounded.",
            "",
        ]

    parts += ["PATIENT SUMMARY:", "", summary.narrative, ""]

    if summary.deniedFindings:
        parts += [
            "EXPLICITLY DENIED by the patient (these are negatives, not gaps):",
            *[f"- {finding}" for finding in summary.deniedFindings],
            "",
        ]

    if summary.redFlags:
        parts += [
            "RED FLAGS ALREADY RAISED by deterministic clinician-authored rules. Context only — "
            "not yours to change:",
            *[f"- [{flag.urgency}] {flag.basis}" for flag in summary.redFlags],
            "",
        ]

    unverified = [doc for doc in summary.documents if doc.aiGeneratedUnverified]
    if unverified:
        parts += [
            "Note: the prior-report extracts above were produced automatically and no clinician "
            "has confirmed them. Treat them as reported, not established.",
            "",
        ]

    parts += [
        f"Produce the assessment for case {request.caseId} through the tool. Use "
        f'"{request.caseId}" as case_id and "{request.promptVersion}" as prompt_version.',
    ]

    if request.previousRejections:
        parts.append(_rejection_reminder(request.previousRejections))

    return "\n".join(parts)


TOOL_NAME = "record_assessment"
TOOL_DESCRIPTION = (
    "Record the structured decision-support assessment for the reviewing doctor. This is the only "
    "way to answer. Every field is required and the shape is exact."
)
