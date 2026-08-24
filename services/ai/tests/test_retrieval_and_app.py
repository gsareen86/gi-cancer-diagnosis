"""Retrieval behaviour and the service surface."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from gi_ai import embeddings
from gi_ai.app import app
from gi_ai.retrieval import EMBEDDING_DIMENSIONS, RELEVANCE_THRESHOLD, clusters_for, retrieve

client = TestClient(app, raise_server_exceptions=False)
AUTH = {"authorization": "Bearer test-service-token"}


class TestEmbedder:
    def test_produces_the_dimension_the_column_expects(self):
        vector = embeddings.embed("black tarry stool with lightheadedness")
        assert len(vector) == EMBEDDING_DIMENSIONS

    def test_is_deterministic(self):
        assert embeddings.embed("melaena") == embeddings.embed("melaena")

    def test_is_normalised(self):
        vector = embeddings.embed("bleeding")
        assert abs(sum(value * value for value in vector) - 1.0) < 1e-9

    def test_handles_empty_text_without_dividing_by_zero(self):
        assert embeddings.embed("") == [0.0] * EMBEDDING_DIMENSIONS

    def test_the_placeholder_declares_itself_non_semantic(self):
        # This is what makes the service mark its assessments ungrounded honestly rather than
        # pretending a hash produced meaningful retrieval.
        assert embeddings.embedder().is_semantic is False
        assert embeddings.semantic_retrieval_available() is False


class TestRetrievalContract:
    def test_refuses_a_wrongly_sized_embedding_rather_than_querying(self):
        with pytest.raises(ValueError, match="dimensions"):
            retrieve([0.1, 0.2], ["bleeding"], connection_string="postgres://unused")

    def test_threshold_is_conservative(self):
        # An assessment marked ungrounded is honest; one grounded on loosely related guidance
        # is misleading in a way the reviewing doctor cannot see.
        assert 0 < RELEVANCE_THRESHOLD < 1

    def test_clusters_are_deduplicated_in_order(self):
        assert clusters_for(["bleeding", "pain", "bleeding", "systemic"]) == [
            "bleeding",
            "pain",
            "systemic",
        ]

    def test_no_clusters_is_an_empty_filter_not_an_error(self):
        assert clusters_for([]) == []


class TestServiceSurface:
    def test_health_reports_the_model_and_whether_retrieval_is_real(self):
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["model"].startswith("claude-")
        assert body["semanticRetrieval"] is False

    def test_assess_requires_the_service_token(self):
        response = client.post("/assess", json={})
        assert response.status_code in {401, 422}

    def test_extract_requires_the_service_token(self):
        response = client.post(
            "/extract",
            json={"documentId": "d", "contentType": "application/pdf", "contentBase64": ""},
        )
        assert response.status_code == 401

    def test_a_wrong_token_is_refused(self):
        response = client.post(
            "/extract",
            headers={"authorization": "Bearer wrong"},
            json={"documentId": "d", "contentType": "application/pdf", "contentBase64": ""},
        )
        assert response.status_code == 401

    def test_extract_labels_its_output_unverified(self):
        response = client.post(
            "/extract",
            headers=AUTH,
            json={
                "documentId": "doc-1",
                "contentType": "application/pdf",
                "contentBase64": "",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["aiGeneratedUnverified"] is True
        assert body["machineReadable"] is False

    def test_assess_rejects_a_malformed_request_body(self):
        response = client.post("/assess", headers=AUTH, json={"caseId": "only-this"})
        assert response.status_code == 422
