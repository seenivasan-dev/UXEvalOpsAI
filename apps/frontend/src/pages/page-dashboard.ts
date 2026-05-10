import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { api, type EvaluationJob } from '../services/api'

@customElement('page-dashboard')
export class PageDashboard extends LitElement {
  static styles = css`
    :host { display: block; }
    h1 { font-size: 1.6rem; font-weight: 800; color: #1e293b; margin: 0 0 4px; }
    .subtitle { color: #64748b; margin: 0 0 28px; }
    .telemetry-section { margin-bottom: 32px; }
    .section-title {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .recent-list { display: flex; flex-direction: column; gap: 10px; }
    .eval-row {
      display: flex;
      align-items: center;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 18px;
      gap: 16px;
      cursor: pointer;
      transition: box-shadow 0.15s;
    }
    .eval-row:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .file-name { font-weight: 600; color: #1e293b; flex: 1; }
    .grade {
      font-size: 1.2rem; font-weight: 800;
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #f1f5f9; color: #1e3a8a;
    }
    .status-pill {
      font-size: 0.75rem; padding: 3px 10px;
      border-radius: 9999px; font-weight: 600;
    }
    .pending    { background: #fef9c3; color: #92400e; }
    .processing { background: #dbeafe; color: #1d4ed8; }
    .completed  { background: #dcfce7; color: #166534; }
    .failed     { background: #fee2e2; color: #b91c1c; }
    .date { font-size: 0.78rem; color: #94a3b8; }
    .empty { color: #94a3b8; text-align: center; padding: 48px; }
    .cta {
      display: inline-block;
      margin-top: 12px;
      padding: 10px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95rem;
      font-family: inherit;
      font-weight: 600;
    }
    .cta:hover { background: #1d4ed8; }
  `

  @state() private _jobs: EvaluationJob[] = []
  @state() private _loading = true

  connectedCallback() {
    super.connectedCallback()
    this._load()
  }

  private async _load() {
    try {
      this._jobs = await api.listEvaluations()
    } catch {
      /* ignore */
    } finally {
      this._loading = false
    }
  }

  private _goToJob(id: string) {
    location.hash = `history`
    // Store selected ID for history page to pick up
    sessionStorage.setItem('selected-eval-id', id)
    window.dispatchEvent(new CustomEvent('evalops:select', { detail: id }))
  }

  render() {
    return html`
      <h1>Dashboard</h1>
      <p class="subtitle">Overview of your UX evaluation pipeline</p>

      <div class="telemetry-section">
        <div class="section-title">Platform Metrics</div>
        <eval-telemetry-panel></eval-telemetry-panel>
      </div>

      <div class="section-title">Recent Evaluations</div>

      ${this._loading
        ? html`<div class="empty">Loading…</div>`
        : this._jobs.length === 0
        ? html`
          <div class="empty">
            No evaluations yet.<br />
            <button class="cta" @click=${() => { location.hash = 'evaluate' }}>Run Your First Evaluation</button>
          </div>
        `
        : html`
          <div class="recent-list">
            ${this._jobs.slice(0, 10).map(
              (job) => html`
                <div class="eval-row" @click=${() => this._goToJob(job.id)}>
                  <div class="file-name">${job.imageFileName}</div>
                  ${job.grade ? html`<div class="grade">${job.grade}</div>` : ''}
                  <span class="status-pill ${job.status}">${job.status}</span>
                  <span class="date">${new Date(job.createdAt).toLocaleDateString()}</span>
                </div>
              `
            )}
          </div>
        `}
    `
  }
}
