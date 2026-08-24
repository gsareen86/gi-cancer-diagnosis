"""Request and response shapes shared with the core application.

These mirror the TypeScript types in `apps/web/src/server/services/assessment-service.ts`. They
are deliberately permissive about the assessment itself: this service does not re-implement the
validation, because two implementations of one rule drift, and the authoritative one is the Zod
schema in `packages/core` that also generated the tool definition.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ClinicalFact(BaseModel):
    questionId: str
    cluster: str
    question: str
    presence: Literal["present", "absent", "value", "indeterminate"]
    answer: str
    askedBecause: str | None = None


class DocumentExtract(BaseModel):
    documentId: str
    reportType: str | None = None
    reportDate: str | None = None
    keyFindings: list[str] = Field(default_factory=list)
    abnormalValues: list[str] = Field(default_factory=list)
    machineReadable: bool = True
    aiGeneratedUnverified: bool = True


class RedFlagSummary(BaseModel):
    ruleId: str
    urgency: str
    basis: str


class Subject(BaseModel):
    ageYears: int | None = None
    sex: str | None = None


class ClinicalSummary(BaseModel):
    caseId: str
    subject: Subject
    facts: list[ClinicalFact] = Field(default_factory=list)
    factsByCluster: dict[str, list[ClinicalFact]] = Field(default_factory=dict)
    presentFindings: list[str] = Field(default_factory=list)
    deniedFindings: list[str] = Field(default_factory=list)
    redFlags: list[RedFlagSummary] = Field(default_factory=list)
    documents: list[DocumentExtract] = Field(default_factory=list)
    narrative: str


class TaxonomyEntry(BaseModel):
    id: str
    label: str
    urgentReferralOnly: bool = False


class Rejection(BaseModel):
    """What the core application refused about the previous attempt."""

    code: str
    message: str
    details: list[str] = Field(default_factory=list)


class AssessmentRequest(BaseModel):
    caseId: str
    promptVersion: str
    clinicalSummary: ClinicalSummary
    outputSchema: dict[str, Any]
    taxonomy: list[TaxonomyEntry]
    previousRejections: list[Rejection] | None = None


class AssessmentResponse(BaseModel):
    assessment: dict[str, Any]
    modelVersion: str
    kbVersion: str
    retrievedChunkIds: list[str] = Field(default_factory=list)
    grounded: bool


class ExtractionRequest(BaseModel):
    documentId: str
    contentType: str
    contentBase64: str


class ExtractionResponse(BaseModel):
    documentId: str
    machineReadable: bool
    reportType: str | None = None
    reportDate: str | None = None
    keyFindings: list[str] = Field(default_factory=list)
    abnormalValues: list[str] = Field(default_factory=list)
    """Always true for anything this service produces: no clinician has seen it yet."""
    aiGeneratedUnverified: bool = True
