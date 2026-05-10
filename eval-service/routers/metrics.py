"""
GET /metrics

Returns per-agent accuracy trends from scores stored in memory.
In production, these would be read from the database.
"""
from fastapi import APIRouter
from .evaluate import recent_scores
import statistics

router = APIRouter()


@router.get("")
async def get_metrics():
    if not recent_scores:
        return {
            "totalEvaluated": 0,
            "avgScore": 0,
            "trend": "stable",
            "recentScores": [],
        }

    avg = round(statistics.mean(recent_scores), 1)
    recent = recent_scores[-5:]

    # Trend: compare last 5 vs previous 5
    trend = "stable"
    if len(recent_scores) >= 10:
        prev_avg = statistics.mean(recent_scores[-10:-5])
        curr_avg = statistics.mean(recent_scores[-5:])
        if curr_avg > prev_avg + 5:
            trend = "improving"
        elif curr_avg < prev_avg - 5:
            trend = "declining"

    return {
        "totalEvaluated": len(recent_scores),
        "avgScore": avg,
        "trend": trend,
        "recentScores": recent,
    }
