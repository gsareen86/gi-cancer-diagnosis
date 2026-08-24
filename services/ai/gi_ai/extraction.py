"""Prior-report extraction.

Text first, optical character recognition only when there is no text to extract. A native PDF
carries its own text and OCR would only degrade it; a photographed discharge summary carries
none.

Everything produced here is labelled AI-generated and unverified. The original file remains the
source of truth, and a doctor confirms or corrects the extract before it counts as a finding.
"""

from __future__ import annotations

import base64
import io
import re
from dataclasses import dataclass, field

REPORT_TYPE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("colonoscopy report", re.compile(r"\bcolonoscop", re.I)),
    ("upper GI endoscopy report", re.compile(r"\b(gastroscop|oesophagogastroduoden|esophagogastroduoden|upper gi endoscop)", re.I)),
    ("abdominal ultrasound report", re.compile(r"\bultrasound|\busg\b|\bsonograph", re.I)),
    ("CT report", re.compile(r"\bct (scan|abdomen|report)|computed tomograph", re.I)),
    ("MRI report", re.compile(r"\bmri\b|magnetic resonance", re.I)),
    ("histopathology report", re.compile(r"\bhistopatholog|\bbiops(y|ies)\b", re.I)),
    ("liver function tests", re.compile(r"\bliver function|\blft\b|bilirubin", re.I)),
    ("full blood count", re.compile(r"\bhaemoglobin|\bhemoglobin\b|\bcbc\b|complete blood", re.I)),
    ("discharge summary", re.compile(r"\bdischarge summary", re.I)),
    ("prescription", re.compile(r"\brx\b|prescription", re.I)),
]

DATE_PATTERNS = [
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
    re.compile(r"\b(\d{2})/(\d{2})/(\d{4})\b"),
    re.compile(r"\b(\d{2})-(\d{2})-(\d{4})\b"),
]

ABNORMAL_MARKERS = re.compile(
    r"\b(high|low|abnormal|elevated|raised|reduced|positive|deranged)\b|\((H|L)\)|\*", re.I
)

FINDING_MARKERS = re.compile(
    r"\b(impression|conclusion|finding|findings|diagnosis|comment|opinion)\b\s*[:\-]", re.I
)


@dataclass
class Extract:
    machine_readable: bool
    report_type: str | None = None
    report_date: str | None = None
    key_findings: list[str] = field(default_factory=list)
    abnormal_values: list[str] = field(default_factory=list)


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _docx_text(data: bytes) -> str:
    import docx

    document = docx.Document(io.BytesIO(data))
    parts = [paragraph.text for paragraph in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def _image_text(data: bytes) -> str:
    import pytesseract
    from PIL import Image

    return pytesseract.image_to_string(Image.open(io.BytesIO(data)))


def extract_text(content_type: str, data: bytes) -> str:
    """Pulls text out of the supported formats, returning empty when there is none to pull."""
    try:
        if content_type == "application/pdf":
            text = _pdf_text(data)
            # A scanned report is a PDF of images: no extractable text, so fall through to OCR.
            return text if text.strip() else _image_text(data)
        if content_type in {"image/jpeg", "image/png"}:
            return _image_text(data)
        if content_type.endswith("wordprocessingml.document"):
            return _docx_text(data)
    except Exception:
        # A file we cannot read is not an error the patient should see. The document stays
        # attached with their own tags and the doctor reads the original.
        return ""
    return ""


def summarize(text: str) -> Extract:
    """Structures the extracted text without a model.

    Deterministic on purpose: report type, date, and flagged values are pattern work, and a model
    adds latency and a hallucination surface for something regular expressions get right. The
    model earns its place on the clinical reasoning, not on finding the word "Impression".
    """
    if not text.strip():
        return Extract(machine_readable=False)

    report_type = next(
        (label for label, pattern in REPORT_TYPE_PATTERNS if pattern.search(text)), None
    )

    report_date: str | None = None
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        groups = match.groups()
        report_date = (
            f"{groups[0]}-{groups[1]}-{groups[2]}"
            if len(groups[0]) == 4
            else f"{groups[2]}-{groups[1]}-{groups[0]}"
        )
        break

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    key_findings: list[str] = []
    for index, line in enumerate(lines):
        if FINDING_MARKERS.search(line):
            # The marker line itself, plus what follows it — an "Impression:" heading on its own
            # line carries nothing without the next line.
            key_findings.append(line)
            key_findings.extend(lines[index + 1 : index + 3])

    abnormal_values = [
        line for line in lines if ABNORMAL_MARKERS.search(line) and any(ch.isdigit() for ch in line)
    ]

    return Extract(
        machine_readable=True,
        report_type=report_type,
        report_date=report_date,
        key_findings=_dedupe(key_findings)[:12],
        abnormal_values=_dedupe(abnormal_values)[:12],
    )


def _dedupe(values: list[str]) -> list[str]:
    seen: list[str] = []
    for value in values:
        trimmed = value.strip()
        if trimmed and trimmed not in seen:
            seen.append(trimmed)
    return seen


def extract_document(content_type: str, content_base64: str) -> Extract:
    data = base64.b64decode(content_base64)
    return summarize(extract_text(content_type, data))
