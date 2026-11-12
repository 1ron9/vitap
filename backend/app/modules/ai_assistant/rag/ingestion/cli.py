"""Validate the JSONL handoff before enabling provider-based ingestion.

python -m app.modules.ai_assistant.rag.ingestion.cli --input corpus.jsonl --validate-only
This command intentionally does not claim that documents have been embedded.
"""
import argparse
import json
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
    aliases: list[str] = []
    categories: list[str] = []

def validate_corpus(path: Path):
    seen = set()
    count = 0
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        record = CorpusDocument.model_validate_json(line)
        key = (record.source_name, record.external_id)
        if key in seen:
            raise ValueError(f'Duplicate source key at record {count + 1}')
        seen.add(key)
        count += 1
    return {'documents': count, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'embedded': False}

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--validate-only',action='store_true',required=True)
    print(json.dumps(validate_corpus(parser.parse_args().input)))
