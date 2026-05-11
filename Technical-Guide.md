# UXEvalOpsAI — Complete Guide

> Everything you need to know about this project.
> Covers: what it is, why the architecture was chosen, how every component works, and deep dives into the agent pipeline.

---

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [What Problem Does It Solve?](#2-what-problem-does-it-solve)
3. [Why This Architecture?](#3-why-this-architecture)
4. [The Full System Flow (One Example)](#4-the-full-system-flow-one-example)
5. [Frontend — Lit Web Components](#5-frontend--lit-web-components)
6. [Backend — Express API (Node.js)](#6-backend--express-api-nodejs)
7. [Redis — The Job Queue Store](#7-redis--the-job-queue-store)
8. [BullMQ — The Job Queue Library](#8-bullmq--the-job-queue-library)
9. [The Worker — Background Job Processor](#9-the-worker--background-job-processor)
10. [The Agent Pipeline — Deep Dive](#10-the-agent-pipeline--deep-dive)
11. [LangChain Concepts Used](#11-langchain-concepts-used)
12. [The Four AI Agent Patterns](#12-the-four-ai-agent-patterns)
13. [Eval Service — Quality Gate](#13-eval-service--quality-gate)
14. [Database — Prisma + PostgreSQL](#14-database--prisma--postgresql)
15. [Security — OWASP Considerations](#15-security--owasp-considerations)
16. [Agent Latency, Tokens, and Cost](#16-agent-latency-tokens-and-cost)
17. [Infrastructure & Deployment](#17-infrastructure--deployment)
18. [Key Questions & Answers](#18-key-questions--answers)

---

## 1. What Is This Project?

**UXEvalOpsAI** is an AI-powered UX evaluation platform.

You upload a screenshot of any UI (mobile app, web page, dashboard). The system runs it through 4 specialized AI agents that analyze different dimensions of the design. You get back a detailed report with:

- A score (0–100) and letter grade (A–F)
- Per-agent findings with severity levels (high/medium/low)
- Specific WCAG references for accessibility issues
- A 2–3 sentence executive summary for the product team
- A human review queue for approving or rejecting AI findings

**In one sentence:** Upload a UI screenshot → get an AI-graded accessibility and design quality report in ~20 seconds.

---

## 2. What Problem Does It Solve?

### The manual alternative
Normally, evaluating UX quality requires:
- A UX designer (visual hierarchy, consistency)
- An accessibility specialist (WCAG audits — expensive, slow)
- A content strategist (copy and tone)
- Days to weeks of review cycles

### What this platform replaces
UXEvalOpsAI automates the first-pass evaluation using 4 specialized GPT-4o vision agents running in parallel. It gives teams:

1. **Speed** — 20 seconds instead of days
2. **Consistency** — same rubric every time, no reviewer fatigue
3. **Scalability** — evaluate every design iteration automatically (CI/CD integration possible)
4. **Traceability** — all evaluations stored in DB, human reviews logged, scores tracked over time

### What it does NOT replace
Human judgment for final design decisions. The human review queue (`/review`) exists specifically so teams can approve or reject AI findings before acting on them. The AI is the first pass, not the last word.

---

## 3. Why This Architecture?

### The core design tension
AI inference (GPT-4o vision) takes **10–30 seconds**. HTTP connections time out in seconds. You cannot make the user wait synchronously on an API call that takes 20 seconds.

### The solution: async job queue
```
Upload (fast, ~100ms)  →  Queue  →  Process (slow, ~20s)  →  Poll for result
```

This is the **producer-consumer pattern** using Redis as the broker and BullMQ as the library that manages it.

### Why each technology was chosen

| Technology | Why chosen |
|---|---|
| **Lit Web Components** | Framework-agnostic, native browser APIs, no virtual DOM overhead, works with any backend |
| **Express.js** | Minimal, fast, huge ecosystem, pairs naturally with BullMQ and Prisma |
| **BullMQ + Redis** | Industry-standard job queue. Handles retries, backoff, locking, job history on top of Redis |
| **Python for agents** | LangChain ecosystem is Python-first. Azure OpenAI SDK + LangChain chains are mature |
| **FastAPI (Eval Service)** | Python, async, auto-generates OpenAPI docs, lightweight for a scoring microservice |
| **Prisma ORM** | Type-safe DB queries in TypeScript, migrations as code, works perfectly with Neon Postgres |
| **Neon Postgres** | Serverless Postgres, scales to zero, branch-based dev environments, fast cold start |
| **Upstash Redis** | Serverless Redis (REST-compatible), free tier, perfect for job queue on a hobby project |
| **Render** | Simple PaaS, supports Node.js and Python, free tier, `render.yaml` for infra-as-code |
| **Vercel** | Optimized for static/SPA frontends, free tier, global CDN |

### Why separate services?
- **Backend + Worker** in one process: Render free tier only supports `type: web`, not `type: worker`. Co-location is fine at this scale.
- **Eval Service** as separate service: The quality gate must be **independent** of the agents it's evaluating. If both lived in the same process, a bug in one could corrupt the other's results.
- **Python agents** as subprocess (not a service): Each evaluation is stateless. No need for a persistent server — just spawn, run, exit. Simpler and cheaper.

---

## 4. The Full System Flow (One Example)

The user uploads a screenshot of a mobile login screen.

```
1. Browser (Vercel)
   └── drag + drop image → POST /api/evaluations/upload (multipart)

2. Express API (Render)
   ├── multer validates: JPEG/PNG/WebP only, ≤10MB
   ├── converts Buffer → base64 string
   ├── prisma.evaluationJob.create() → Postgres (status="pending")
   ├── telemetryService.trackEvent("evaluation.created")
   ├── evaluationQueue.add("run", { jobId, imageBase64 }) → Redis
   └── returns 201 { id: "clxyz123", status: "pending" } in ~100ms

3. Redis (Upstash)
   └── stores the job: { queue: "evaluations", data: { jobId, imageBase64 }, attempts: 0 }

4. BullMQ Worker (same Node.js process, always listening)
   └── job arrives from Redis → handler fires

5. Worker spawns Python subprocess
   spawn("python3", ["python-agents/main.py"])
   └── writes { "image": "<base64>" } to stdin

6. Python: main.py → coordinator.py
   asyncio.gather runs 4 agents in PARALLEL:
   ├── visual_hierarchy.evaluate(image)   → GPT-4o vision
   ├── accessibility.evaluate(image)      → GPT-4o vision (2 passes — reflection)
   ├── copy_tone.evaluate(image)          → GPT-4o vision
   └── consistency.evaluate(image)        → GPT-4o vision

7. coordinator.py
   ├── calculate_weighted_score.invoke({...}) → weighted score + grade
   ├── synthesize(agent_results, score_data)  → topIssues + summary
   └── prints final JSON to stdout → process exits

8. Worker receives JSON from stdout
   ├── INSERT AgentResult ×4 → Postgres
   ├── UPDATE EvaluationJob (status="completed", overallScore, grade, ...)
   ├── POST /evaluate → Eval Service → INSERT EvalScore → Postgres
   └── INSERT TelemetryEvent ("evaluation.completed")

9. Frontend (Vercel)
   polling GET /api/evaluations/clxyz123 every 2 seconds
   └── receives status="completed" → renders full report card
```

Total time: **~20 seconds** from upload to rendered report.

---

## 5. Frontend — Lit Web Components

### What is Lit?

Lit is a **lightweight library for building Web Components** — browser-native custom HTML elements. Unlike React or Vue which replace the DOM, Lit extends the DOM's own component model.

```typescript
// Defining a custom HTML element
@customElement('eval-upload-dropzone')       // registers <eval-upload-dropzone> tag
export class EvalUploadDropzone extends LitElement {

  @property({ type: Boolean }) loading = false   // attribute-backed property
  @state() private _file: File | null = null     // internal reactive state

  render() {
    return html`<div class="zone">...</div>`     // declarative template
  }
}
```

### How Lit works — 3 key concepts

**1. Shadow DOM**
Each Lit component gets its own isolated DOM tree. CSS inside a component cannot leak out, and external CSS cannot bleed in. This is why `static styles = css\`...\`` is scoped automatically.

```typescript
static styles = css`
  .zone { border: 2px dashed #cbd5e1; }   /* only affects THIS component */
`
```

**2. Reactive properties**
`@property` maps to HTML attributes (parent can pass data in). `@state` is internal state. Any change to either triggers a re-render. Lit batches updates (microtask queue) so multiple changes in one tick = one render.

```typescript
@property({ type: Boolean }) loading = false
// parent can do: <eval-upload-dropzone .loading=${true}></eval-upload-dropzone>

@state() private _file: File | null = null
// changing this triggers re-render, not visible outside the component
```

**3. Declarative templates with `html\`\``**
Tagged template literals — no JSX, no build transform needed. Lit's template engine only re-renders parts that changed (similar to virtual DOM diffing but simpler).

### Routing
Hash-based SPA routing in `app-shell.ts`. No router library needed:

```typescript
connectedCallback() {
  window.addEventListener('hashchange', () => this._onHashChange())
}
private _onHashChange() {
  const hash = location.hash.replace('#', '') as Route
  this.route = (hash as Route) || 'dashboard'
}
```

URL: `https://app.com/#evaluate` → renders `<page-evaluate>`.

### Polling pattern
The frontend polls `GET /api/evaluations/:id` every 2 seconds while an evaluation is in `processing` state:

```typescript
// In page-evaluate.ts
this._pollInterval = setInterval(async () => {
  const job = await api.getEvaluation(this._jobId)
  if (job.status === 'completed' || job.status === 'failed') {
    clearInterval(this._pollInterval)
    this._job = job
  }
}, 2000)
```

Why polling instead of WebSockets? Simpler. Render free tier doesn't support persistent connections well. For this scale, 2-second polling is fine.

---

## 6. Backend — Express API (Node.js)

### What Express does here

Express is the HTTP layer. It receives all requests from the frontend, validates them, delegates to services, and returns responses. It is **not** responsible for running AI agents — that's the worker's job.

### Middleware stack (in order)

```typescript
app.use(helmet())           // Security headers (X-Frame-Options, CSP, etc.)
app.use(cors({...}))        // CORS allowlist: only from FRONTEND_URL
app.use(express.json())     // Parse JSON bodies
app.use(requestLogger)      // Adds correlationId to every request
app.use('/api', rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }))  // 100 req/15min
```

Each middleware is a function: `(req, res, next) => void`. Express calls them in order for every request.

### Key routes

```
POST /api/evaluations/upload  → validates file, creates job, enqueues
GET  /api/evaluations         → list all evaluations (history page)
GET  /api/evaluations/:id     → get one evaluation + all relations (polling endpoint)
DELETE /api/evaluations/:id   → delete job + cascade delete all child records
POST /api/reviews             → human approves/rejects a finding
GET  /health                  → Render health check
```

### Why multer for file upload?

Multer is Express middleware for `multipart/form-data`. It reads the binary file from the HTTP body and puts it in `req.file`. The key config:

```typescript
const upload = multer({
  storage: multer.memoryStorage(),          // Buffer in RAM, not written to disk
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG, PNG and WebP images are allowed'))
  },
})
```

`memoryStorage()` means the file is never written to the filesystem — it's kept as a `Buffer` in memory and immediately converted to base64.

### Correlation IDs

Every request gets a UUID attached to it (`req.correlationId`). This UUID is returned in every error response. Why? So you can search logs for exactly that request: `grep "correlationId: abc-123" logs`.

---

## 7. Redis — The Job Queue Store

### What is Redis?

Redis is an **in-memory key-value store** — think of it as a super-fast shared dictionary that multiple processes can read and write to simultaneously. It is persistent (data survives restarts) and supports complex data types (lists, sorted sets, hashes, streams).

### Why Redis for a job queue?

BullMQ uses Redis **sorted sets** to store jobs by priority/timestamp and **hashes** to store job data and state. When you call `queue.add(...)`, BullMQ writes:

```
ZADD bull:evaluations:wait  <timestamp>  <jobId>     ← sorted set (the queue)
HSET bull:evaluations:<jobId>  data  '{"jobId":...}' ← hash (the job payload)
```

When the Worker picks it up, BullMQ moves the job from `wait` to `active`, then to `completed` or `failed`.

### The IORedis client

```typescript
// apps/backend/src/config/redis.ts
export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,   // REQUIRED by BullMQ
})
```

`maxRetriesPerRequest: null` tells IORedis to retry indefinitely on individual Redis commands, which BullMQ needs because it manages its own retry logic at the job level. Setting this to a finite number would conflict with BullMQ internals.

### Redis is not a database

Redis lives in RAM. On Upstash (serverless Redis), data is persisted to disk, but the primary access model is in-memory. This is why it's used for **transient job data** (image base64 during processing) not for permanent storage. Once a job completes, results go to Postgres, and Redis cleans up old job records.

---

## 8. BullMQ — The Job Queue Library

### What BullMQ is

BullMQ is an npm package that builds a **production-grade job queue system** on top of Redis. It provides:

- **Atomic job state transitions** (a job is either pending, active, completed, or failed — never ambiguous, even with multiple workers)
- **Automatic retries with backoff**
- **Job history and inspection**
- **Concurrency control** (max N jobs running at once)
- **Worker locking** (two workers cannot pick the same job — uses Redis Lua scripts for atomicity)

### The two sides of BullMQ

**Queue** (producer) — used by the Express API:
```typescript
// apps/backend/src/jobs/queue.ts
export const evaluationQueue = new Queue('evaluations', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,                                    // retry up to 3 times
    backoff: { type: 'exponential', delay: 5000 }, // 5s → 25s → 125s
    removeOnComplete: 100,                          // keep last 100 completed jobs in Redis
    removeOnFail: 50,                               // keep last 50 failed jobs
  },
})
```

**Worker** (consumer) — runs in the background:
```typescript
// apps/backend/src/jobs/worker.ts
const worker = new Worker('evaluations', async (job) => {
  // This handler runs for every job
  const { jobId, imageBase64 } = job.data
  // ... do the work
}, { connection: redis })
```

### Retry with exponential backoff — why it matters

If the Python subprocess fails or the eval service is temporarily down:
- Attempt 1 fails → wait 5 seconds → retry
- Attempt 2 fails → wait 25 seconds → retry
- Attempt 3 fails → job is marked `failed` → status updated in Postgres → telemetry event written

Exponential backoff prevents hammering a recovering service. The `delay: 5000` is the base; exponential means `delay * 2^attempt`.

### How BullMQ prevents duplicate processing

BullMQ uses a Redis Lua script to atomically move a job from `wait` to `active` and set a lock. The lock has a TTL. If a worker crashes mid-job, the lock expires and another worker can pick it up. This is called **stalled job detection**.

---

## 9. The Worker — Background Job Processor

### What the worker is

The BullMQ Worker is not a separate process or server. It's a JavaScript class instance that runs a polling loop inside the same Node.js process as Express:

```typescript
// index.ts — ONE node process, TWO responsibilities
import './jobs/worker'   // starts the BullMQ worker listener
app.listen(config.PORT)  // starts the HTTP server
```

### What the worker does, step by step

```typescript
const worker = new Worker('evaluations', async (job) => {
  const { jobId, imageBase64 } = job.data

  // Step 1: spawn Python subprocess (blocks until done, up to 120s)
  const report = await runPythonAgents(imageBase64)

  // Step 2: save 4 AgentResult rows
  for (const agent of report.agents) {
    await prisma.agentResult.create({ data: { evaluationId: jobId, ...agent } })
  }

  // Step 3: update the EvaluationJob row
  await prisma.evaluationJob.update({
    where: { id: jobId },
    data: { status: 'completed', overallScore: report.overallScore, grade: report.grade, ... }
  })

  // Step 4: call Eval Service (fire-and-forget with fallback)
  const evalRes = await fetch(`${EVAL_SERVICE_URL}/evaluate`, { ... })
  await prisma.evalScore.create({ data: { evaluationId: jobId, ...evalData } })

  // Step 5: write telemetry
  await telemetryService.trackEvent(jobId, 'evaluation.completed', { score, grade })
})
```

### The Python subprocess bridge

```typescript
function runPythonAgents(imageBase64: string): Promise<AgentReport> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.PYTHON_PATH, [scriptPath])

    // 120-second timeout safety net
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Python agent timed out after 120 seconds'))
    }, 120_000)

    child.stdin.write(JSON.stringify({ image: imageBase64 }))
    child.stdin.end()  // signals EOF — Python's sys.stdin.read() returns

    child.stdout.on('data', chunk => stdout += chunk.toString())
    child.stderr.on('data', chunk => logger.info({ output: chunk.toString() }))

    child.on('close', code => {
      clearTimeout(timer)
      const parsed = JSON.parse(stdout.trim()) as AgentReport
      resolve(parsed)
    })
  })
}
```

Key design decisions:
- **stdout = result only** — Python agents print ONLY the final JSON to stdout. All debug logs go to stderr. This is critical: any non-JSON text on stdout breaks `JSON.parse()`.
- **stdin signals EOF** — `child.stdin.end()` tells Python that `sys.stdin.read()` is complete.
- **120-second timeout** — GPT-4o calls can hang. SIGTERM kills the process if it takes too long, preventing a hung job from blocking the queue forever.

---

## 10. The Agent Pipeline — Deep Dive

### Architecture overview

```
main.py (entry point)
    │
    ▼
coordinator.py  [Pattern: PARALLELIZATION + ORCHESTRATOR]
    │
    ├── asyncio.gather (all 4 run at the same time)
    │       ├── visual_hierarchy.evaluate()   [Pattern: SIMPLE CHAIN]
    │       ├── accessibility.evaluate()      [Pattern: REFLECTION — 2 passes]
    │       ├── copy_tone.evaluate()          [Pattern: SIMPLE CHAIN]
    │       └── consistency.evaluate()        [Pattern: SIMPLE CHAIN]
    │
    ├── calculate_weighted_score.invoke()     [Pattern: TOOL USE]
    │
    └── synthesize()                          [Pattern: ORCHESTRATOR-SYNTHESIS]
```

### Why 4 separate agents instead of one big prompt?

**One big prompt problem:**
- A single prompt asking GPT-4o to evaluate accessibility + visual hierarchy + copy + consistency produces vague, generalized output
- The model has to context-switch between 4 specializations — it performs worse on each
- One failure or hallucination contaminates the whole response
- You cannot independently retry or replace one dimension

**4 specialist agents:**
- Each agent has a tightly focused system prompt (domain expert persona)
- Each returns a structured JSON schema — easier to validate
- They run in parallel (no sequential penalty)
- One agent failure returns a fallback result; the other 3 still complete
- You can swap, update, or retrain one agent independently

### The `asyncio.gather` parallelization

```python
results = await asyncio.gather(
    asyncio.to_thread(visual_hierarchy.evaluate, image_base64),
    asyncio.to_thread(accessibility.evaluate, image_base64),
    asyncio.to_thread(copy_tone.evaluate, image_base64),
    asyncio.to_thread(consistency.evaluate, image_base64),
    return_exceptions=True,   # critical: one failure doesn't kill the rest
)
```

`asyncio.to_thread()` wraps a synchronous function (the LangChain chain call) to run in a thread pool, making it awaitable. Without this, calling a blocking LangChain chain inside `asyncio.gather` would block the event loop.

`return_exceptions=True` — if one agent raises an exception, it's returned as an `Exception` object in the results list rather than propagating. The coordinator checks for exceptions and replaces them with a fallback result dict. This is **fault tolerance** — the pipeline always returns a complete response.

### The weighted score formula

```
Overall Score = (Accessibility × 0.35)
              + (Consistency × 0.25)
              + (Visual Hierarchy × 0.20)
              + (Copy & Tone × 0.20)
```

Why these weights?
- **Accessibility (35%)** — WCAG compliance can be a **legal requirement** (ADA, EN 301 549). It's the highest weight because failure here is the highest business risk.
- **Consistency (25%)** — Design system coherence directly impacts brand trust and developer handoff.
- **Visual Hierarchy (20%)** — Affects task completion rate but is more subjective.
- **Copy & Tone (20%)** — Important but rarely catastrophic.

---

## 11. LangChain Concepts Used

### 1. `AzureChatOpenAI` / `ChatOpenAI` — the LLM

The LLM wrapper. It handles authentication, HTTP requests to the OpenAI API, token counting, and response parsing. GPT-4o with `max_tokens=1500` is used for vision tasks.

```python
llm = AzureChatOpenAI(
    azure_deployment="gpt-4o",
    azure_endpoint="https://evalaiagent.openai.azure.com/",
    api_key=AZURE_OPENAI_API_KEY,
    api_version="2024-02-01",
    max_tokens=1500,
)
```

### 2. `SystemMessage` / `HumanMessage` — message types

LangChain's message format for chat models:
- `SystemMessage` — the "persona" instruction. Sets the agent's role and output format.
- `HumanMessage` — the user turn. For vision models, this can contain both text and images.

```python
messages = [
    SystemMessage(content="You are a WCAG expert..."),
    HumanMessage(content=[
        { "type": "image_url", "image_url": { "url": f"data:image/jpeg;base64,{b64}" } },
        { "type": "text", "text": "Audit this screenshot..." }
    ])
]
```

The image is passed as a **data URI** (`data:image/jpeg;base64,...`). GPT-4o vision accepts base64 images directly — no file upload needed.

### 3. `JsonOutputParser` — structured output

Parses the LLM's text response (which is a JSON string) into a Python dict. If the LLM returns malformed JSON, this raises an exception, which BullMQ will retry.

```python
parser = JsonOutputParser()
chain = build_messages | llm | parser
result = chain.invoke(inputs)  # result is a dict, not a string
```

### 4. `RunnableLambda` — custom chain step

LangChain's LCEL (LangChain Expression Language) uses the `|` pipe operator to chain components. A `RunnableLambda` wraps any Python function into a chainable component:

```python
def build_messages(inputs: dict) -> list:
    return [SystemMessage(...), HumanMessage(...)]

chain = RunnableLambda(build_messages) | llm | parser
```

This is cleaner than `ChatPromptTemplate` for vision inputs because base64 strings contain `{` and `}` characters which confuse template variable substitution.

### 5. `@tool` decorator — Tool Use pattern

The `@tool` decorator turns a regular Python function into a LangChain Tool — a callable that the LLM could invoke (in an agentic loop). Here, `calculate_weighted_score` is called **directly** (not by the LLM) — it's a deterministic function, not an LLM call. The `@tool` decorator gives it a schema (name, description, input types) for documentation and potential future automation.

```python
@tool
def calculate_weighted_score(
    visual_score: int,
    accessibility_score: int,
    copy_score: int,
    consistency_score: int,
) -> dict:
    """Calculate weighted UX score with domain-specific weights."""
    weighted = accessibility_score * 0.35 + ...
    return { "overallScore": round(weighted), "grade": grade }

# Called deterministically — not via LLM function calling
score_data = calculate_weighted_score.invoke({ "visual_score": 74, ... })
```

### 6. LCEL — LangChain Expression Language

The `|` pipe operator chains runnables: the output of one becomes the input of the next.

```python
chain = RunnableLambda(build_messages) | llm | JsonOutputParser()
#       (dict → list[Message])            (list → AIMessage)   (AIMessage → dict)
```

LCEL automatically handles:
- Streaming (`.stream()`)
- Async (`.ainvoke()`)
- Batch processing (`.batch()`)
- Retry logic

---

## 12. The Four AI Agent Patterns

### Pattern 1: Simple Chain (Visual Hierarchy, Copy & Tone, Consistency)

The baseline pattern. One prompt → one LLM call → structured output.

```python
def evaluate(image_base64: str) -> dict:
    chain = create_agent_chain(SYSTEM_PROMPT)   # RunnableLambda | llm | parser
    result = chain.invoke({
        "image_base64": image_base64,
        "evaluation_prompt": EVAL_PROMPT
    })
    result["agent"] = "Visual Hierarchy"
    return result
```

**When to use:** Domain is well-defined, output format is clear, single pass is sufficient.

---

### Pattern 2: Reflection (Accessibility Agent — 2 passes)

The Reflection pattern runs the task twice. Pass 1 produces an initial answer. Pass 2 critiques Pass 1 and produces an improved answer. This mimics a junior analyst + senior reviewer workflow.

```python
def evaluate(image_base64: str) -> dict:
    # Pass 1: initial WCAG audit
    initial_chain = create_agent_chain(INITIAL_SYSTEM_PROMPT)
    initial_result = initial_chain.invoke({...})

    # Pass 2: reflection — senior reviewer critiques and improves Pass 1
    reflection_chain = RunnableLambda(build_reflection_messages) | llm | parser
    final_result = reflection_chain.invoke({
        "image_base64": image_base64,
        "initial_result": json.dumps(initial_result, indent=2)
    })
    final_result["reflected"] = True   # flag for the frontend to show
    return final_result
```

**Why accessibility uses reflection:**
- Accessibility is the highest-weighted dimension (35%)
- WCAG criteria are specific and technical — easy to miss on first pass
- Missing an accessibility issue has legal/compliance risk
- The cost of 2 LLM calls is worth the quality improvement

**Trade-off:** 2× the API calls = 2× the latency and cost for this agent. Worth it because of the weight.

---

### Pattern 3: Parallelization (Coordinator)

Run multiple agents concurrently instead of sequentially. This is the most important performance optimization in the pipeline.

```python
results = await asyncio.gather(
    asyncio.to_thread(visual_hierarchy.evaluate, image_base64),
    asyncio.to_thread(accessibility.evaluate, image_base64),  # this one is 2× calls
    asyncio.to_thread(copy_tone.evaluate, image_base64),
    asyncio.to_thread(consistency.evaluate, image_base64),
    return_exceptions=True,
)
```

**Without parallelization (sequential):**
- Visual: 8s + Accessibility: 16s + Copy: 8s + Consistency: 8s = **40 seconds**

**With parallelization (concurrent):**
- All run at the same time → bottleneck = slowest agent = **~16 seconds** (accessibility, 2 passes)

This is a **50–60% latency reduction** at no extra cost.

---

### Pattern 4: Tool Use + Orchestrator-Synthesis (Synthesis Agent)

The final agent receives all 4 agent outputs and must:
1. Calculate the weighted score (deterministic math — should NOT be done by an LLM)
2. Identify the top 3 cross-cutting issues
3. Write an executive summary

The `@tool` function `calculate_weighted_score` handles the math deterministically. The LLM only does what LLMs are good at: reading complex, unstructured findings and synthesizing them into human language.

```python
# Deterministic tool call (not an LLM)
score_data = calculate_weighted_score.invoke({
    "visual_score": 74,
    "accessibility_score": 55,
    "copy_score": 80,
    "consistency_score": 69,
})
# Returns: { "overallScore": 66, "grade": "D", "weights": {...} }

# LLM synthesis (only for the language parts)
synthesis = synthesize(agent_results, score_data)
# Returns: { "topIssues": [...], "summary": "..." }
```

**Why not let the LLM calculate the score?**
LLMs are probabilistic. `(55 * 0.35) + (69 * 0.25) + (74 * 0.20) + (80 * 0.20)` should always equal 66. An LLM might get 65 or 67. Deterministic operations belong in code, not prompts.

---

## 13. Eval Service — Quality Gate

### What it is

A separate FastAPI microservice that scores the quality of the AI agents' outputs — not the quality of the UI being evaluated, but the quality of the agents' *responses*.

### Why it's separate

The Eval Service evaluates the evaluators. If it lived in the same codebase or process as the agents, it would be difficult to update the scoring criteria without risking changes to the agent behavior. Separate service = independent lifecycle.

### What it measures

**1. Completeness** — did the agent return all required fields?
```python
REQUIRED_AGENT_FIELDS = {"agent", "score", "status", "findings", "recommendation"}
completeness = present_fields / 5   # 0.0 to 1.0
```

**2. Schema Compliance** — are the values the correct types and ranges?
```python
# Score must be integer 0-100
# Status must be "good" | "warning" | "critical"
# Findings must be a list
# Each finding's severity must be "high" | "medium" | "low"
# Recommendation must be a non-empty string
schema_compliance = compliance_checks / 4
```

**3. Drift Detection** — is this evaluation's score dramatically different from recent history?
```python
recent_scores: list[int] = []   # in-memory rolling window

historical_avg = statistics.mean(recent_scores[-10:])
current_avg = statistics.mean([a.score for a in request.agents])

drift_flag = abs(current_avg - historical_avg) > 20
```

Drift flag = `True` means the agents' scores have shifted more than 20 points from the recent average. This could indicate:
- The model was updated and its calibration changed
- The image type is very different from recent uploads (edge case)
- A bug was introduced that inflates/deflates scores

### Data flow

```
Worker (after agents complete)
    → POST /evaluate { evaluationId, agents: [...] }
    → Eval Service scores each agent's output
    → returns { completeness: 0.96, schemaCompliance: 1.0, driftFlag: false }
    → Worker saves this as EvalScore in Postgres
    → Frontend shows it in the Telemetry Panel
```

---

## 14. Database — Prisma + PostgreSQL

### Schema design

```
EvaluationJob (1)
    ├── AgentResult (many) — one per agent, per evaluation
    ├── Review (many) — human review actions (approve/reject)
    ├── TelemetryEvent (many) — events: created, completed, failed
    └── EvalScore (many) — from the Eval Service (one per evaluation)
```

All child tables have `onDelete: Cascade` — deleting an `EvaluationJob` automatically deletes all related rows.

### Why Prisma?

Prisma generates TypeScript types from the schema. `prisma.evaluationJob.create()` is fully type-safe — the TypeScript compiler catches if you try to set a field that doesn't exist or pass the wrong type.

### The `directUrl` fix for Neon

Neon uses PgBouncer (a connection pooler) in front of Postgres. PgBouncer doesn't support **advisory locks** — and Prisma uses advisory locks during migrations to prevent concurrent migration runs.

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // pooler URL — used at runtime (faster)
  directUrl = env("DIRECT_DATABASE_URL") // direct URL — used only for migrations
}
```

`DATABASE_URL` = `postgresql://user:pass@ep-xxx-pooler.neon.tech/db` (goes through PgBouncer)
`DIRECT_DATABASE_URL` = `postgresql://user:pass@ep-xxx.neon.tech/db` (bypasses PgBouncer)

Migrations use `directUrl`, normal queries use `url`. Best of both worlds.

---

## 15. Security — OWASP Considerations

### OWASP A01: Broken Access Control
- CORS allowlist: only `FRONTEND_URL` and localhost are allowed origins. Unknown origins are rejected.
- No auth on this version — but the architecture is ready for it (JWT middleware would go between `requestLogger` and routes).

### OWASP A03: Injection
- Prisma parameterizes all queries — no raw SQL, no SQL injection possible.
- File type validation: only JPEG/PNG/WebP are accepted (MIME type check). No code execution from uploads.

### OWASP A04: Insecure Design
- Rate limiting: 100 requests per 15 minutes per IP on all `/api/*` routes.
- File size limit: 10MB cap. Prevents memory exhaustion from large uploads.
- Python subprocess: receives only base64 image data via stdin. No user-controlled shell arguments. No shell injection possible.

### OWASP A05: Security Misconfiguration
- `helmet()` sets 15+ security headers automatically (CSP, HSTS, X-Frame-Options, etc.).
- Error responses in production return `"Internal server error"` — stack traces are hidden.
- Stack traces only appear in `development` mode.

### OWASP A09: Security Logging and Monitoring
- Structured JSON logs via Pino on every request (`correlationId`, method, URL, status, duration).
- Telemetry events written to DB for every evaluation lifecycle event.
- Correlation ID on every error response — connects user-facing errors to server logs.

---

## 16. Agent Latency, Tokens, and Cost

### Latency breakdown (estimated)

| Step | Time |
|---|---|
| Express API receives upload | ~50ms |
| Enqueue to Redis | ~20ms |
| Worker picks up job | ~50ms |
| Python subprocess spawn | ~500ms |
| All 4 agents (parallel) | ~12–18s |
| • Visual, Copy, Consistency (1 call each) | ~8s each |
| • Accessibility (2 calls — reflection) | ~16s |
| Synthesis LLM call | ~3s |
| DB writes (5 operations) | ~200ms |
| Eval Service HTTP call | ~100ms |
| **Total** | **~18–22 seconds** |

### Token usage per evaluation

Each agent gets one image (vision input) + system prompt + evaluation prompt.

| Agent | LLM Calls | Approx. Tokens (in + out) |
|---|---|---|
| Visual Hierarchy | 1 | ~1,000 in + 300 out |
| Accessibility | 2 (reflection) | ~2,000 in + 600 out |
| Copy & Tone | 1 | ~1,000 in + 300 out |
| Design Consistency | 1 | ~1,000 in + 300 out |
| Synthesis | 1 | ~1,500 in + 400 out |
| **Total** | **6** | **~6,500 in + 1,900 out** |

Vision tokens for the image depend on image size. GPT-4o charges per image tile (512×512px tiles). A 1920×1080 screenshot ≈ 6–8 tiles.

### Cost reduction strategies used

1. **`max_tokens=1500`** — caps output length per call. Prevents runaway responses.
2. **Structured JSON output** — agents return compact JSON, not paragraphs. Less output = fewer tokens.
3. **Parallelization** — doesn't reduce tokens but reduces wall-clock time by 50%+.
4. **Reflection only where needed** — only the accessibility agent (highest weight) uses 2 passes. Others use 1.

### Why `max_tokens=1500`?

The output schema for each agent is:
```json
{ "score": 74, "status": "warning", "findings": [...], "recommendation": "..." }
```

This schema never needs more than 400–600 tokens. Setting `max_tokens=1500` gives 2–3× headroom while preventing the model from generating multi-page essays. A forgotten closing `}` or runaway text breaks `JSON.parse()` — so keeping output compact reduces parse errors.

---

## 17. Infrastructure & Deployment

### Services

| Service | Platform | Language | Purpose |
|---|---|---|---|
| Frontend | Vercel | TypeScript / Lit | SPA, CDN-served |
| Backend + Worker | Render (web) | Node.js 20 | Express API + BullMQ worker |
| Eval Service | Render (web) | Python 3.11 | FastAPI scoring microservice |
| Redis | Upstash | — | Serverless Redis for BullMQ |
| PostgreSQL | Neon | — | Serverless Postgres |
| LLM | Azure OpenAI | — | GPT-4o vision |

### Why everything is co-located on Render

Render free tier only supports `type: web` services (HTTP servers). It does not support persistent background workers as a separate service type. The solution: the BullMQ Worker runs **inside** the Express web service process. `import './jobs/worker'` in `index.ts` starts the worker when the HTTP server starts.

### render.yaml — Infrastructure as Code

```yaml
services:
  - type: web
    name: evalops-backend
    runtime: node
    buildCommand: npm install --include=dev && npx prisma generate && tsc
    startCommand: node apps/backend/dist/index.js
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false

  - type: web
    name: evalops-eval-service
    runtime: python
    buildCommand: cd eval-service && pip install -r requirements.txt
    startCommand: cd eval-service && uvicorn main:app --host 0.0.0.0 --port $PORT
```

`npm install --include=dev` — devDependencies (TypeScript, `@types/*`) are needed at build time even though they're not needed at runtime.

`npx prisma generate` — must run before `tsc` because the TypeScript compiler imports `@prisma/client` types.

---

## 18. Key Questions & Answers

### Q: Why use a job queue instead of just calling Python directly from the API?

**A:** Three reasons. First, GPT-4o inference takes 15–20 seconds. HTTP connections time out and users shouldn't wait. By returning immediately with a job ID and having the frontend poll, the user experience is non-blocking. Second, if the Python process crashes, BullMQ automatically retries the job up to 3 times with exponential backoff. Without a queue, a crash = silent failure. Third, the queue acts as a buffer — if 10 users upload simultaneously, jobs queue up and process one at a time rather than spawning 10 simultaneous Python processes that could exhaust memory or API rate limits.

---

### Q: Why spawn a Python subprocess instead of writing the agents in Node.js?

**A:** LangChain's Python SDK is the primary, most mature implementation. The vision capabilities, the `@tool` decorator, LCEL pipe syntax, and the `AzureChatOpenAI` integration all work most reliably in Python. Rewriting the same in TypeScript/LangChain.js would require porting code that's less tested and documented. The subprocess bridge (stdin/stdout JSON protocol) is a clean interface — Node.js doesn't need to know anything about LangChain internals.

---

### Q: Why does the Accessibility agent use 2 LLM passes (Reflection)?

**A:** Accessibility failures have the highest business risk — they can be legal violations (ADA compliance). The reflection pattern mimics a junior analyst + senior reviewer workflow: Pass 1 produces an initial audit, Pass 2 critiques it and improves it. This catches missed issues and false positives. We accept the 2× latency and cost specifically for this agent because it carries 35% of the total weight. The other 3 agents use a single pass because the cost/quality trade-off doesn't justify reflection for them.

---

### Q: What happens if one AI agent crashes?

**A:** The coordinator uses `asyncio.gather(return_exceptions=True)`. If one agent raises an exception, it's returned as an `Exception` object in the results list instead of propagating. The coordinator detects this, logs it, and substitutes a fallback result dict with `score: 0`, `status: "critical"`, and an error message. The other 3 agents complete normally and the pipeline returns a full response. The user sees that one agent failed but still gets results from the others.

---

### Q: What is LCEL and why use it instead of writing plain Python?

**A:** LCEL (LangChain Expression Language) is a declarative composition system using the `|` pipe operator. `chain = step1 | step2 | step3` means the output of `step1` becomes the input of `step2`, and so on. The advantage is that LCEL automatically adds streaming, async, batch, retry, and observability to any chain without extra code. If you write the same thing in plain Python, you lose all of those for free. Here, it's used in the simpler form: `RunnableLambda(build_messages) | llm | JsonOutputParser()`.

---

### Q: How does the Eval Service detect drift?

**A:** The Eval Service maintains an in-memory list `recent_scores` of the last 10 evaluation scores. When a new evaluation comes in, it calculates the average of the incoming agent scores and compares it to the historical average. If the difference is greater than 20 points, it sets `driftFlag: True`. This signals that the LLM's scoring behavior may have shifted — e.g., the model was updated, or the input distribution changed. The flag appears in the Telemetry Panel as a warning. The limitation is that `recent_scores` resets on service restart, which is acceptable for a demo but would need persistent storage in production.

---

### Q: How does Lit differ from React?

**A:** React runs in JavaScript and manages a virtual DOM — a JS representation of the UI that it diffs against the real DOM. Lit uses **native browser Web Components** — `customElements.define()` is a browser API, not a framework. Lit components are real HTML elements. They work in any framework or no framework. React components only work inside React. Lit's `@state` and `@property` are analogous to React's `useState` and `props`, but they're compiled to standard property getters/setters. Shadow DOM provides CSS scoping without CSS Modules or styled-components. Lit has no virtual DOM — it uses tagged template literals and efficient DOM patching (similar to Svelte's approach).

---

### Q: How would you scale this system?

**A:**
1. **Multiple workers**: BullMQ supports running multiple Worker instances (or multiple Node.js processes). Each worker picks up jobs independently — BullMQ's locking prevents duplicate processing.
2. **Separate worker process**: In production on a paid Render plan, split Express and the Worker into separate services. Worker can scale independently.
3. **Agent-level parallelism**: The Python subprocess currently runs in one process. You could replace the subprocess with a persistent FastAPI service and call individual agent endpoints concurrently over HTTP — enabling independent scaling of each agent.
4. **Redis persistence**: Upstash persists to disk. For higher throughput, upgrade to a dedicated Redis cluster.
5. **CDN for images**: Instead of storing base64 in Postgres, upload to S3/Cloudflare R2 and store only the URL. This reduces DB row size significantly.
6. **Rate limit by user**: Current rate limit is per IP. Add authentication and rate limit per user/API key for fairer multi-tenant access.

---

*This document covers the complete technical depth of UXEvalOpsAI.*
