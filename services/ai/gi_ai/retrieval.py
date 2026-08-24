"""Retrieval over the doctor-curated knowledge base.

This is what makes the assessment reflect the reviewing service's own guidance rather than the
model's unguided recall. Retrieval is filtered by symptom cluster before it is ranked by
similarity: a semantically close chunk from an unrelated cluster is worse than a slightly
further one from the right area.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import psycopg
from psycopg.rows import dict_row


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    entry_id: str
    text: str
    distance: float


# Matches the column in packages/db — changing one without the other silently breaks retrieval.
EMBEDDING_DIMENSIONS = 1024

RELEVANCE_THRESHOLD = 0.65
"""Cosine distance above which a chunk is not considered relevant.

Deliberately conservative: an assessment marked ungrounded is honest, while one grounded on
loosely related guidance is misleading in a way the doctor cannot see.
"""


def _connection_string() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


def knowledge_base_version(connection_string: str | None = None) -> str:
    """The snapshot the assessment is grounded on, recorded with the result for reproducibility."""
    with psycopg.connect(connection_string or _connection_string(), row_factory=dict_row) as conn:
        row = conn.execute(
            "SELECT version FROM knowledge_base_snapshots ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
    return row["version"] if row else "kb-empty"


def retrieve(
    embedding: list[float],
    clusters: list[str],
    limit: int = 8,
    connection_string: str | None = None,
) -> list[Chunk]:
    """Nearest neighbours within the relevant clusters.

    Returns an empty list rather than the closest available chunk when nothing clears the
    threshold — the caller marks the assessment ungrounded, which the doctor then sees.
    """
    if len(embedding) != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"embedding has {len(embedding)} dimensions, expected {EMBEDDING_DIMENSIONS}"
        )

    vector_literal = "[" + ",".join(str(value) for value in embedding) + "]"

    sql = """
        SELECT c.id::text AS chunk_id,
               c.entry_id::text AS entry_id,
               c.text AS text,
               (c.embedding <=> %(embedding)s::vector) AS distance
        FROM knowledge_base_chunks c
        JOIN knowledge_base_entries e ON e.id = c.entry_id
        WHERE e.superseded_at IS NULL
          AND c.embedding IS NOT NULL
          {cluster_filter}
        ORDER BY distance ASC
        LIMIT %(limit)s
    """.format(
        cluster_filter="AND c.clusters && %(clusters)s::text[]" if clusters else ""
    )

    params: dict[str, object] = {"embedding": vector_literal, "limit": limit}
    if clusters:
        params["clusters"] = clusters

    with psycopg.connect(connection_string or _connection_string(), row_factory=dict_row) as conn:
        rows = conn.execute(sql, params).fetchall()

    return [
        Chunk(
            chunk_id=row["chunk_id"],
            entry_id=row["entry_id"],
            text=row["text"],
            distance=float(row["distance"]),
        )
        for row in rows
        if float(row["distance"]) <= RELEVANCE_THRESHOLD
    ]


def clusters_for(summary_clusters: list[str]) -> list[str]:
    """De-duplicates while preserving order, so the filter is stable across identical cases."""
    seen: list[str] = []
    for cluster in summary_clusters:
        if cluster not in seen:
            seen.append(cluster)
    return seen
