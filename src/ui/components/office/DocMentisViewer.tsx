/**
 * DocMentisViewer
 *
 * Mounts the docMentis UDocClient + UDocViewer into a container div,
 * loads the given File, and tears everything down on unmount.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UDocClient as UDocClientType } from '@docmentis/udoc-viewer';

interface Props {
  file: File;
  licenseKey?: string;
}

export function DocMentisViewer({ file, licenseKey }: Props) {
  const { t } = useTranslation();
  const containerRef  = useRef<HTMLDivElement>(null);
  const clientRef     = useRef<UDocClientType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const container = containerRef.current;

    async function init() {
      try {
        // Dynamic import keeps docMentis out of the main IIFE bundle. In dev,
        // Vite resolves this bare specifier from node_modules. In the IIFE
        // build it's marked external and rewritten to the vendored ESM via
        // Rollup's output.paths (→ ./vendor/docmentis/index.js), so no import
        // map is needed — compatible with the Chrome extension's MV3 CSP.
        const { UDocClient } = await import('@docmentis/udoc-viewer');

        const client = await UDocClient.create({
          license: licenseKey || undefined,
        });

        if (cancelled) { client.destroy(); return; }
        clientRef.current = client;

        const viewer = await client.createViewer({ container });
        if (cancelled) { client.destroy(); return; }

        await viewer.load(file);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? t('office.failedToLoad'));
      }
    }

    init();

    return () => {
      cancelled = true;
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, [file, licenseKey]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="text-red-400 bg-red-900/20 border border-red-500/40 rounded-xl px-6 py-4 text-sm font-mono">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ colorScheme: 'dark' }}
    />
  );
}
