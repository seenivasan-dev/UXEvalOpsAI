"""
Visual Hierarchy Agent
Evaluates F-pattern/Z-pattern reading flow, CTA prominence, whitespace,
and visual weight distribution.
"""
import time
from .base import create_agent_chain

SYSTEM_PROMPT = """You are a UX expert specializing in visual hierarchy and layout design.
Evaluate the screenshot for:
1. Reading flow (F-pattern, Z-pattern alignment)
2. CTA prominence and visual weight
3. Whitespace usage and breathing room
4. Information density and cognitive load

Return ONLY valid JSON in this exact structure (no markdown, no explanation):
{
  "score": <integer 0-100>,
  "status": "<good|warning|critical>",
  "findings": [
    {"severity": "<high|medium|low>", "title": "<short title>", "detail": "<specific observation>"}
  ],
  "recommendation": "<single actionable improvement>"
}

Rules:
- score 80-100 = good, 60-79 = warning, 0-59 = critical
- Include 1-4 findings
- Be specific and concrete, not generic
"""

EVAL_PROMPT = """Analyze the visual hierarchy of this UI screenshot.
Identify any issues with reading flow, CTA visibility, or whitespace that would reduce user effectiveness.
Return your analysis as JSON per the schema in your system prompt."""


def evaluate(image_base64: str) -> dict:
    start = time.time()
    chain = create_agent_chain(SYSTEM_PROMPT)
    result = chain.invoke(
        {"image_base64": image_base64, "evaluation_prompt": EVAL_PROMPT}
    )
    result["agent"] = "Visual Hierarchy"
    result["reflected"] = False
    result["durationMs"] = int((time.time() - start) * 1000)
    return result
