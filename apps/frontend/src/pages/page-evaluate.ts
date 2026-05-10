import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { api, type EvaluationJob } from '../services/api'

type Phase = 'upload' | 'processing' | 'done' | 'error'

const POLL_INTERVAL = 2000

@customElement('page-evaluate')
export class PageEvaluate extends LitElement {
  static styles = css`
    :host { display: block; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 1.6rem; font-weight: 800; color: #1e293b; margin: 0 0 4px; }
    .subtitle { color: #64748b; margin: 0 0 28px; }
    .section-title {
      font-size: 0.78rem; text-transform: uppercase;
      letter-spacing: 0.07em; color: #94a3b8;
      font-weight: 700; margin: 24px 0 12px;
    }
    .processing-box {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      text-align: center;
    }
    .processing-title { font-size: 1rem; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
    .job-id { font-size: 0.75rem; color: #94a3b8; margin-top: 16px; font-family: monospace; }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 12px;
      padding: 20px;
      color: #b91c1c;
    }
    .reset-btn {
      margin-top: 16px;
      padding: 8px 20px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 600;
    }
  `

  @state() private _phase: Phase = 'upload'
  @state() private _job: EvaluationJob | null = null
  @state() private _error = ''
  private _pollTimer?: ReturnType<typeof setTimeout>

  disconnectedCallback() {
    super.disconnectedCallback()
    clearTimeout(this._pollTimer)
  }

  private async _onFileSelected(e: CustomEvent) {
    const file = e.detail as File
    this._phase = 'processing'
    this._error = ''
    try {
      this._job = await api.uploadImage(file)
      this._startPolling()
    } catch (err) {
      this._phase = 'error'
      this._error = (err as Error).message
    }
  }

  private _startPolling() {
    if (!this._job) return
    this._pollTimer = setTimeout(async () => {
      try {
        const updated = await api.getEvaluation(this._job!.id)
        this._job = updated
        if (updated.status === 'completed' || updated.status === 'failed') {
          this._phase = updated.status === 'completed' ? 'done' : 'error'
          if (updated.status === 'failed') this._error = 'Evaluation failed. Please try again.'
        } else {
          this._startPolling()
        }
      } catch {
        this._startPolling()
      }
    }, POLL_INTERVAL)
  }

  private _reset() {
    clearTimeout(this._pollTimer)
    this._phase = 'upload'
    this._job = null
    this._error = ''
  }

  render() {
    return html`
      <h1>New Evaluation</h1>
      <p class="subtitle">Upload a UI screenshot and our 4 AI agents will analyse it in parallel</p>

      ${this._phase === 'upload' ? html`
        <eval-upload-dropzone
          @file-selected=${this._onFileSelected}
          .loading=${false}
        ></eval-upload-dropzone>
      ` : ''}

      ${this._phase === 'processing' ? html`
        <div class="processing-box">
          <div class="processing-title">⚡ Agents running in parallel…</div>
          <eval-agent-progress
            .completedAgents=${this._job?.agentResults?.map((r) => r.agentName) ?? []}
            runningAgent=""
          ></eval-agent-progress>
          <div class="job-id">Job ID: ${this._job?.id ?? ''}</div>
        </div>
      ` : ''}

      ${this._phase === 'done' && this._job ? html`
        <div class="section-title">Evaluation Report</div>
        <eval-report-card .evaluation=${this._job}></eval-report-card>
        <br />
        <button class="reset-btn" @click=${this._reset}>+ New Evaluation</button>
      ` : ''}

      ${this._phase === 'error' ? html`
        <div class="error-box">
          ❌ ${this._error}
          <br />
          <button class="reset-btn" @click=${this._reset}>Try Again</button>
        </div>
      ` : ''}
    `
  }
}
