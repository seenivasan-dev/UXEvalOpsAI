"""
Accessibility Agent — AI Pattern: REFLECTION (2-pass self-critique)

Pass 1: Initial accessibility audit
Pass 2: Reflection chain critiques Pass 1 and produces improved output

This implements the Reflection agent pattern for interview demonstration.
"""
import time
import json
from .base import create_agent_chain, create_llm
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import RunnableLambda

INITIAL_SYSTEM_PROMPT = """You are a WCAG 2.1 AA accessibility expert.
Evaluate the screenshot for:
1. Color contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text)
2. Touch target sizes (minimum 44x44px)
3. Visual indicators beyond color alone
4. Form label associations
5. Focus indicator visibility

Return ONLY valid JSON in this exact structure (no markdown):
{
  "score": <integer 0-100>,
  "status": "<good|warning|critical>",
  "findings": [
    {"severity": "<high|medium|low>", "title": "<short title>", "detail": "<specific WCAG criterion reference>"}
  ],
  "recommendation": "<single most impactful improvement>"
}

Rules:
- score 80-100 = good, 60-79 = warning, 0-59 = critical
- Reference WCAG success criteria where applicable (e.g. 1.4.3, 2.4.7)
"""

REFLECTION_SYSTEM_PROMPT = """You are a senior accessibility reviewer performing a quality check.
You will receive a junior analyst's initial accessibility evaluation and the original screenshot.
Your job:
1. Identify any missed issues or false positives in the initial evaluation
2. Verify the score is calibrated correctly
3. Improve the findings list — add missed issues, remove incorrect ones
4. Sharpen the recommendation to be more actionable

Return ONLY valid JSON — the final improved evaluation:
{
  "score": <integer 0-100>,
  "status": "<good|warning|critical>",
  "findings": [
    {"severity": "<high|medium|low>", "title": "<short title>", "detail": "<specific detail>"}
  ],
  "recommendation": "<improved single most impactful improvement>"
}
"""


def evaluate(image_base64: str) -> dict:
    start = time.time()

    # Pass 1: Initial evaluation
    initial_chain = create_agent_chain(INITIAL_SYSTEM_PROMPT)
    initial_result = initial_chain.invoke(
        {
            "image_base64": image_base64,
            "evaluation_prompt": (
                "Perform a thorough WCAG 2.1 AA accessibility audit of this screenshot. "
                "Be conservative — flag anything that might fail accessibility standards."
            ),
        }
    )

    # Pass 2: Reflection — critique and improve Pass 1 output
    llm = create_llm()
    parser = JsonOutputParser()

    def build_reflection_messages(inputs: dict) -> list:
        return [
            SystemMessage(content=REFLECTION_SYSTEM_PROMPT),
            HumanMessage(content=[
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{inputs['image_base64']}"},
                },
                {
                    "type": "text",
                    "text": (
                        f"Initial evaluation from junior analyst:\n"
                        f"{inputs['initial_result']}\n\n"
                        "Please review and improve this evaluation."
                    ),
                },
            ]),
        ]

    reflection_chain = RunnableLambda(build_reflection_messages) | llm | parser

    final_result = reflection_chain.invoke(
        {
            "image_base64": image_base64,
            "initial_result": json.dumps(initial_result, indent=2),
        }
    )

    final_result["agent"] = "Accessibility"
    final_result["reflected"] = True  # Flag: this agent used the Reflection pattern
    final_result["durationMs"] = int((time.time() - start) * 1000)
    return final_result
