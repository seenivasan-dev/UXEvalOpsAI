"""
Coordinator — AI Pattern: PARALLELIZATION

Runs all 4 specialist agents concurrently with asyncio.gather,
then passes results to the Synthesis agent.

This is the orchestrator for the multi-agent pipeline.
"""
import asyncio
import time
import uuid
import sys
from datetime import datetime, timezone

from agents import visual_hierarchy, accessibility, copy_tone, consistency
from agents.synthesis import calculate_weighted_score, synthesize


async def run_evaluation(image_base64: str) -> dict:
    start = time.time()

    print("[coordinator] starting parallel agent execution", file=sys.stderr)

    # --- Parallelization Pattern ---
    # Run all 4 agents concurrently — not sequentially
    # return_exceptions=True: one agent failure doesn't kill the rest
    results = await asyncio.gather(
        asyncio.to_thread(visual_hierarchy.evaluate, image_base64),
        asyncio.to_thread(accessibility.evaluate, image_base64),
        asyncio.to_thread(copy_tone.evaluate, image_base64),
        asyncio.to_thread(consistency.evaluate, image_base64),
        return_exceptions=True,
    )

    agent_results = []
    for i, result in enumerate(results):
        agent_names = ["Visual Hierarchy", "Accessibility", "Copy and Tone", "Design Consistency"]
        if isinstance(result, Exception):
            print(f"[coordinator] agent {agent_names[i]} failed: {result}", file=sys.stderr)
            # Fallback result for failed agent — system keeps running
            agent_results.append({
                "agent": agent_names[i],
                "score": 0,
                "status": "critical",
                "findings": [{"severity": "high", "title": "Agent error", "detail": str(result)}],
                "recommendation": "Agent failed to complete evaluation. Please retry.",
                "reflected": False,
                "durationMs": 0,
            })
        else:
            print(f"[coordinator] {agent_names[i]} completed, score={result.get('score')}", file=sys.stderr)
            agent_results.append(result)

    # --- Tool Use Pattern: calculate_weighted_score ---
    visual = next((r for r in agent_results if r.get("agent") == "Visual Hierarchy"), {})
    access = next((r for r in agent_results if r.get("agent") == "Accessibility"), {})
    copy = next((r for r in agent_results if r.get("agent") == "Copy and Tone"), {})
    consist = next((r for r in agent_results if r.get("agent") == "Design Consistency"), {})

    score_data = calculate_weighted_score.invoke({
        "visual_score": visual.get("score", 0),
        "accessibility_score": access.get("score", 0),
        "copy_score": copy.get("score", 0),
        "consistency_score": consist.get("score", 0),
    })

    # --- Orchestrator-Synthesis Pattern ---
    synthesis = synthesize(agent_results, score_data)

    duration = round(time.time() - start, 2)

    return {
        "runId": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "durationSeconds": duration,
        "overallScore": synthesis["overallScore"],
        "grade": synthesis["grade"],
        "topIssues": synthesis["topIssues"],
        "summary": synthesis["summary"],
        "agents": agent_results,
    }
