from fastapi import FastAPI
from routers import evaluate, metrics

app = FastAPI(
    title="EvalOps AI — Eval Service",
    description="Scores agent outputs for completeness, schema compliance, and drift.",
    version="1.0.0",
)

app.include_router(evaluate.router, prefix="/evaluate", tags=["evaluate"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "eval-service"}
