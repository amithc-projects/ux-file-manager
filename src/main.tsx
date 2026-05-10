import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './apps/web/App';
import tailwindCss from './index.css?inline';

class SidekickManager extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private appRef = React.createRef<any>();
  private _telemetryHandler: ((name: string, payload: any) => void) | null = null;

  // ── Observed HTML attributes ───────────────────────────────────────────────
  static get observedAttributes() {
    return ['hidden-files-count', 'hidden-files-message'];
  }

  attributeChangedCallback() {
    this._rerender();
  }

  // ── Imperative properties ─────────────────────────────────────────────────
  // Each setter triggers a re-render so React sees the new value.

  private _customSort: ((a: any, b: any) => number) | null = null;
  get customSort() { return this._customSort; }
  set customSort(fn: ((a: any, b: any) => number) | null) {
    this._customSort = fn;
    this._rerender();
  }

  /** Double-click handler — receives (entry, index, filteredList). */
  onDoubleClick: ((entry: any, index: number, filtered: any[]) => void) | null = null;

  // ── Methods ───────────────────────────────────────────────────────────────

  navigate(path: string, options?: any) {
    if (this.appRef.current) this.appRef.current.navigate(path, options);
  }

  setRoot(handle: any) {
    if (this.appRef.current) this.appRef.current.setRoot(handle);
  }

  /** Re-run the transform compare render on the currently active file. */
  triggerProcess() {
    if (this.appRef.current?.triggerProcess) this.appRef.current.triggerProcess();
  }

  // ── Internal render helper ─────────────────────────────────────────────────

  private _rerender() {
    if (!this.root || !this._telemetryHandler) return;

    const hiddenCount = parseInt(this.getAttribute('hidden-files-count') || '0', 10) || 0;
    const hiddenMessage = this.getAttribute('hidden-files-message') || undefined;

    this.root.render(
      <React.StrictMode>
        <App
          onTelemetry={this._telemetryHandler}
          ref={this.appRef}
          customSort={this._customSort ?? undefined}
          hiddenFilesCount={hiddenCount}
          hiddenFilesMessage={hiddenMessage}
        />
      </React.StrictMode>
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    // Inject Tailwind explicitly into the Shadow boundary, preventing global CSS corruption!
    const style = document.createElement('style');
    style.textContent = tailwindCss;
    shadow.appendChild(style);

    const mountPoint = document.createElement('div');
    mountPoint.style.height = '100%';
    mountPoint.style.width = '100%';
    shadow.appendChild(mountPoint);

    this.root = ReactDOM.createRoot(mountPoint);

    // Standardize Native Custom Event Telemetry out to the Host Application
    this._telemetryHandler = (eventName: string, payload: any) => {
      this.dispatchEvent(new CustomEvent(eventName, { detail: payload, bubbles: true, composed: true }));
    };

    this._rerender();
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this._telemetryHandler = null;
  }
}

customElements.define('sidekick-manager', SidekickManager);
