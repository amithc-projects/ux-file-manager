import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './apps/web/App';
import tailwindCss from './index.css?inline';

class SidekickManager extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private appRef = React.createRef<any>();

  // ── Imperative properties (set by host before or after connectedCallback) ──
  // Each setter triggers a re-render so the React tree sees the new value.

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
    if (this.appRef.current) {
        this.appRef.current.navigate(path, options);
    }
  }

  setRoot(handle: any) {
    if (this.appRef.current) {
        this.appRef.current.setRoot(handle);
    }
  }

  /** Re-run the transform compare render on the currently active file. */
  triggerProcess() {
    if (this.appRef.current?.triggerProcess) {
        this.appRef.current.triggerProcess();
    }
  }

  /** Re-render the React tree with the latest imperative prop values. */
  private _rerender() {
    if (!this.root) return;
    const shadow = this.shadowRoot;
    if (!shadow) return;
    const handleTelemetry = (eventName: string, payload: any) => {
       this.dispatchEvent(new CustomEvent(eventName, { detail: payload, bubbles: true, composed: true }));
    };
    this.root.render(
      <React.StrictMode>
        <App
          onTelemetry={handleTelemetry}
          ref={this.appRef}
          customSort={this._customSort ?? undefined}
        />
      </React.StrictMode>
    );
  }

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
    const handleTelemetry = (eventName: string, payload: any) => {
       this.dispatchEvent(new CustomEvent(eventName, { 
           detail: payload, 
           bubbles: true, 
           composed: true 
       }));
    };

    this.root.render(
      <React.StrictMode>
        <App
          onTelemetry={handleTelemetry}
          ref={this.appRef}
          customSort={this._customSort ?? undefined}
        />
      </React.StrictMode>
    );
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

customElements.define('sidekick-manager', SidekickManager);
