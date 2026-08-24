"""Prior-report extraction.

Deterministic pattern work, not a model call. These tests cover the shapes real Indian lab and
endoscopy reports arrive in, and the failure mode that matters most: a scan we cannot read must
say so rather than return a confident empty extract.
"""

from __future__ import annotations

import base64

from gi_ai.extraction import extract_document, summarize

COLONOSCOPY = """\
APOLLO HOSPITALS — ENDOSCOPY UNIT
Colonoscopy Report
Date: 02/11/2025

Procedure: Full colonoscopy to caecum.

Findings:
Two sessile polyps in the sigmoid colon, 6 mm and 9 mm.
Diverticula noted in the descending colon.

Impression:
Sigmoid polyps, removed and sent for histopathology.
"""

BLOOD_COUNT = """\
Complete Blood Count
Reported: 2026-01-14

Haemoglobin      8.2 g/dL      (L)
MCV              71 fL         Low
Platelets        340 x10^9/L
Ferritin         6 ng/mL       (L)
"""


class TestReportType:
    def test_identifies_a_colonoscopy_report(self):
        assert summarize(COLONOSCOPY).report_type == "colonoscopy report"

    def test_identifies_a_full_blood_count(self):
        assert summarize(BLOOD_COUNT).report_type == "full blood count"

    def test_identifies_an_upper_gi_endoscopy(self):
        assert summarize("Oesophagogastroduodenoscopy report").report_type == (
            "upper GI endoscopy report"
        )

    def test_leaves_the_type_unset_rather_than_guessing(self):
        assert summarize("Some notes the patient typed out.").report_type is None


class TestReportDate:
    def test_reads_an_iso_date(self):
        assert summarize(BLOOD_COUNT).report_date == "2026-01-14"

    def test_reads_a_day_first_date_into_iso(self):
        # 02/11/2025 in an Indian report is 2 November, not 11 February.
        assert summarize(COLONOSCOPY).report_date == "2025-11-02"

    def test_leaves_the_date_unset_when_there_is_none(self):
        assert summarize("Findings: normal study.").report_date is None


class TestKeyFindings:
    def test_captures_the_impression_and_what_follows_it(self):
        findings = " ".join(summarize(COLONOSCOPY).key_findings)
        assert "Impression:" in findings
        assert "Sigmoid polyps" in findings

    def test_captures_the_findings_section(self):
        findings = " ".join(summarize(COLONOSCOPY).key_findings)
        assert "sessile polyps" in findings


class TestAbnormalValues:
    def test_flags_values_marked_low(self):
        abnormal = summarize(BLOOD_COUNT).abnormal_values
        assert any("Haemoglobin" in line for line in abnormal)
        assert any("Ferritin" in line for line in abnormal)

    def test_leaves_unmarked_values_alone(self):
        abnormal = " ".join(summarize(BLOOD_COUNT).abnormal_values)
        assert "Platelets" not in abnormal


class TestUnreadableDocuments:
    def test_says_a_document_is_not_machine_readable_rather_than_returning_nothing(self):
        result = summarize("")
        assert result.machine_readable is False
        assert result.key_findings == []
        assert result.report_type is None

    def test_treats_whitespace_as_unreadable(self):
        assert summarize("   \n\t  ").machine_readable is False

    def test_a_corrupt_pdf_is_unreadable_rather_than_an_error(self):
        # The patient's own tags survive; the doctor reads the original.
        result = extract_document("application/pdf", base64.b64encode(b"not a pdf").decode())
        assert result.machine_readable is False

    def test_an_unsupported_type_is_unreadable_rather_than_an_error(self):
        result = extract_document("application/zip", base64.b64encode(b"PK\x03\x04").decode())
        assert result.machine_readable is False


class TestDeterminism:
    def test_the_same_document_summarizes_identically(self):
        first = summarize(COLONOSCOPY)
        second = summarize(COLONOSCOPY)
        assert first == second

    def test_findings_are_deduplicated_and_bounded(self):
        repetitive = "\n".join(["Impression: normal study."] * 50)
        result = summarize(repetitive)
        assert len(result.key_findings) <= 12
