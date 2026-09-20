"""LangGraph workflow builder for ORCA orchestration."""

from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.core.logging import get_logger
from app.orchestration.state import OrcaState
from app.orchestration.planner import (
    understand_query,
    resolve_location,
    plan_tasks,
    run_agents,
    validate_data,
    assess_risk_node,
    build_evidence_node,
    synthesize_response,
)

logger = get_logger("orchestration.graph")


def build_orca_graph():
    """Construct and compile the ORCA LangGraph workflow.

    Flow:
        START → understand_query → resolve_location → plan_tasks
              → run_agents → validate_data → assess_risk
              → build_evidence → synthesize_response → END
    """
    graph = StateGraph(OrcaState)

    # Add nodes
    graph.add_node("understand_query", understand_query)
    graph.add_node("resolve_location", resolve_location)
    graph.add_node("plan_tasks", plan_tasks)
    graph.add_node("run_agents", run_agents)
    graph.add_node("validate_data", validate_data)
    graph.add_node("assess_risk", assess_risk_node)
    graph.add_node("build_evidence", build_evidence_node)
    graph.add_node("synthesize_response", synthesize_response)

    # Define edges
    graph.set_entry_point("understand_query")
    graph.add_edge("understand_query", "resolve_location")
    graph.add_edge("resolve_location", "plan_tasks")
    graph.add_edge("plan_tasks", "run_agents")
    graph.add_edge("run_agents", "validate_data")
    graph.add_edge("validate_data", "assess_risk")
    graph.add_edge("assess_risk", "build_evidence")
    graph.add_edge("build_evidence", "synthesize_response")
    graph.add_edge("synthesize_response", END)

    compiled = graph.compile()
    logger.info("ORCA LangGraph compiled successfully")
    return compiled
