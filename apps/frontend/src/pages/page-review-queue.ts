import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { api, type EvaluationJob } from '../services/api'

@customElement('page-review-queue')
export class PageReviewQueue extends LitElement {
  static styles = css`
    :host { display: block; }
    h1 { font-size: 1.6rem; font-weight: 800; color: #1e293b; margin: 0 0 4px; }
    .subtitle { color: #64748b; margin: 0 0 28px; }
    .queue { display: flex; flex-direction: column; gap: 24px; }
    .section-label {
      font-size: 0.78rem; text-transform: uppercase;
      letter-spacing: 0.07em; color: #94a3b8; font-weight: 700; margin-bottom: 12px;
    }
    .empty { color: #94a3b8; text-align: center; padding: 48px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; }
    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      background: #fee2e2; color: #b91c1c;
      font-size: 0.78rem; font-weight: 700;
      width: 24px; height: 24px; border-radius: 50%; margin-left: 8px;
    }
  `

  @state() private _pending: EvaluationJob[] = []
  @state() private _loading = true

  connectedCallback() {
    super.connectedCallback()
    this._load()
  }

  private async _load() {
    try {
      this._pending = await api.getPendingReviews()
    } finally {
      this._loading = false
    }
  }

  private _onReviewSubmitted() {
    this._load()
  }

  render() {
    return html`
      <h1>
        Review Queue
        ${this._pending.length > 0 ? html`<span class="badge">${this._pending.length}</span>` : ''}
      </h1>
      <p class="subtitle">Approve, reject, or escalate agent-generated findings before they are accepted</p>

      ${this._loading
        ? html`<div class="empty">Loading queue…</div>`
        : this._pending.length === 0
        ? html`<div class="empty">✅ No pending reviews — queue is clear!</div>`
        : html`
          <div class="queue">
            ${this._pending.map(
              (job) => html`
                <div>
                  <eval-review-panel
                    .evaluation=${job}
                    @review-submitted=${this._onReviewSubmitted}
                  ></eval-review-panel>
                </div>
              `
            )}
          </div>
        `}
    `
  }
}
