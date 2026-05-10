import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('eval-confidence-indicator')
export class EvalConfidenceIndicator extends LitElement {
  static styles = css`
    :host { display: block; }
    .wrapper { display: flex; align-items: center; gap: 8px; }
    .bar-track {
      flex: 1;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease;
    }
    .score-label {
      font-size: 0.85rem;
      font-weight: 700;
      min-width: 34px;
      text-align: right;
    }
    .good   { background: #22c55e; }
    .warning { background: #f59e0b; }
    .critical { background: #ef4444; }
  `

  @property({ type: Number }) score = 0

  private _colorClass() {
    if (this.score >= 80) return 'good'
    if (this.score >= 60) return 'warning'
    return 'critical'
  }

  render() {
    return html`
      <div class="wrapper">
        <div class="bar-track">
          <div
            class="bar-fill ${this._colorClass()}"
            style="width: ${this.score}%"
          ></div>
        </div>
        <span class="score-label" style="color: var(--fill-color)">${this.score}</span>
      </div>
    `
  }
}
