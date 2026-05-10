const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface EvaluationJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  imageFileName: string
  overallScore: number | null
  grade: string | null
  summary: string | null
  topIssues: string[]
  durationSeconds: number | null
  createdAt: string
  updatedAt: string
  agentResults?: AgentResult[]
  reviews?: Review[]
  evalScores?: EvalScore[]
}

export interface AgentResult {
  id: string
  agentName: string
  score: number
  status: string
  findings: Finding[]
  recommendation: string
  reflected: boolean
  durationMs: number | null
}

export interface Finding {
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

export interface Review {
  id: string
  agentName: string
  action: 'approved' | 'rejected' | 'escalated'
  comment: string | null
  reviewedAt: string
}

export interface EvalScore {
  completeness: number
  schemaCompliance: number
  driftFlag: boolean
}

export interface TelemetrySummary {
  totalEvaluations: number
  avgScore: number
  avgDuration: number
  successRate: number
  topIssueCategories: string[]
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  uploadImage(file: File): Promise<EvaluationJob> {
    const form = new FormData()
    form.append('image', file)
    return fetch(`${API_BASE}/api/evaluations/upload`, { method: 'POST', body: form })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }))
          throw new Error(err.error ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<EvaluationJob>
      })
  },

  listEvaluations(): Promise<EvaluationJob[]> {
    return request<EvaluationJob[]>('/api/evaluations')
  },

  getEvaluation(id: string): Promise<EvaluationJob> {
    return request<EvaluationJob>(`/api/evaluations/${id}`)
  },

  deleteEvaluation(id: string): Promise<void> {
    return request<void>(`/api/evaluations/${id}`, { method: 'DELETE' })
  },

  getTelemetrySummary(): Promise<TelemetrySummary> {
    return request<TelemetrySummary>('/api/evaluations/telemetry/summary')
  },

  submitReview(
    evaluationId: string,
    agentName: string,
    action: 'approved' | 'rejected' | 'escalated',
    comment?: string
  ): Promise<Review> {
    return request<Review>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ evaluationId, agentName, action, comment }),
    })
  },

  getPendingReviews(): Promise<EvaluationJob[]> {
    return request<EvaluationJob[]>('/api/reviews/pending')
  },

  getReviews(evaluationId: string): Promise<Review[]> {
    return request<Review[]>(`/api/reviews/${evaluationId}`)
  },
}
