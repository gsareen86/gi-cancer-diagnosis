"""The system prompt and the message it builds are the model's whole brief.

Instructions are not a control — the core application validates every response regardless. But a
prompt that fails to state a constraint wastes the retry budget discovering it, and one that
misstates the red-flag relationship invites the model to second-guess a deterministic decision
the patient has already been advised on.
"""

from __future__ import annotations

import pytest

from gi_ai.prompt import PROMPT_VERSION, SYSTEM_PROMPT, build_user_message
from gi_ai.schemas import (
    AssessmentRequest,
    ClinicalFact,
    ClinicalSummary,
    DocumentExtract,
    RedFlagSummary,
    Rejection,
    Subject,
    TaxonomyEntry,
)


def make_request(**overrides) -> AssessmentRequest:
    summary = ClinicalSummary(
        caseId="case-1",
        subject=Subject(ageYears=52, sex="female"),
        facts=[
            ClinicalFact(
                questionId="blood_appearance",
                cluster="bleeding",
                question="What does the blood look like?",
                presence="present",
                answer="Black, sticky and tar-like",
                askedBecause="Have you noticed blood when you pass stool?",
            )
        ],
        presentFindings=["What does the blood look like? — Black, sticky and tar-like"],
        deniedFindings=["Have you lost weight without trying to?"],
        redFlags=[
            RedFlagSummary(
                ruleId="rf_upper_gi_bleed_with_hypovolaemia",
                urgency="emergency",
                basis="Your answers describe bleeding together with feeling faint.",
            )
        ],
        narrative="Patient: 52-year-old, female.\n\n## bleeding\n- reported black tarry stool",
        **overrides.pop("summary", {}),
    )
    return AssessmentRequest(
        caseId="case-1",
        promptVersion=PROMPT_VERSION,
        clinicalSummary=summary,
        outputSchema={"type": "object"},
        taxonomy=[
            TaxonomyEntry(id="peptic_ulcer_disease", label="Peptic ulcer disease"),
            TaxonomyEntry(
                id="suspected_gi_malignancy",
                label="Features that require urgent specialist review to exclude GI malignancy",
                urgentReferralOnly=True,
            ),
        ],
        **overrides,
    )


class TestSystemPrompt:
    def test_states_the_output_is_for_a_doctor_not_the_patient(self):
        assert "Registered Medical Practitioner" in SYSTEM_PROMPT
        assert "never shown to the patient" in SYSTEM_PROMPT

    def test_forbids_diagnosis(self):
        assert "Never state or imply a diagnosis" in SYSTEM_PROMPT

    def test_forbids_medication_dose_and_regimen(self):
        lowered = SYSTEM_PROMPT.lower()
        for term in ("medication", "dose", "regimen", "prescribing"):
            assert term in lowered

    def test_forbids_inventing_conditions_outside_the_permitted_list(self):
        assert "Only name conditions from the permitted list" in SYSTEM_PROMPT

    def test_forbids_malignancy_subtype_differentiation(self):
        assert "single urgent-referral category" in SYSTEM_PROMPT
        assert "cancer subtypes" in SYSTEM_PROMPT

    def test_tells_the_model_the_red_flags_are_not_its_to_change(self):
        assert "do not raise, lower, or suppress them" in SYSTEM_PROMPT

    def test_tells_the_model_silence_is_not_reassurance(self):
        assert "Do not treat silence as reassurance" in SYSTEM_PROMPT

    def test_permits_saying_the_information_is_too_thin(self):
        assert "not enough information" in SYSTEM_PROMPT


class TestUserMessage:
    def test_lists_the_permitted_vocabulary(self):
        message = build_user_message(make_request(), [])
        assert "PERMITTED CONDITIONS" in message
        assert "- Peptic ulcer disease" in message
        assert "(urgent referral category)" in message

    def test_includes_the_grounding_when_retrieval_found_something(self):
        message = build_user_message(
            make_request(), ["Melaena suggests bleeding proximal to the ligament of Treitz."]
        )
        assert "CURATED CLINICAL GUIDANCE" in message
        assert "ligament of Treitz" in message
        assert "[1]" in message

    def test_says_so_when_retrieval_found_nothing(self):
        message = build_user_message(make_request(), [])
        assert "No curated guidance matched" in message
        assert "ungrounded" in message

    def test_separates_denials_from_gaps(self):
        message = build_user_message(make_request(), [])
        assert "EXPLICITLY DENIED" in message
        assert "these are negatives, not gaps" in message
        assert "Have you lost weight without trying to?" in message

    def test_presents_red_flags_as_context_only(self):
        message = build_user_message(make_request(), [])
        assert "RED FLAGS ALREADY RAISED" in message
        assert "not yours to change" in message

    def test_flags_unverified_document_extracts(self):
        request = make_request()
        request.clinicalSummary.documents = [
            DocumentExtract(documentId="doc-1", reportType="colonoscopy report")
        ]
        message = build_user_message(request, [])
        assert "no clinician has confirmed them" in message

    def test_omits_the_unverified_note_when_every_extract_is_confirmed(self):
        request = make_request()
        request.clinicalSummary.documents = [
            DocumentExtract(documentId="doc-1", aiGeneratedUnverified=False)
        ]
        message = build_user_message(request, [])
        assert "no clinician has confirmed" not in message

    def test_pins_the_case_and_prompt_version(self):
        message = build_user_message(make_request(), [])
        assert 'Use "case-1" as case_id' in message
        assert f'"{PROMPT_VERSION}" as prompt_version' in message


class TestRetryReminder:
    def test_absent_on_the_first_attempt(self):
        assert "REJECTED" not in build_user_message(make_request(), [])

    def test_names_the_specific_violations_on_a_retry(self):
        request = make_request(
            previousRejections=[
                Rejection(
                    code="off_taxonomy_condition",
                    message="Model named a condition outside the reviewed disease taxonomy",
                    details=["Acute intermittent porphyria"],
                ),
                Rejection(
                    code="prohibited_treatment_content",
                    message="Model response names a medication",
                    details=["recommended_next_steps[0]: omeprazole"],
                ),
            ]
        )
        message = build_user_message(request, [])

        assert "YOUR PREVIOUS RESPONSE WAS REJECTED" in message
        assert "It was not saved" in message
        assert "[off_taxonomy_condition]" in message
        assert "Acute intermittent porphyria" in message
        assert "[prohibited_treatment_content]" in message
        assert "omeprazole" in message

    def test_asks_for_a_conforming_answer_not_an_apology(self):
        request = make_request(
            previousRejections=[Rejection(code="schema_violation", message="missing field")]
        )
        message = build_user_message(request, [])
        assert "Do not explain the correction" in message


@pytest.mark.parametrize("grounding", [[], ["one chunk"], ["a", "b", "c"]])
def test_message_is_deterministic(grounding):
    request = make_request()
    assert build_user_message(request, grounding) == build_user_message(request, grounding)
