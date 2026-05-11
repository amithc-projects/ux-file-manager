import { useState, useEffect } from 'react';

/**
 * Returns a blob URL thumbnail for any image or video file handle.
 *
 * - Images: creates a blob URL directly from the file.
 * - Videos: checks for a persisted sidecar thumbnail (.{filename}.thumbnail.jpg)
 *   in the directory first; if absent, extracts the first frame and saves it.
 *
 * The URL is revoked automatically when the component unmounts or the handle changes.
 */
export function useThumbnails(
  fileHandle?: FileSystemFileHandle,
  dirHandle?: FileSystemDirectoryHandle
) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileHandle) return;

    const name = fileHandle.name;
    const isImage = /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(name);
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(name);

    if (!isImage && !isVideo) return;

    let objectUrl: string | null = null;
    let thumbUrl: string | null = null;
    let isActive = true;

    const thumbnailSidecarName = `.${name}.thumbnail.jpg`;

    async function run() {
      if (isImage) {
        const file = await fileHandle!.getFile();
        if (!isActive) return;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return;
      }

      // Video: try loading persisted sidecar thumbnail first
      if (dirHandle) {
        try {
          const thumbHandle = await dirHandle.getFileHandle(thumbnailSidecarName);
          const thumbFile = await thumbHandle.getFile();
          if (!isActive) return;
          thumbUrl = URL.createObjectURL(thumbFile);
          setUrl(thumbUrl);
          return; // done — no extraction needed
        } catch {
          // sidecar not found — fall through to extraction
        }
      }

      // Extract first frame
      const file = await fileHandle!.getFile();
      if (!isActive) return;
      objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = objectUrl;
      video.currentTime = 0.5;

      const onSeeked = () => {
        if (!isActive) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 160;
        canvas.height = video.videoHeight || 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async (blob) => {
            if (!blob) return;
            if (isActive) {
              thumbUrl = URL.createObjectURL(blob);
              setUrl(thumbUrl);
            }
            // Release the full video blob URL — we only needed the frame
            if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }

            // Persist the thumbnail sidecar for next time
            if (dirHandle) {
              try {
                const sidecarHandle = await dirHandle.getFileHandle(thumbnailSidecarName, { create: true });
                const writable = await (sidecarHandle as any).createWritable();
                await writable.write(blob);
                await writable.close();
              } catch {
                // Silently ignore — read-only dir or permission denied
              }
            }
          }, 'image/jpeg', 0.8);
        }
        video.src = '';
      };

      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', () => {
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
        video.src = '';
      }, { once: true });
    }

    run().catch(console.warn);

    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
  }, [fileHandle, dirHandle]);

  return url;
}
