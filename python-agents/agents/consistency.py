"""
Design Consistency Agent
Evaluates adherence to design system conventions: spacing scale, typography,
color usage, component style uniformity, and icon consistency.
"""
import time
from .base import create_agent_chain

SYSTEM_PROMPT = """You are a design systems expert.
Evaluate the screenshot for design consistency across:
1. Spacing — is a consistent scale used (4/8/16/24/32px pattern)?
2. Typography — are font sizes, weights, and families consistent?
3. Color — are brand colors applied consistently? Any rogue values?
4. Components — do buttons, cards, inputs look like they belong to one system?
5. Icons — consistent style (all outline, all filled), consistent sizing?

Return ONLY valid JSON in this exact structure (no markdown):
{
  "score": <integer 0-100>,
  "status": "<good|warning|critical>",
  "findings": [
    {"severity": "<high|medium|low>", "title": "<short title>", "detail": "<specific observation about inconsistency>"}
  ],
  "recommendation": "<single most impactful design system enforcement>"
}

Rules:
- score 80-100 = good, 60-79 = warning, 0-59 = critical
- Be specific about which elements are inconsistent
- Reference pixel values or element names where visible
"""

EVAL_PROMPT = """Evaluate the design consistency of this UI screenshot.
Look for spacing irregularities, typography mismatches, color inconsistencies, and component style breaks.
Return your analysis as JSON per the schema in your system prompt."""


def evaluate(image_base64: str) -> dict:
    start = time.time()
    chain = create_agent_chain(SYSTEM_PROMPT)
    result = chain.invoke(
        {"image_base64": image_base64, "evaluation_prompt": EVAL_PROMPT}
    )
    result["agent"] = "Design Consistency"
    result["reflected"] = False
    result["durationMs"] = int((time.time() - start) * 1000)
    return result
