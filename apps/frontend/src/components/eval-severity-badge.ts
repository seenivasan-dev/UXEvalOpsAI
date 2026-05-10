import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('eval-severity-badge')
export class EvalSeverityBadge extends LitElement {
  static styles = css`
    :host { display: inline-block; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .high   { background: #fee2e2; color: #b91c1c; }
    .medium { background: #fef9c3; color: #92400e; }
    .low    { background: #f1f5f9; color: #475569; }
  `

  @property() severity: 'high' | 'medium' | 'low' = 'low'

  render() {
    const icons: Record<string, string> = { high: '●', medium: '◐', low: '○' }
    return html`
      <span class="badge ${this.severity}">
        ${icons[this.severity] ?? '○'} ${this.severity}
      </span>
    `
  }
}
