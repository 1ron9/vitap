"""Dual-repo Unit Tests (Milestone 2): Hybrid Search RRF (k=60), BGE Reranker & Fallback.

Compatible with BOTH repositories without modification:
1. `ReallyEzyGame/demo-hybrid-rag-vibe-code` (`tests/test_hybrid_retrieval.py`)
2. `1ron9/vitap` (`backend/tests/unit/test_hybrid_retrieval.py`)
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import inspect
import math
import sys
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest

# Ensure `app.*` is importable whether tests run from repo root, `backend/`, or `tests/`
_HERE = Path(__file__).resolve()
for _parent in _HERE.parents:
    if (_parent / "app" / "modules" / "ai_assistant").is_dir():
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break
    if (_parent / "backend" / "app" / "modules" / "ai_assistant").is_dir():
        _backend = _parent / "backend"
        if str(_backend) not in sys.path:
            sys.path.insert(0, str(_backend))
        break

from app.modules.ai_assistant.domain import RetrievedChunk
from app.modules.ai_assistant.rag import retrieval as retrieval_mod
from app.modules.ai_assistant.rag.reranking import bge_client as bge_mod
from app.modules.ai_assistant.repositories import knowledge_repo as krepo_mod

BgeRerankerClient = bge_mod.BgeRerankerClient
KnowledgeRetriever = retrieval_mod.KnowledgeRetriever

# Detect repo variant cleanly via exported symbols
_IS_DEMO_BGE = hasattr(BgeRerankerClient, "score") and hasattr(bge_mod, "RerankerUnavailable")
_IS_DEMO_RETRIEVAL = "session" in inspect.signature(KnowledgeRetriever.retrieve).parameters


def _make_settings(**overrides):
    """Build settings compatible with both `AiAssistantSettings` and `RetrievalConfig`."""
    defaults = dict(
        vector_top_k=25,
        lexical_top_k=25,
        rrf_k=60,
        rrf_top_n=15,
        final_top_k=5,
        min_rerank_score=0.35,
        fallback_min_vector_similarity=0.50,
        fallback_min_lexical_score=0.30,
        reranker_timeout_s=3.0,
    )
    defaults.update(overrides)
    if hasattr(retrieval_mod, "RetrievalConfig"):
        return retrieval_mod.RetrievalConfig(
            vector_top_k=defaults["vector_top_k"],
            lexical_top_k=defaults["lexical_top_k"],
            rrf_k=defaults["rrf_k"],
            rrf_top_n=defaults["rrf_top_n"],
            final_top_k=defaults["final_top_k"],
            min_rerank_score=defaults["min_rerank_score"],
            fallback_min_vector_similarity=defaults["fallback_min_vector_similarity"],
            fallback_min_lexical_score=defaults["fallback_min_lexical_score"],
        )
    return SimpleNamespace(**defaults)


def _make_chunk(
    title: str,
    content: str,
    *,
    rrf_score: float = 0.025,
    vector_similarity: float | None = 0.72,
    lexical_score: float | None = 0.45,
) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=uuid4(),
        document_id=uuid4(),
        title=title,
        source_name="MedlinePlus (NIH)",
        source_url="https://medlineplus.gov/a1c.html",
        content=content,
        rrf_score=rrf_score,
        vector_similarity=vector_similarity,
        lexical_score=lexical_score,
    )


class _StubEmbedder:
    async def aembed_query(self, query: str) -> list[float]:
        return [0.01] * 768

    async def embed_query(self, query: str) -> list[float]:
        return [0.01] * 768


class _StubAsyncSession:
    @asynccontextmanager
    async def begin_nested(self):
        yield self


class _StubHybridRepo:
    def __init__(self, chunks: list[RetrievedChunk]) -> None:
        self._chunks = chunks
        self.calls: int = 0

    async def hybrid_search(self, *args, **kwargs) -> list[RetrievedChunk]:
        self.calls += 1
        return list(self._chunks)

    async def lexical_search(self, *args, **kwargs) -> list[RetrievedChunk]:
        self.calls += 1
        return list(self._chunks)


def _build_bge_client(base_url: str, handler, *, timeout_s: float = 3.0, **extra):
    transport = httpx.MockTransport(handler)
    sig = inspect.signature(BgeRerankerClient.__init__).parameters
    if "client" in sig:
        return BgeRerankerClient(base_url, timeout_s=timeout_s, client=httpx.AsyncClient(transport=transport))
    return BgeRerankerClient(base_url, timeout_s=timeout_s, transport=transport, **extra)


async def _call_bge(client, query: str, docs: list[str]):
    if hasattr(client, "score"):
        return await client.score(query, docs)
    return await client.rerank(query, docs)


def _build_retriever(repo, embedder, reranker, settings):
    if _IS_DEMO_RETRIEVAL:
        return KnowledgeRetriever(embeddings=embedder, repo=repo, reranker=reranker, settings=settings)
    return KnowledgeRetriever(repo=repo, embedder=embedder, reranker=reranker, config=settings)


async def _run_retrieve(retriever, query: str):
    if _IS_DEMO_RETRIEVAL:
        return await retriever.retrieve(session=_StubAsyncSession(), query=query)
    return await retriever.retrieve(query)


# =============================================================================
# 1. Hybrid Search SQL & RRF (k=60) Formula
# =============================================================================
def test_hybrid_sql_uses_rrf_k60_with_vector_and_lexical_branches():
    raw_sql = getattr(krepo_mod, "HYBRID_SEARCH_SQL", None) or getattr(krepo_mod, "_HYBRID_SQL", None)
    assert raw_sql is not None, "Expected HYBRID_SEARCH_SQL or _HYBRID_SQL in knowledge_repo.py"
    sql = str(raw_sql).lower()

    assert ":rrf_k" in sql
    assert "1.0 / (:rrf_k +" in sql or "1 / (:rrf_k +" in sql
    assert "full outer join" in sql
    assert "knowledge_chunks" in sql
    assert "knowledge_documents" in sql
    assert "<=>" in sql  # pgvector cosine distance


def test_rrf_k60_math_and_overlap_promotion():
    k = 60
    # Overlap at rank 2 in both dense & lexical must outrank single-branch rank 1
    both_rank2 = (1.0 / (k + 2)) + (1.0 / (k + 2))
    single_rank1 = 1.0 / (k + 1)
    assert both_rank2 > single_rank1

    if hasattr(krepo_mod, "compute_rrf_score"):
        assert math.isclose(krepo_mod.compute_rrf_score(1, 1, k=60), 2.0 / 61.0, rel_tol=1e-9)
        assert math.isclose(krepo_mod.compute_rrf_score(2, 2, k=60), both_rank2, rel_tol=1e-9)
        assert math.isclose(krepo_mod.compute_rrf_score(3, None, k=60), 1.0 / 63.0, rel_tol=1e-9)
        assert krepo_mod.compute_rrf_score(None, None, k=60) == 0.0

    if hasattr(krepo_mod, "fuse_ranked_chunks") and hasattr(krepo_mod, "RankedCandidate"):
        RC = krepo_mod.RankedCandidate
        c_both = RC(uuid4(), uuid4(), "A1C Test", "MedlinePlus", "https://medlineplus.gov/a1c.html", "HbA1c 6.2%.", 0.80)
        c_vec = RC(uuid4(), uuid4(), "Diabetes", "MedlinePlus", "https://medlineplus.gov/diabetes.html", "Diabetes.", 0.91)
        c_lex = RC(uuid4(), uuid4(), "Glucose", "MedlinePlus", "https://medlineplus.gov/glucose.html", "Glucose.", 0.85)
        fused = krepo_mod.fuse_ranked_chunks([c_vec, c_both], [c_lex, c_both], k=60, top_n=15)
        assert fused[0].chunk_id == c_both.chunk_id
        assert math.isclose(fused[0].rrf_score, both_rank2, rel_tol=1e-9)


# =============================================================================
# 2. BGE Reranker Client (Success, Timeout 3.0s, Offline / Circuit Breaker)
# =============================================================================
def test_bge_client_success_clamps_scores_and_sets_ngrok_header():
    async def _run():
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path.endswith("/rerank")
            assert request.headers.get("ngrok-skip-browser-warning") == "true"
            return httpx.Response(200, json={"scores": [0.92, 0.21, 1.45]})

        client = _build_bge_client("https://demo-ngrok.ngrok-free.app", handler, timeout_s=3.0)
        scores = await _call_bge(client, "HbA1c 6.2%", ["doc1", "doc2", "doc3"])
        assert scores == [0.92, 0.21, 1.0]

    asyncio.run(_run())


def test_bge_client_timeout_and_503_fail_safely():
    async def _run():
        def timeout_handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("Ngrok tunnel timed out (>3.0s)")

        client = _build_bge_client("https://offline.ngrok-free.app", timeout_handler, timeout_s=3.0)
        if _IS_DEMO_BGE:
            with pytest.raises(bge_mod.RerankerUnavailable):
                await _call_bge(client, "q", ["d1"])
        else:
            assert await _call_bge(client, "q", ["d1"]) is None

        def err_handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, text="Tunnel Offline")

        client2 = _build_bge_client("https://offline.ngrok-free.app", err_handler, timeout_s=3.0)
        if _IS_DEMO_BGE:
            with pytest.raises(bge_mod.RerankerUnavailable):
                await _call_bge(client2, "q", ["d1"])
        else:
            assert await _call_bge(client2, "q", ["d1"]) is None

    asyncio.run(_run())


def test_bge_client_circuit_breaker_when_supported():
    if not hasattr(bge_mod, "CircuitState"):
        return  # demo-hybrid-rag-vibe-code handles fallback at KnowledgeRetriever layer

    async def _run():
        now = [100.0]
        calls = [0]

        def handler(request: httpx.Request) -> httpx.Response:
            calls[0] += 1
            if calls[0] <= 2:
                raise httpx.ReadTimeout("timeout")
            return httpx.Response(200, json={"scores": [0.85]})

        client = _build_bge_client(
            "https://cb.ngrok-free.app",
            handler,
            timeout_s=3.0,
            failure_threshold=2,
            cooldown_s=30.0,
            clock=lambda: now[0],
        )
        assert await client.rerank("q", ["d1"]) is None
        assert await client.rerank("q", ["d1"]) is None
        assert client.state is bge_mod.CircuitState.OPEN

        # Fast-fail while OPEN (no network call)
        assert await client.rerank("q", ["d1"]) is None
        assert calls[0] == 2

        # Cooldown elapsed -> HALF_OPEN -> recovers to CLOSED
        now[0] += 31.0
        assert client.state is bge_mod.CircuitState.HALF_OPEN
        assert await client.rerank("q", ["d1"]) == [0.85]
        assert client.state is bge_mod.CircuitState.CLOSED

    asyncio.run(_run())


# =============================================================================
# 3. KnowledgeRetriever End-to-End (Rerank Gate, Fallback Floor, Abstention)
# =============================================================================
def test_retriever_reranks_and_filters_below_min_rerank_score():
    async def _run():
        c_noise = _make_chunk("Noise Doc", "Unrelated dental hygiene note.", rrf_score=0.032)
        c_best = _make_chunk("A1C Test", "Prediabetes is between 5.7% and 6.4%.", rrf_score=0.020)
        c_mid = _make_chunk("Diabetes Care", "Monitor A1C every 3 months.", rrf_score=0.018)

        # Input order to reranker: [c_noise, c_best, c_mid] -> scores [0.19, 0.88, 0.42]
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"scores": [0.19, 0.88, 0.42]})

        repo = _StubHybridRepo([c_noise, c_best, c_mid])
        reranker = _build_bge_client("https://rerank.test", handler)
        retriever = _build_retriever(repo, _StubEmbedder(), reranker, _make_settings(min_rerank_score=0.35))

        res = await _run_retrieve(retriever, "Chỉ số A1C 6.2% là gì?")
        assert [c.title for c in res.chunks] == ["A1C Test", "Diabetes Care"]
        if _IS_DEMO_RETRIEVAL:
            assert res.mode == "RERANKED"
            assert res.sufficient is True
        else:
            assert res.used_reranker is True
            assert res.reranker_fallback is False
            assert res.filtered_out_count == 1

    asyncio.run(_run())


def test_retriever_falls_back_to_rrf_topk_with_floor_when_reranker_offline():
    async def _run():
        c_vec = _make_chunk("Metformin", "First-line for type 2 diabetes.", rrf_score=0.031, vector_similarity=0.78, lexical_score=0.40)
        c_lex = _make_chunk("HbA1c", "HbA1c threshold is 6.5%.", rrf_score=0.029, vector_similarity=0.41, lexical_score=0.55)
        c_low = _make_chunk("Low Noise", "Irrelevant text.", rrf_score=0.025, vector_similarity=0.20, lexical_score=0.10)

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, text="Tunnel Offline")

        repo = _StubHybridRepo([c_vec, c_lex, c_low])
        reranker = _build_bge_client("https://offline.test", handler)
        retriever = _build_retriever(repo, _StubEmbedder(), reranker, _make_settings())

        res = await _run_retrieve(retriever, "Metformin và HbA1c")
        assert [c.title for c in res.chunks] == ["Metformin", "HbA1c"]
        if _IS_DEMO_RETRIEVAL:
            assert res.mode == "RRF_FALLBACK"
        else:
            assert res.used_reranker is False
            assert res.reranker_fallback is True

    asyncio.run(_run())


def test_retriever_abstains_when_all_scores_below_threshold():
    async def _run():
        c1 = _make_chunk("Unrelated 1", "Random text.", rrf_score=0.020)
        c2 = _make_chunk("Unrelated 2", "Other text.", rrf_score=0.015)

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"scores": [0.12, 0.28]})

        repo = _StubHybridRepo([c1, c2])
        reranker = _build_bge_client("https://rerank.test", handler)
        retriever = _build_retriever(repo, _StubEmbedder(), reranker, _make_settings(min_rerank_score=0.35))

        res = await _run_retrieve(retriever, "Bệnh hiếm không có trong kho tri thức")
        assert res.chunks == []
        if _IS_DEMO_RETRIEVAL:
            assert res.sufficient is False
        else:
            assert res.has_evidence is False

    asyncio.run(_run())


def test_min_rerank_score_threshold_0_35_separates_relevant_vs_noise():
    samples = [
        (0.91, True), (0.84, True), (0.72, True), (0.58, True), (0.44, True), (0.37, True),
        (0.31, False), (0.24, False), (0.18, False), (0.12, False), (0.05, False),
    ]
    if hasattr(retrieval_mod, "evaluate_rerank_thresholds"):
        rows = retrieval_mod.evaluate_rerank_thresholds(samples, thresholds=(0.25, 0.35, 0.45))
        by_th = {r.threshold: r for r in rows}
        assert by_th[0.35].f1 == 1.0
        assert by_th[0.35].abstention_accuracy == 1.0
    else:
        kept_035 = [rel for score, rel in samples if score >= 0.35]
        dropped_035 = [rel for score, rel in samples if score < 0.35]
        assert all(kept_035) and not any(dropped_035)