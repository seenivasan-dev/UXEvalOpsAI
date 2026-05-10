"""
POST /evaluate

Scores an agent output batch for:
- Completeness: all required fields present?
- Schema compliance: correct types?
- Severity calibration: does severity distribution make sense?
- Drift flag: is the score dramatically different from recent average?
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any
import statistics
import json
import os

router = APIRouter()

REQUIRED_AGENT_FIELDS = {"agent", "score", "status", "findings", "recommendation"}
VALID_STATUSES = {"good", "warning", "critical"}
VALID_SEVERITIES = {"high", "medium", "low"}

# In-memory store for drift detection (resets on restart — fine for demo)
recent_scores: list[int] = []


class AgentOutput(BaseModel):
    agent: str | None = None
    agentName: str | None = None
    score: int
    status: str
    findings: list[Any]
    recommendation: str
    reflected: bool = False
    durationMs: int | None = None


class EvaluateRequest(BaseModel):
    evaluationId: str
    agents: list[AgentOutput]


class EvalResult(BaseModel):
    evaluationId: str
    completeness: float
    schemaCompliance: float
    driftFlag: bool
    agentBreakdown: list[dict]


def score_agent(agent: AgentOutput) -> dict:
    name = agent.agent or agent.agentName or "Unknown"
    issues = []

    # Completeness check
    present_fields = 0
    total_fields = len(REQUIRED_AGENT_FIELDS)

    if name and name != "Unknown":
        present_fields += 1
    if agent.score is not None:
        present_fields += 1
    if agent.status:
        present_fields += 1
    if agent.findings is not None:
        present_fields += 1
    if agent.recommendation:
        present_fields += 1

    completeness = present_fields / total_fields

    # Schema compliance checks
    compliance_checks = 0
    total_checks = 4

    # Score range 0-100
    if isinstance(agent.score, int) and 0 <= agent.score <= 100:
        compliance_checks += 1
    else:
        issues.append("score out of 0-100 range or wrong type")

    # Status must be valid enum
    if agent.status in VALID_STATUSES:
        compliance_checks += 1
    else:
        issues.append(f"status '{agent.status}' is not one of {VALID_STATUSES}")

    # Findings must be a list
    if isinstance(agent.findings, list):
        compliance_checks += 1
        # Each finding should have severity/title/detail
        for f in agent.findings:
            if isinstance(f, dict):
                if f.get("severity") not in VALID_SEVERITIES:
                    issues.append(f"finding has invalid severity: {f.get('severity')}")
    else:
        issues.append("findings is not a list")

    # Recommendation must be non-empty string
    if isinstance(agent.recommendation, str) and len(agent.recommendation) > 0:
        compliance_checks += 1
    else:
        issues.append("recommendation is empty or wrong type")

    schema_compliance = compliance_checks / total_checks

    return {
        "agent": name,
        "completeness": completeness,
        "schemaCompliance": schema_compliance,
        "issues": issues,
    }


@router.post("", response_model=EvalResult)
async def evaluate(request: EvaluateRequest):
    breakdowns = [score_agent(a) for a in request.agents]

    avg_completeness = statistics.mean(b["completeness"] for b in breakdowns) if breakdowns else 0.0
    avg_schema = statistics.mean(b["schemaCompliance"] for b in breakdowns) if breakdowns else 0.0

    # Drift detection: flag if overall score differs >20 points from recent average
    scores = [a.score for a in request.agents if isinstance(a.score, int)]
    current_avg = round(statistics.mean(scores)) if scores else 0

    drift_flag = False
    if len(recent_scores) >= 3:
        historical_avg = statistics.mean(recent_scores[-10:])
        drift_flag = abs(current_avg - historical_avg) > 20

    recent_scores.append(current_avg)

    return EvalResult(
        evaluationId=request.evaluationId,
        completeness=round(avg_completeness, 3),
        schemaCompliance=round(avg_schema, 3),
        driftFlag=drift_flag,
        agentBreakdown=breakdowns,
    )
