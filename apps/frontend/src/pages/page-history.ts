import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { api, type EvaluationJob } from '../services/api'

@customElement('page-history')
export class PageHistory extends LitElement {
  static styles = css`
    :host { display: block; }
    h1 { font-size: 1.6rem; font-weight: 800; color: #1e293b; margin: 0 0 4px; }
    .subtitle { color: #64748b; margin: 0 0 28px; }
    .layout { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start; }
    .sidebar {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .sidebar-header { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-weight: 700; font-size: 0.85rem; color: #64748b; }
    .job-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: background 0.1s;
    }
    .job-item:hover { background: #f8fafc; }
    .job-item.active { background: #eff6ff; border-left: 3px solid #2563eb; }
    .job-name { font-weight: 600; font-size: 0.87rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .job-meta { display: flex; gap: 8px; align-items: center; }
    .grade { font-weight: 800; font-size: 0.8rem; color: #2563eb; }
    .status-pill {
      font-size: 0.7rem; padding: 2px 8px;
      border-radius: 9999px; font-weight: 600;
    }
    .pending    { background: #fef9c3; color: #92400e; }
    .processing { background: #dbeafe; color: #1d4ed8; }
    .completed  { background: #dcfce7; color: #166534; }
    .failed     { background: #fee2e2; color: #b91c1c; }
    .date { font-size: 0.72rem; color: #94a3b8; }
    .empty-state { color: #94a3b8; text-align: center; padding: 48px; }
    .placeholder {
      text-align: center;
      padding: 60px;
      color: #94a3b8;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
  `

  @state() private _jobs: EvaluationJob[] = []
  @state() private _selected: EvaluationJob | null = null
  @state() private _loading = true

  connectedCallback() {
    super.connectedCallback()
    this._load()
    // Check if dashboard navigated to a specific job
    window.addEventListener('evalops:select', (e) => {
      const id = (e as CustomEvent).detail
      const job = this._jobs.find((j) => j.id === id)
      if (job) this._selectJob(job)
    })
  }

  private async _load() {
    try {
      this._jobs = await api.listEvaluations()
      const preselected = sessionStorage.getItem('selected-eval-id')
      if (preselected) {
        sessionStorage.removeItem('selected-eval-id')
        const job = this._jobs.find((j) => j.id === preselected)
        if (job) this._selectJob(job)
      }
    } finally {
      this._loading = false
    }
  }

  private async _selectJob(job: EvaluationJob) {
    const full = await api.getEvaluation(job.id)
    this._selected = full
  }

  render() {
    return html`
      <h1>Evaluation History</h1>
      <p class="subtitle">Browse past evaluations and export reports</p>

      ${this._loading
        ? html`<div class="empty-state">Loading…</div>`
        : html`
          <div class="layout">
            <div class="sidebar">
              <div class="sidebar-header">All Evaluations (${this._jobs.length})</div>
              ${this._jobs.length === 0
                ? html`<div class="empty-state">No evaluations yet.</div>`
                : this._jobs.map(
                    (job) => html`
                      <div
                        class="job-item ${this._selected?.id === job.id ? 'active' : ''}"
                        @click=${() => this._selectJob(job)}
                      >
                        <div class="job-name">${job.imageFileName}</div>
                        <div class="job-meta">
                          ${job.grade ? html`<span class="grade">${job.grade}</span>` : ''}
                          <span class="status-pill ${job.status}">${job.status}</span>
                          <span class="date">${new Date(job.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    `
                  )}
            </div>

            <div>
              ${this._selected
                ? html`<eval-report-card .evaluation=${this._selected}></eval-report-card>`
                : html`<div class="placeholder">← Select an evaluation to view the report</div>`}
            </div>
          </div>
        `}
    `
  }
}
