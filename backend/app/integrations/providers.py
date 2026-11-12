"""Provider boundaries; real OCR/RAG orchestration is owned by its module."""
from typing import Protocol

class OcrProvider(Protocol):
    def extract(self, image: bytes) -> list[dict]: ...

class EmbeddingProvider(Protocol):
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, query: str) -> list[float]: ...

class GenerationProvider(Protocol):
    def generate(self, evidence: list[dict], question: str) -> dict: ...

def validate_embeddings(vectors: list[list[float]], expected_count: int):
    import math
    if len(vectors) != expected_count or any(len(v) != 768 or any(not math.isfinite(n) for n in v) for v in vectors):
        raise ValueError('Expected finite 768-dimensional embeddings')
