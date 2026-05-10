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
    return ['hidden-files-count', 'hidden-files-message', 'compare-mode'];
  }

  attributeChangedCallback() {
    this._rerender();
  }

  // ── Imperative properties ─────────────────────────────────────────────────

  private _customSort: ((a: any, b: any) => number) | null = null;
  get customSort() { return this._customSort; }
  set customSort(fn: ((a: any, b: any) => number) | null) {
    this._customSort = fn;
    this._rerender();
  }

  /** Called by host to open a file info panel. Receives the File object. */
  onDoubleClick: ((entry: any, index: number, filtered: any[]) => void) | null = null;

  /** Transform compare: async (file: File) => { beforeUrl, afterUrl, beforeLabel?, afterLabel? } | { noPreview, noPreviewReason? } */
  private _onCompareRender: ((file: File) => Promise<any>) | null = null;
  get compareRender() { return this._onCompareRender; }
  set compareRender(fn: ((file: File) => Promise<any>) | null) {
    this._onCompareRender = fn;
    this._rerender();
  }

  /** Called when ℹ️ button clicked in transform compare view. Receives File. */
  private _onCompareInfo: ((file: File) => Promise<void>) | null = null;
  get compareInfo() { return this._onCompareInfo; }
  set compareInfo(fn: ((file: File) => Promise<void>) | null) {
    this._onCompareInfo = fn;
    this._rerender();
  }

  /** Raw HTML string rendered in the controls bar above the compare viewer */
  private _compareControls: string = '';
  get compareControls() { return this._compareControls; }
  set compareControls(html: string) {
    this._compareControls = html;
    this._rerender();
  }

  /** Called once after compareControls HTML is injected. Wire up button handlers here. */
  private _compareBindControls: ((container: HTMLDivElement) => void) | null = null;
  get compareBindControls() { return this._compareBindControls; }
  set compareBindControls(fn: ((container: HTMLDivElement) => void) | null) {
    this._compareBindControls = fn;
    this._rerender();
  }

  /** Custom buttons shown in the selection action bar. Each: { label, icon?, onClick(selectedIds) } */
  private _selectionActions: any[] = [];
  get selectionActions() { return this._selectionActions; }
  set selectionActions(actions: any[]) {
    this._selectionActions = actions ?? [];
    this._rerender();
  }

  // Internal ref so triggerProcess() can call back into the React tree
  private _triggerProcessRef: React.MutableRefObject<(() => void) | null> = { current: null };

  // ── Methods ───────────────────────────────────────────────────────────────

  navigate(path: string, options?: any) {
    if (this.appRef.current) this.appRef.current.navigate(path, options);
  }

  setRoot(handle: any) {
    if (this.appRef.current) this.appRef.current.setRoot(handle);
  }

  /** Re-run the transform compare render on the currently active file. */
  triggerProcess() {
    if (this._triggerProcessRef.current) this._triggerProcessRef.current();
  }

  // ── Internal render helper ─────────────────────────────────────────────────

  private _rerender() {
    if (!this.root || !this._telemetryHandler) return;

    const hiddenCount = parseInt(this.getAttribute('hidden-files-count') || '0', 10) || 0;
    const hiddenMessage = this.getAttribute('hidden-files-message') || undefined;
    const compareMode = (this.getAttribute('compare-mode') as 'two-file' | 'transform') || 'two-file';

    this.root.render(
      <React.StrictMode>
        <App
          onTelemetry={this._telemetryHandler}
          ref={this.appRef}
          customSort={this._customSort ?? undefined}
          hiddenFilesCount={hiddenCount}
          hiddenFilesMessage={hiddenMessage}
          compareMode={compareMode}
          onCompareRender={this._onCompareRender ?? undefined}
          onCompareInfo={this._onCompareInfo ?? undefined}
          customControlsHtml={this._compareControls || undefined}
          onBindCustomControls={this._compareBindControls ?? undefined}
          triggerProcessRef={this._triggerProcessRef}
          selectionActions={this._selectionActions}
        />
      </React.StrictMode>
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = tailwindCss;
    shadow.appendChild(style);

    const mountPoint = document.createElement('div');
    mountPoint.style.height = '100%';
    mountPoint.style.width = '100%';
    shadow.appendChild(mountPoint);

    this.root = ReactDOM.createRoot(mountPoint);

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
