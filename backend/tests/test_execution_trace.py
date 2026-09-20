"""Tests for execution trace generation."""

import os
os.environ.setdefault("LLM_PROVIDER", "huggingface")
os.environ.setdefault("HF_MODEL", "test-model")

from app.schemas.query import ExecutionStep


def test_execution_step_defaults():
    step = ExecutionStep(step="test_step")
    assert step.status == "pending"
    assert step.message == ""


def test_execution_step_completed():
    step = ExecutionStep(step="weather_agent", status="completed", message="Wind 18 km/h")
    assert step.status == "completed"
    assert "Wind" in step.message


def test_execution_step_with_duration():
    step = ExecutionStep(step="marine_agent", status="completed", duration_ms=450.2)
    assert step.duration_ms == 450.2


def test_trace_is_list():
    """Execution trace should accumulate as a list."""
    trace: list[ExecutionStep] = []
    trace.append(ExecutionStep(step="step_1", status="completed"))
    trace.append(ExecutionStep(step="step_2", status="completed"))
    trace.append(ExecutionStep(step="step_3", status="failed", message="Timeout"))

    assert len(trace) == 3
    assert trace[2].status == "failed"
    assert "Timeout" in trace[2].message
