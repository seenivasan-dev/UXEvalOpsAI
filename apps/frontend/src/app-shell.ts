import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'

type Route = 'dashboard' | 'evaluate' | 'history' | 'review'

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = css`
    :host { display: flex; flex-direction: column; min-height: 100vh; }

    nav {
      background: #1e3a8a;
      color: white;
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 0;
      height: 56px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    }

    .logo {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-right: 32px;
      color: #93c5fd;
    }

    .nav-link {
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      font-size: 0.9rem;
      padding: 16px 14px;
      font-family: inherit;
      transition: color 0.15s, border-bottom 0.15s;
      border-bottom: 3px solid transparent;
    }

    .nav-link:hover { color: white; }
    .nav-link[aria-current="page"] {
      color: white;
      border-bottom: 3px solid #93c5fd;
    }

    main { flex: 1; padding: 24px; max-width: 1200px; margin: 0 auto; width: 100%; }
  `

  @state() private route: Route = 'dashboard'

  connectedCallback() {
    super.connectedCallback()
    this._onHashChange()
    window.addEventListener('hashchange', () => this._onHashChange())
  }

  private _onHashChange() {
    const hash = location.hash.replace('#', '') as Route
    if (['dashboard', 'evaluate', 'history', 'review'].includes(hash)) {
      this.route = hash
    } else {
      this.route = 'dashboard'
    }
  }

  private _navigate(route: Route) {
    location.hash = route
  }

  private _page() {
    switch (this.route) {
      case 'evaluate': return html`<page-evaluate></page-evaluate>`
      case 'history': return html`<page-history></page-history>`
      case 'review': return html`<page-review-queue></page-review-queue>`
      default: return html`<page-dashboard></page-dashboard>`
    }
  }

  render() {
    return html`
      <nav>
        <span class="logo">⚡ EvalOps AI</span>
        ${(['dashboard', 'evaluate', 'history', 'review'] as Route[]).map(
          (r) => html`
            <button
              class="nav-link"
              aria-current=${this.route === r ? 'page' : 'false'}
              @click=${() => this._navigate(r)}
            >
              ${r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          `
        )}
      </nav>
      <main>${this._page()}</main>
    `
  }
}
