"""
Synthesis Agent — AI Patterns: TOOL USE + ORCHESTRATOR-SYNTHESIS

1. Tool Use: calls calculate_weighted_score() to compute the final score
   using domain-specific weights before passing to the LLM
2. Orchestrator-Synthesis: receives all 4 agent outputs, synthesizes
   a holistic evaluation with top issues and actionable summary
"""
import json
import time
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from .base import create_llm

# --- Tool Use Pattern ---
@tool
def calculate_weighted_score(
    visual_score: int,
    accessibility_score: int,
    copy_score: int,
    consistency_score: int,
) -> dict:
    """
    Calculate the weighted UX score with domain-specific weights:
    - Accessibility: 35% (WCAG compliance is legally critical)
    - Design Consistency: 25% (brand coherence impacts trust)
    - Visual Hierarchy: 20% (directly affects task completion)
    - Copy and Tone: 20% (affects comprehension)

    Returns the weighted score and letter grade.
    """
    weighted = (
        accessibility_score * 0.35
        + consistency_score * 0.25
        + visual_score * 0.20
        + copy_score * 0.20
    )
    score = round(weighted)

    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 70:
        grade = "C"
    elif score >= 60:
        grade = "D"
    else:
        grade = "F"

    return {"overallScore": score, "grade": grade, "weights": {
        "accessibility": 0.35,
        "consistency": 0.25,
        "visual": 0.20,
        "copy": 0.20,
    }}


SYNTHESIS_SYSTEM_PROMPT = """You are a senior UX lead synthesizing a multi-agent evaluation.
You have received scores and findings from 4 specialist agents and a weighted score calculation.

Your task:
1. Identify the top 3 most impactful issues across all agents
2. Write a 2-3 sentence executive summary for a product team
3. Return the complete synthesis as JSON

Return ONLY valid JSON (no markdown):
{
  "topIssues": ["<issue 1>", "<issue 2>", "<issue 3>"],
  "summary": "<2-3 sentence executive summary>"
}
"""


def synthesize(agent_results: list[dict], score_data: dict) -> dict:
    """
    Orchestrator-Synthesis pattern:
    Calls the calculate_weighted_score tool, then asks the LLM
    to synthesize findings into a holistic executive report.
    """
    llm = create_llm()

    findings_text = json.dumps(
        [
            {
                "agent": r.get("agent", r.get("agentName", "Unknown")),
                "score": r.get("score"),
                "findings": r.get("findings", []),
            }
            for r in agent_results
        ],
        indent=2,
    )

    messages = [
        SystemMessage(content=SYNTHESIS_SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"Agent findings:\n{findings_text}\n\n"
                f"Weighted score calculation: {json.dumps(score_data)}\n\n"
                "Identify the top 3 most critical issues and write an executive summary."
            )
        ),
    ]

    from langchain_core.output_parsers import JsonOutputParser
    parser = JsonOutputParser()
    response = llm.invoke(messages)
    synthesis = parser.parse(response.content)

    return {
        "overallScore": score_data["overallScore"],
        "grade": score_data["grade"],
        "topIssues": synthesis.get("topIssues", []),
        "summary": synthesis.get("summary", ""),
    }
