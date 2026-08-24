"""Embeddings for knowledge-base retrieval.

Deliberately behind an interface. Which embedding model to run is a deployment decision that
depends on where the service is hosted and what data-residency constraints apply — a hosted
embedding API sends the query text out of the platform boundary, which for a clinical summary is
a decision the reviewing service has to make, not one to inherit from a default.

The local implementation is a deterministic hashing embedder. It is not semantically meaningful:
it exists so the pipeline, the schema, and the retrieval SQL can be exercised end to end without
a model. Retrieval quality with it is effectively random, which is why an unconfigured deployment
marks its assessments ungrounded rather than pretending to have retrieved something.

TODO(confirm): choose an embedding model and where it runs, alongside Decision D (hosting).
"""

from __future__ import annotations

import hashlib
import math
import os
import re
from typing import Protocol

EMBEDDING_DIMENSIONS = 1024


class Embedder(Protocol):
    def embed(self, text: str) -> list[float]: ...

    @property
    def is_semantic(self) -> bool:
        """False for the placeholder, so callers can mark results ungrounded honestly."""
        ...


_TOKEN = re.compile(r"[a-z0-9']+")


class HashingEmbedder:
    """A deterministic bag-of-words hash. Stands in for a real model; never pretends to be one."""

    is_semantic = False

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * EMBEDDING_DIMENSIONS
        for token in _TOKEN.findall(text.lower()):
            digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIMENSIONS
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign
        norm = math.sqrt(sum(value * value for value in vector))
        return [value / norm for value in vector] if norm > 0 else vector


_embedder: Embedder = HashingEmbedder()


def set_embedder(embedder: Embedder) -> None:
    global _embedder
    _embedder = embedder


def embedder() -> Embedder:
    return _embedder


def embed(text: str) -> list[float]:
    return _embedder.embed(text)


def semantic_retrieval_available() -> bool:
    """Whether retrieval can actually be trusted, or is a placeholder."""
    return bool(os.environ.get("GI_EMBEDDINGS_CONFIGURED")) and _embedder.is_semantic
