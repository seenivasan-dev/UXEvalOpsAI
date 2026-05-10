import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { EvaluationJob, AgentResult } from '../services/api'
import { api } from '../services/api'

@customElement('eval-review-panel')
export class EvalReviewPanel extends LitElement {
  static styles = css`
    :host { display: block; }
    .panel { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h3 { margin: 0; font-size: 0.95rem; }
    .agent-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid #f8fafc;
      gap: 12px;
      flex-wrap: wrap;
    }
    .agent-name { font-weight: 600; font-size: 0.9rem; color: #1e293b; }
    .actions { display: flex; gap: 8px; }
    button {
      padding: 6px 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 0.82rem;
      font-family: inherit;
      font-weight: 600;
      transition: opacity 0.15s;
    }
    button:hover { opacity: 0.85; }
    .approve  { background: #dcfce7; color: #166534; }
    .reject   { background: #fee2e2; color: #b91c1c; }
    .escalate { background: #fef9c3; color: #92400e; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .done-badge {
      font-size: 0.78rem;
      background: #dcfce7;
      color: #166534;
      padding: 3px 10px;
      border-radius: 9999px;
    }
    .comment-input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.82rem;
    }
  `

  @property({ type: Object }) evaluation!: EvaluationJob
  @state() private _reviewed: Set<string> = new Set()
  @state() private _comments: Record<string, string> = {}

  private async _review(agentName: string, action: 'approved' | 'rejected' | 'escalated') {
    await api.submitReview(this.evaluation.id, agentName, action, this._comments[agentName])
    this._reviewed = new Set([...this._reviewed, agentName])
    this.dispatchEvent(new CustomEvent('review-submitted', { bubbles: true, composed: true }))
  }

  render() {
    const agents = this.evaluation.agentResults ?? []
    return html`
      <div class="panel">
        <div class="panel-header">
          <h3>Human Review — ${this.evaluation.imageFileName}</h3>
        </div>
        ${agents.map((agent: AgentResult) => {
          const done = this._reviewed.has(agent.agentName)
          return html`
            <div class="agent-row">
              <span class="agent-name">${agent.agentName} (${agent.score})</span>
              ${done
                ? html`<span class="done-badge">✅ Reviewed</span>`
                : html`
                  <div style="flex:1; min-width:180px;">
                    <input
                      class="comment-input"
                      placeholder="Optional comment…"
                      @input=${(e: InputEvent) => {
                        this._comments = {
                          ...this._comments,
                          [agent.agentName]: (e.target as HTMLInputElement).value,
                        }
                      }}
                    />
                  </div>
                  <div class="actions">
                    <button class="approve"  @click=${() => this._review(agent.agentName, 'approved')}>Approve</button>
                    <button class="reject"   @click=${() => this._review(agent.agentName, 'rejected')}>Reject</button>
                    <button class="escalate" @click=${() => this._review(agent.agentName, 'escalated')}>Escalate</button>
                  </div>
                `}
            </div>
          `
        })}
      </div>
    `
  }
}
