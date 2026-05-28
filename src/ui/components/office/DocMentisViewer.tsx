/**
 * DocMentisViewer
 *
 * Mounts the docMentis UDocClient + UDocViewer into a container div,
 * loads the given File, and tears everything down on unmount.
 */
import { useEffect, useRef, useState } from 'react';
import { UDocClient } from '@docmentis/udoc-viewer';

interface Props {
  file: File;
  licenseKey?: string;
}

export function DocMentisViewer({ file, licenseKey }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const clientRef     = useRef<UDocClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const container = containerRef.current;

    async function init() {
      try {
        const client = await UDocClient.create({
          license: licenseKey || undefined,
        });

        if (cancelled) { client.destroy(); return; }
        clientRef.current = client;

        const viewer = await client.createViewer({ container });
        if (cancelled) { client.destroy(); return; }

        await viewer.load(file);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load document');
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
