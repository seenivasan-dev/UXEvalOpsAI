import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { EvaluationJob } from '../services/api'

@customElement('eval-report-card')
export class EvalReportCard extends LitElement {
  static styles = css`
    :host { display: block; }
    .report {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
    }
    .report-header {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: white;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .score-circle {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      border: 3px solid rgba(255,255,255,0.4);
    }
    .score-num { font-size: 1.6rem; font-weight: 800; line-height: 1; }
    .score-grade { font-size: 0.75rem; opacity: 0.85; }
    .header-meta h2 { margin: 0 0 4px; font-size: 1.1rem; }
    .header-meta p { margin: 0; opacity: 0.8; font-size: 0.85rem; }
    .summary { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 0.9rem; line-height: 1.6; }
    .top-issues { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; }
    .top-issues h3 { margin: 0 0 10px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; }
    .issue { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; font-size: 0.87rem; color: #334155; }
    .agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 24px; }
    .export-btn {
      margin: 0 24px 24px;
      padding: 8px 16px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-family: inherit;
      color: #475569;
    }
    .export-btn:hover { background: #e2e8f0; }
  `

  @property({ type: Object }) evaluation!: EvaluationJob

  private _export() {
    const blob = new Blob([JSON.stringify(this.evaluation, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evalops-${this.evaluation.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  render() {
    const { imageFileName, overallScore, grade, summary, topIssues, agentResults, createdAt } = this.evaluation
    return html`
      <div class="report">
        <div class="report-header">
          <div class="header-meta">
            <h2>${imageFileName}</h2>
            <p>${new Date(createdAt).toLocaleString()}</p>
          </div>
          <div class="score-circle">
            <span class="score-num">${overallScore ?? '--'}</span>
            <span class="score-grade">Grade ${grade ?? '?'}</span>
          </div>
        </div>

        ${summary ? html`<div class="summary">${summary}</div>` : ''}

        ${topIssues?.length ? html`
          <div class="top-issues">
            <h3>Top Issues</h3>
            ${topIssues.map((issue) => html`
              <div class="issue"><span>⚠</span> ${issue}</div>
            `)}
          </div>
        ` : ''}

        <div class="agents-grid">
          ${(agentResults ?? []).map(
            (r) => html`<eval-score-card .result=${r}></eval-score-card>`
          )}
        </div>

        <button class="export-btn" @click=${this._export}>⬇ Export JSON</button>
      </div>
    `
  }
}
