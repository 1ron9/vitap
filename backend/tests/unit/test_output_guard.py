"""Unit tests an toàn y tế cho Lớp 3 OutputGuard – Milestone 1 (Technical Design §2.2, §6.2)."""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.modules.ai_assistant.domain import EvidenceItem, InteractionContext
from app.modules.ai_assistant.enums import AnswerStatus, CitationType, WarningLevel
from app.modules.ai_assistant.integration import InteractionReport, PairResult, ReportSummary
from app.modules.ai_assistant.rag.guards.messages import CLINICIAN_FALLBACK_MESSAGE, INSUFFICIENT_EVIDENCE_MESSAGE
from app.modules.ai_assistant.rag.guards.output_guard import OutputGuard, extract_marker_ids
from app.modules.ai_assistant.schemas.llm_output import LLMGeneratedAnswer

guard = OutputGuard()


def _ev(cid: int, severity_hint: str | None = None) -> EvidenceItem:
    return EvidenceItem(
        citation_id=cid,
        citation_type=CitationType.MEDICAL_DOCUMENT,
        source_title=f"Nguồn {cid}",
        text="Nội dung y khoa kiểm chứng.",
        excerpt="Nội dung y khoa...",
        document_id=uuid4(),
        chunk_id=uuid4(),
        severity_hint=severity_hint,
    )


def _ans(
    content: str,
    status: AnswerStatus = AnswerStatus.ANSWERED,
    level: WarningLevel = WarningLevel.INFO,
    cited: list[int] | None = None,
    followups: list[str] | None = None,
) -> LLMGeneratedAnswer:
    return LLMGeneratedAnswer(
        content=content,
        answer_status=status,
        warning_level=level,
        cited_ids=cited if cited is not None else [],
        suggested_followups=followups if followups is not None else [],
    )


def _ctx(status: str, severity: str | None = None, *, asked: bool = True, unavailable: bool = False) -> InteractionContext:
    pair = PairResult(selection_a="drug_a", selection_b="drug_b", status=status, highest_severity=severity)
    report = InteractionReport(summary=ReportSummary(overall_status=status), pairs=[pair])
    return InteractionContext(report=None if unavailable else report, asked=asked, unavailable=unavailable)


def test_marker_extraction_handles_single_and_grouped_citations() -> None:
    assert extract_marker_ids("A [1] và B [2, 3] cùng C [4; 5][6]") == [1, 2, 3, 4, 5, 6]


def test_valid_citations_pass_without_violations() -> None:
    guarded = guard.validate(_ans("A1C 6.2% nằm trong ngưỡng tiền tiểu đường [1].", cited=[1]), [_ev(1), _ev(2)])
    assert guarded.answer_status is AnswerStatus.ANSWERED
    assert guarded.warning_level is WarningLevel.INFO
    assert [c.citation_id for c in guarded.citations] == [1]
    assert guarded.violations == []


def test_ghost_citation_is_stripped_and_downgraded_to_partial() -> None:
    guarded = guard.validate(_ans("Thông tin A [1]. Thông tin bịa [9].", cited=[1, 9]), [_ev(1)])
    assert "[9]" not in guarded.content
    assert "[1]" in guarded.content
    assert "INVALID_CITATION_REMOVED" in guarded.violations
    assert guarded.answer_status is AnswerStatus.PARTIAL
    assert guarded.warning_level is WarningLevel.WARNING
    assert [c.citation_id for c in guarded.citations] == [1]


def test_only_ghost_citations_forces_insufficient_evidence() -> None:
    guarded = guard.validate(_ans("Khẳng định y khoa [7].", cited=[7]), [_ev(1)])
    assert guarded.answer_status is AnswerStatus.INSUFFICIENT_EVIDENCE
    assert guarded.content == INSUFFICIENT_EVIDENCE_MESSAGE
    assert guarded.citations == []
    assert "NO_VALID_CITATION" in guarded.violations


def test_answered_without_any_evidence_is_rejected() -> None:
    guarded = guard.validate(_ans("Paracetamol dùng cho người lớn.", cited=[]), [])
    assert guarded.answer_status is AnswerStatus.INSUFFICIENT_EVIDENCE
    assert guarded.content == INSUFFICIENT_EVIDENCE_MESSAGE
    assert "ANSWER_WITHOUT_EVIDENCE" in guarded.violations


@pytest.mark.parametrize(
    "forbidden_phrase",
    [
        "Hai thuốc này hoàn toàn an toàn khi dùng chung [1].",
        "Bạn có thể uống chung không sao cả [1].",
        "Không có bất kỳ tương tác nào giữa hai thuốc này [1].",
        "Hai thuốc này tuyệt đối an toàn, kết hợp thoải mái [1].",
    ],
)
def test_forbidden_safe_claims_are_blocked(forbidden_phrase: str) -> None:
    interaction = _ctx("NO_KNOWN_INTERACTION_IN_DATABASE", asked=True)
    guarded = guard.validate(_ans(forbidden_phrase, cited=[1]), [_ev(1)], interaction=interaction)
    assert "SAFE_CLAIM_BLOCKED" in guarded.violations
    assert guarded.answer_status is AnswerStatus.NEEDS_CLINICIAN
    assert guarded.warning_level is WarningLevel.WARNING
    assert guarded.citations == []
    assert "bác sĩ hoặc dược sĩ" in guarded.content.lower()


@pytest.mark.parametrize(
    "directive_text",
    [
        "Bạn nên tự ý ngưng thuốc huyết áp từ hôm nay [1].",
        "Hãy tăng liều gấp đôi để nhanh khỏi bệnh [1].",
        "Chẩn đoán của bạn là đái tháo đường tuýp 2 [1].",
        "Chắc chắn bạn bị viêm phổi cấp rồi [1].",
    ],
)
def test_unnegated_clinical_directives_are_blocked(directive_text: str) -> None:
    guarded = guard.validate(_ans(directive_text, cited=[1]), [_ev(1)])
    assert "CLINICAL_DIRECTIVE_BLOCKED" in guarded.violations
    assert guarded.content == CLINICIAN_FALLBACK_MESSAGE
    assert guarded.answer_status is AnswerStatus.NEEDS_CLINICIAN
    assert guarded.warning_level is WarningLevel.WARNING


def test_negated_directive_is_allowed() -> None:
    guarded = guard.validate(_ans("Bạn không nên tự ý ngưng thuốc mà cần hỏi bác sĩ [1].", cited=[1]), [_ev(1)])
    assert "CLINICAL_DIRECTIVE_BLOCKED" not in guarded.violations
    assert guarded.answer_status is AnswerStatus.ANSWERED


def test_diagnosis_hint_prevents_answered_status() -> None:
    guarded = guard.validate(
        _ans("Đau bụng có thể liên quan đến nhiều nguyên nhân tiêu hóa [1].", cited=[1]),
        [_ev(1)],
        diagnosis_hint=True,
    )
    assert guarded.answer_status is AnswerStatus.NEEDS_CLINICIAN
    assert guarded.warning_level is WarningLevel.WARNING
    assert "DIAGNOSIS_FORCED_NEEDS_CLINICIAN" in guarded.violations


def test_interaction_gap_downgrades_answered_to_partial() -> None:
    interaction = _ctx("INSUFFICIENT_DATA", asked=True)
    guarded = guard.validate(_ans("Thông tin tham khảo về thuốc [1].", cited=[1]), [_ev(1)], interaction=interaction)
    assert guarded.answer_status is AnswerStatus.PARTIAL
    assert guarded.warning_level is WarningLevel.WARNING
    assert "INTERACTION_GAP_DOWNGRADED" in guarded.violations


def test_major_interaction_escalates_warning_to_critical() -> None:
    interaction = _ctx("INTERACTION_FOUND", severity="MAJOR", asked=True)
    guarded = guard.validate(_ans("Hai thuốc có tương tác nghiêm trọng [1].", cited=[1]), [_ev(1)], interaction=interaction)
    assert guarded.warning_level is WarningLevel.CRITICAL


def test_red_evidence_escalates_warning_level() -> None:
    guarded = guard.validate(_ans("Tránh uống rượu khi dùng thuốc này [1].", cited=[1]), [_ev(1, severity_hint="RED")])
    assert guarded.warning_level is WarningLevel.WARNING
    assert "RED_EVIDENCE_ESCALATED" in guarded.violations


def test_llm_emergency_redirect_ensures_115_and_critical_level() -> None:
    guarded = guard.validate(
        _ans("Tình trạng này rất nguy hiểm, cần đi bệnh viện ngay.", status=AnswerStatus.EMERGENCY_REDIRECT, level=WarningLevel.INFO),
        [_ev(1)],
    )
    assert guarded.answer_status is AnswerStatus.EMERGENCY_REDIRECT
    assert guarded.warning_level is WarningLevel.CRITICAL
    assert "115" in guarded.content


def test_suggested_followups_capped_at_three_non_empty_items() -> None:
    guarded = guard.validate(
        _ans("Thông tin chuẩn [1].", cited=[1], followups=["  Câu 1  ", "", "Câu 2", "Câu 3", "Câu 4"]),
        [_ev(1)],
    )
    assert guarded.followups == ["Câu 1", "Câu 2", "Câu 3"]