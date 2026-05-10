import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { api, type TelemetrySummary } from '../services/api'

@customElement('eval-telemetry-panel')
export class EvalTelemetryPanel extends LitElement {
  static styles = css`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .stat {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .stat-value { font-size: 2rem; font-weight: 800; color: #1e3a8a; }
    .stat-label { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    .loading { color: #94a3b8; font-size: 0.9rem; padding: 24px; text-align: center; }
  `

  @state() private _data: TelemetrySummary | null = null
  @state() private _loading = true

  connectedCallback() {
    super.connectedCallback()
    this._load()
  }

  private async _load() {
    try {
      this._data = await api.getTelemetrySummary()
    } catch {
      // silently fail — telemetry is not mission-critical
    } finally {
      this._loading = false
    }
  }

  render() {
    if (this._loading) return html`<div class="loading">Loading telemetry…</div>`
    if (!this._data) return html`<div class="loading">No telemetry data yet.</div>`

    const { totalEvaluations, avgScore, avgDuration, successRate } = this._data
    const stats = [
      { value: String(totalEvaluations), label: 'Total Evaluations' },
      { value: String(avgScore), label: 'Avg UX Score' },
      { value: `${avgDuration}s`, label: 'Avg Duration' },
      { value: `${successRate}%`, label: 'Success Rate' },
    ]

    return html`
      <div class="grid">
        ${stats.map(
          (s) => html`
            <div class="stat">
              <div class="stat-value">${s.value}</div>
              <div class="stat-label">${s.label}</div>
            </div>
          `
        )}
      </div>
    `
  }
}
