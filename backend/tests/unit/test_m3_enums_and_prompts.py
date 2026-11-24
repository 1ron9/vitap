"""Unit tests cho Milestone 1 Task 1.1 – Enums & Prompts Loader (M3_PLAN_PHONG.md)."""
from __future__ import annotations

import pytest

try:
    from app.shared.enums import AnswerStatus, CitationType
except ImportError:
    from app.modules.ai_assistant.enums import AnswerStatus, CitationType

from app.modules.ai_assistant.prompts import load_prompt


def test_answer_status_contains_all_seven_states() -> None:
    expected = {
        "ANSWERED",
        "PARTIAL",
        "INSUFFICIENT_EVIDENCE",
        "CONFLICTING_EVIDENCE",
        "NEEDS_CLINICIAN",
        "EMERGENCY_REDIRECT",
        "OUT_OF_SCOPE",
    }
    actual = {member.value for member in AnswerStatus}
    assert actual == expected
    for name in expected:
        assert AnswerStatus(name).name == name


def test_citation_type_contains_all_four_types() -> None:
    expected = {
        "MEDICAL_DOCUMENT",
        "DRUG_DATABASE",
        "INTERACTION_RULE",
        "PERSONAL_PROFILE",
    }
    actual = {member.value for member in CitationType}
    assert actual == expected
    for name in expected:
        assert CitationType(name).name == name


def test_load_prompt_system_v2_contains_safety_rules() -> None:
    content = load_prompt("system_v2.md")
    assert isinstance(content, str)
    assert len(content.strip()) > 100
    assert "INSUFFICIENT_EVIDENCE" in content
    assert "<retrieved_evidence>" in content


def test_load_prompt_explain_ddi_v1_is_non_empty() -> None:
    content = load_prompt("explain_ddi_v1.md")
    assert isinstance(content, str)
    assert len(content.strip()) > 20


def test_load_prompt_missing_file_raises_file_not_found() -> None:
    with pytest.raises(FileNotFoundError):
        load_prompt("non_existent_prompt_v99.md")