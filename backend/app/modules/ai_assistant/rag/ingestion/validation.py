"""Validate the existing JSONL handoff without database or provider access."""

import hashlib
from pathlib import Path

from pydantic import BaseModel, Field


class CorpusDocument(BaseModel):
    external_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    source_name: str = Field(min_length=1)
    source_url: str
    language: str
    content: str = Field(min_length=1)
    document_type: str
    aliases: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)


def validate_corpus(path: Path):
    payload = path.read_bytes()
    seen = set()
    for line in payload.decode("utf-8").splitlines():
        if not line.strip():
            continue
        record = CorpusDocument.model_validate_json(line)
        key = (record.source_name, record.external_id)
        if key in seen:
            raise ValueError(f"Duplicate source key at record {len(seen) + 1}")
        seen.add(key)
    return {"documents": len(seen), "sha256": hashlib.sha256(payload).hexdigest(), "embedded": False}
