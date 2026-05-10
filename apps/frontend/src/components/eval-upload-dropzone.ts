import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

@customElement('eval-upload-dropzone')
export class EvalUploadDropzone extends LitElement {
  static styles = css`
    :host { display: block; }
    .zone {
      border: 2px dashed #cbd5e1;
      border-radius: 16px;
      padding: 48px 32px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      background: white;
    }
    .zone.drag-over {
      border-color: #2563eb;
      background: #eff6ff;
    }
    .zone.has-file {
      border-color: #22c55e;
      background: #f0fdf4;
    }
    .icon { font-size: 2.5rem; margin-bottom: 12px; }
    .label { font-size: 1rem; color: #475569; margin-bottom: 4px; }
    .sub   { font-size: 0.82rem; color: #94a3b8; }
    .preview {
      margin-top: 16px;
      max-height: 200px;
      max-width: 100%;
      border-radius: 8px;
      object-fit: contain;
    }
    .upload-btn {
      margin-top: 20px;
      padding: 10px 28px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-family: inherit;
      cursor: pointer;
      font-weight: 600;
    }
    .upload-btn:hover { background: #1d4ed8; }
    .upload-btn:disabled { background: #94a3b8; cursor: not-allowed; }
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    input[type="file"] { display: none; }
  `

  @property({ type: Boolean }) loading = false
  @state() private _file: File | null = null
  @state() private _preview: string | null = null
  @state() private _dragOver = false

  private _fileInput!: HTMLInputElement

  private _onDragOver(e: DragEvent) {
    e.preventDefault()
    this._dragOver = true
  }

  private _onDragLeave() {
    this._dragOver = false
  }

  private _onDrop(e: DragEvent) {
    e.preventDefault()
    this._dragOver = false
    const file = e.dataTransfer?.files[0]
    if (file) this._setFile(file)
  }

  private _onClick() {
    this.shadowRoot?.getElementById('file-input')?.click()
  }

  private _onChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) this._setFile(file)
  }

  private _setFile(file: File) {
    this._file = file
    const reader = new FileReader()
    reader.onload = () => { this._preview = reader.result as string }
    reader.readAsDataURL(file)
  }

  private _submit() {
    if (!this._file) return
    this.dispatchEvent(new CustomEvent('file-selected', { detail: this._file, bubbles: true, composed: true }))
  }

  render() {
    const cls = `zone ${this._dragOver ? 'drag-over' : ''} ${this._file ? 'has-file' : ''}`
    return html`
      <div
        class=${cls}
        @dragover=${this._onDragOver}
        @dragleave=${this._onDragLeave}
        @drop=${this._onDrop}
        @click=${this._onClick}
      >
        <div class="icon">${this._file ? '🖼' : '📤'}</div>
        <div class="label">
          ${this._file ? this._file.name : 'Drop your screenshot here or click to browse'}
        </div>
        <div class="sub">JPEG, PNG, WebP — max 10 MB</div>
        ${this._preview ? html`<img class="preview" src=${this._preview} alt="Preview" />` : ''}
        <input id="file-input" type="file" accept="image/jpeg,image/png,image/webp" @change=${this._onChange} />
      </div>

      ${this._file ? html`
        <button
          class="upload-btn"
          ?disabled=${this.loading}
          @click=${(e: Event) => { e.stopPropagation(); this._submit() }}
        >
          ${this.loading ? html`<span class="spinner"></span> Analysing…` : '🚀 Run Evaluation'}
        </button>
      ` : ''}
    `
  }
}
