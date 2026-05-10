"""
main.py — Entry point for the Python agent pipeline.

Protocol:
- Reads JSON from stdin: {"image": "<base64 string>"}
- Writes ONE valid JSON object to stdout (the evaluation result)
- ALL logging/debugging goes to stderr ONLY
- stdout must contain ONLY the final JSON — the Node.js spawn bridge parses it

Usage:
  echo '{"image": "..."}' | python main.py
"""
import sys
import json
import asyncio


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
        image_base64 = data.get("image", "")

        if not image_base64:
            raise ValueError("No 'image' field in input JSON")

        print("[main] input received, starting coordinator", file=sys.stderr)

        from coordinator import run_evaluation
        result = asyncio.run(run_evaluation(image_base64))

        # stdout: ONLY the final JSON
        print(json.dumps(result))

    except Exception as e:
        print(f"[main] fatal error: {e}", file=sys.stderr)
        # Output a valid error JSON to stdout so the Node worker can surface it
        error_payload = {
            "error": str(e),
            "runId": None,
            "timestamp": None,
            "durationSeconds": 0,
            "overallScore": 0,
            "grade": "F",
            "topIssues": ["Pipeline failed — see logs"],
            "summary": f"Evaluation pipeline failed: {e}",
            "agents": [],
        }
        print(json.dumps(error_payload))
        sys.exit(1)


if __name__ == "__main__":
    main()
