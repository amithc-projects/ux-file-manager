import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './apps/web/App';
import tailwindCss from './index.css?inline';

class SidekickManager extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private appRef = React.createRef<any>();

  navigate(path: string) {
    if (this.appRef.current) {
        this.appRef.current.navigate(path);
    }
  }

  setRoot(handle: any) {
    if (this.appRef.current) {
        this.appRef.current.setRoot(handle);
    }
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
        <App onTelemetry={handleTelemetry} ref={this.appRef} />
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
