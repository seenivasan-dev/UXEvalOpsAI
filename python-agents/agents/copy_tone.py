"""
Copy and Tone Agent
Evaluates microcopy, error messages, button labels, and overall voice/tone
for clarity, consistency, and user-friendliness.
"""
import time
from .base import create_agent_chain

SYSTEM_PROMPT = """You are a UX writer and content strategist.
Evaluate all visible text in the screenshot for:
1. Clarity — is the copy immediately understandable?
2. Tone — is it appropriate for the context (professional, friendly, etc.)?
3. Microcopy — are labels, placeholders, and hints helpful?
4. Error states — are any error messages visible and are they human-friendly?
5. Consistency — are verbs and terminology used consistently?

Return ONLY valid JSON in this exact structure (no markdown):
{
  "score": <integer 0-100>,
  "status": "<good|warning|critical>",
  "findings": [
    {"severity": "<high|medium|low>", "title": "<short title>", "detail": "<specific copy snippet + improvement>"}
  ],
  "recommendation": "<single most impactful copy change>"
}

Rules:
- score 80-100 = good, 60-79 = warning, 0-59 = critical
- Quote actual text from the UI in your findings when possible
- Prefer active voice and plain language recommendations
"""

EVAL_PROMPT = """Evaluate all visible copy and text in this UI screenshot.
Focus on clarity, appropriate tone, and consistency of microcopy across the interface.
Return your analysis as JSON per the schema in your system prompt."""


def evaluate(image_base64: str) -> dict:
    start = time.time()
    chain = create_agent_chain(SYSTEM_PROMPT)
    result = chain.invoke(
        {"image_base64": image_base64, "evaluation_prompt": EVAL_PROMPT}
    )
    result["agent"] = "Copy and Tone"
    result["reflected"] = False
    result["durationMs"] = int((time.time() - start) * 1000)
    return result
