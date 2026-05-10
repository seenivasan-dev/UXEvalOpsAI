import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { AgentResult } from '../services/api'

@customElement('eval-score-card')
export class EvalScoreCard extends LitElement {
  static styles = css`
    :host { display: block; }
    .card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      transition: box-shadow 0.15s;
    }
    .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      gap: 8px;
    }
    .agent-name { font-weight: 700; font-size: 0.95rem; color: #1e293b; }
    .badges { display: flex; align-items: center; gap: 6px; }
    .reflected-badge {
      background: #dbeafe;
      color: #1d4ed8;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .findings { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .finding {
      background: #f8fafc;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .finding-text h4 { margin: 0 0 2px; font-size: 0.85rem; font-weight: 600; color: #1e293b; }
    .finding-text p  { margin: 0; font-size: 0.8rem; color: #64748b; }
    .recommendation {
      margin-top: 12px;
      background: #f0fdf4;
      border-left: 3px solid #22c55e;
      padding: 8px 12px;
      border-radius: 0 6px 6px 0;
      font-size: 0.82rem;
      color: #166534;
    }
    .duration { font-size: 0.75rem; color: #94a3b8; margin-top: 8px; text-align: right; }
  `

  @property({ type: Object }) result!: AgentResult

  render() {
    const { agentName, score, findings, recommendation, reflected, durationMs } = this.result
    return html`
      <div class="card">
        <div class="header">
          <span class="agent-name">${agentName}</span>
          <div class="badges">
            ${reflected ? html`<span class="reflected-badge">✦ Reflected</span>` : ''}
            <eval-confidence-indicator score=${score}></eval-confidence-indicator>
          </div>
        </div>

        <div class="findings">
          ${(findings as Array<{ severity: string; title: string; detail: string }>).map(
            (f) => html`
              <div class="finding">
                <eval-severity-badge severity=${f.severity}></eval-severity-badge>
                <div class="finding-text">
                  <h4>${f.title}</h4>
                  <p>${f.detail}</p>
                </div>
              </div>
            `
          )}
        </div>

        <div class="recommendation">💡 ${recommendation}</div>
        ${durationMs ? html`<div class="duration">${(durationMs / 1000).toFixed(1)}s</div>` : ''}
      </div>
    `
  }
}
