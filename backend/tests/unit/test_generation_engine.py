"""Unit tests cho Lớp 2 LcelGenerationEngine – Milestone 1 (Technical Design §7.1, §7.2, §11.3)."""
from __future__ import annotations

import asyncio
from typing import Any

import pytest
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.modules.ai_assistant.config import AiAssistantSettings
from app.modules.ai_assistant.enums import AnswerStatus, WarningLevel
from app.modules.ai_assistant.rag.generation.lcel_chain import GenerationUnavailable, LcelGenerationEngine


class _FakeChatModel(BaseChatModel):
    responses: list[Any]
    calls: int = 0
    delay_s: float = 0.0

    @property
    def _llm_type(self) -> str:
        return "fake-chat-model"

    def _generate(self, messages: list[BaseMessage], stop: list[str] | None = None, **kwargs: Any) -> ChatResult:
        raise NotImplementedError("Async-only fake")

    async def _agenerate(self, messages: list[BaseMessage], stop: list[str] | None = None, **kwargs: Any) -> ChatResult:
        self.calls += 1
        if self.delay_s > 0:
            await asyncio.sleep(self.delay_s)
        item = self.responses.pop(0) if self.responses else RuntimeError("no scripted response")
        if isinstance(item, BaseException):
            raise item
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=str(item)))])


def _chat_vars(question: str = "A1C là gì?") -> dict[str, Any]:
    return {
        "history": "Không có",
        "personal_context": "Không áp dụng (GENERAL)",
        "interaction_result": "Không có",
        "evidence": "[1] MedlinePlus: A1C là xét nghiệm đường huyết trung bình 2-3 tháng.",
        "hints": "NONE",
        "question": question,
    }


def _explain_vars() -> dict[str, Any]:
    return {
        "personal_context": "Không áp dụng",
        "interaction_result": "Warfarin + Aspirin: MAJOR",
        "evidence": "[1] DDInter: Tăng nguy cơ xuất huyết.",
    }


VALID_CHAT_JSON = (
    '{"content": "A1C đo đường huyết trung bình [1].", '
    '"answer_status": "ANSWERED", '
    '"warning_level": "INFO", '
    '"cited_ids": [1], '
    '"suggested_followups": ["Ngưỡng A1C bình thường là bao nhiêu?"]}'
)

VALID_EXPLAIN_JSON = (
    '{"explanation": "Dùng chung hai thuốc này làm tăng nguy cơ chảy máu [1].", '
    '"clinical_management": "Tham vấn bác sĩ trước khi phối hợp.", '
    '"cited_ids": [1]}'
)


def _settings(primary_timeout: float = 1.0, fallback_timeout: float = 1.0) -> AiAssistantSettings:
    return AiAssistantSettings(
        primary_llm_model="gemini-3.1-flash-lite",
        fallback_llm_model="medgemma",
        primary_llm_timeout_s=primary_timeout,
        fallback_llm_timeout_s=fallback_timeout,
    )


def test_primary_success_does_not_call_fallback() -> None:
    primary = _FakeChatModel(responses=[VALID_CHAT_JSON])
    fallback = _FakeChatModel(responses=[VALID_CHAT_JSON])
    engine = LcelGenerationEngine.from_models(primary, fallback, _settings())

    res = asyncio.run(engine.generate("chat", _chat_vars()))
    assert res.model_used == "gemini-3.1-flash-lite"
    assert res.parsed.answer_status is AnswerStatus.ANSWERED
    assert res.parsed.warning_level is WarningLevel.INFO
    assert primary.calls == 1
    assert fallback.calls == 0


@pytest.mark.parametrize(
    "primary_failure",
    [
        RuntimeError("429 Quota Exceeded"),
        ValueError("503 Service Unavailable"),
        "",
        "not valid json at all",
    ],
)
def test_one_way_fallback_to_medgemma_on_primary_failure(primary_failure: Any) -> None:
    primary = _FakeChatModel(responses=[primary_failure])
    fallback = _FakeChatModel(responses=[VALID_CHAT_JSON])
    engine = LcelGenerationEngine.from_models(primary, fallback, _settings())

    res = asyncio.run(engine.generate("chat", _chat_vars()))
    assert res.model_used == "medgemma"
    assert res.parsed.cited_ids == [1]
    assert primary.calls == 1
    assert fallback.calls == 1


def test_one_way_fallback_on_primary_timeout() -> None:
    primary = _FakeChatModel(responses=[VALID_CHAT_JSON], delay_s=0.30)
    fallback = _FakeChatModel(responses=[VALID_CHAT_JSON])
    engine = LcelGenerationEngine.from_models(primary, fallback, _settings(primary_timeout=0.05))

    res = asyncio.run(engine.generate("chat", _chat_vars()))
    assert res.model_used == "medgemma"
    assert primary.calls == 1
    assert fallback.calls == 1


def test_both_routes_fail_raises_generation_unavailable_without_looping() -> None:
    primary = _FakeChatModel(responses=[RuntimeError("429"), VALID_CHAT_JSON])
    fallback = _FakeChatModel(responses=[RuntimeError("Ngrok offline")])
    engine = LcelGenerationEngine.from_models(primary, fallback, _settings())

    with pytest.raises(GenerationUnavailable):
        asyncio.run(engine.generate("chat", _chat_vars()))

    # Strict one-way: primary called once, fallback called once, never loops back to primary
    assert primary.calls == 1
    assert fallback.calls == 1


def test_explain_kind_parses_llm_explain_answer() -> None:
    primary = _FakeChatModel(responses=[RuntimeError("500")])
    fallback = _FakeChatModel(responses=[VALID_EXPLAIN_JSON])
    engine = LcelGenerationEngine.from_models(primary, fallback, _settings())

    res = asyncio.run(engine.generate("explain", _explain_vars()))
    assert res.model_used == "medgemma"
    assert "chảy máu" in res.parsed.explanation
    assert res.parsed.cited_ids == [1]