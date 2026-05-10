import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

const AGENTS = ['Visual Hierarchy', 'Accessibility', 'Copy and Tone', 'Design Consistency']

@customElement('eval-agent-progress')
export class EvalAgentProgress extends LitElement {
  static styles = css`
    :host { display: block; }
    .agents { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .agent-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .agent-card.done { border-color: #22c55e; }
    .agent-card.running { border-color: #3b82f6; animation: pulse 1.2s infinite; }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3); }
      50% { box-shadow: 0 0 0 6px rgba(59,130,246,0); }
    }
    .status-icon { font-size: 1.4rem; }
    .agent-name { font-weight: 600; font-size: 0.9rem; color: #1e293b; }
    .agent-state { font-size: 0.78rem; color: #94a3b8; }
    .agent-state.running { color: #3b82f6; }
    .agent-state.done    { color: #22c55e; }
  `

  @property({ type: Array }) completedAgents: string[] = []
  @property({ type: String }) runningAgent: string = ''

  private _stateFor(name: string) {
    if (this.completedAgents.includes(name)) return 'done'
    if (this.runningAgent === name) return 'running'
    return 'waiting'
  }

  private _iconFor(state: string) {
    return { done: '✅', running: '⚡', waiting: '⏳' }[state] ?? '⏳'
  }

  render() {
    return html`
      <div class="agents">
        ${AGENTS.map((name) => {
          const state = this._stateFor(name)
          return html`
            <div class="agent-card ${state}">
              <span class="status-icon">${this._iconFor(state)}</span>
              <div>
                <div class="agent-name">${name}</div>
                <div class="agent-state ${state}">${state}</div>
              </div>
            </div>
          `
        })}
      </div>
    `
  }
}
