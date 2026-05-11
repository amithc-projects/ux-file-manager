import { useState, useEffect, useRef } from 'react';

/**
 * Returns a blob URL thumbnail for a file.
 *
 * - Images: blob URL from the file directly.
 * - Videos with a pre-scanned thumbnailHandle: loads the sidecar instantly.
 * - Videos without: extracts the first frame via canvas.
 *
 * Persistence (writing .{name}.thumbnail.jpg to disk) is handled separately
 * by App.tsx's background loop so it always has a valid directory handle.
 */
export function useThumbnails(
  fileHandle?: FileSystemFileHandle,
  thumbnailHandle?: FileSystemFileHandle
) {
  const [url, setUrl] = useState<string | null>(null);
  // Track the active blob URL so we can revoke only after the new one is set
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!fileHandle) return;

    const name = fileHandle.name;
    const isImage = /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(name);
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(name);

    if (!isImage && !isVideo) return;

    let isActive = true;

    function setNewUrl(newUrl: string) {
      const old = activeUrlRef.current;
      activeUrlRef.current = newUrl;
      setUrl(newUrl);
      // Revoke the old URL after a tick so any in-flight img loads finish
      if (old) setTimeout(() => URL.revokeObjectURL(old), 500);
    }

    async function run() {
      // Video with a persisted thumbnail sidecar — load it instantly
      if (isVideo && thumbnailHandle) {
        const file = await thumbnailHandle.getFile();
        if (!isActive) return;
        setNewUrl(URL.createObjectURL(file));
        return;
      }

      if (isImage) {
        const file = await fileHandle!.getFile();
        if (!isActive) return;
        setNewUrl(URL.createObjectURL(file));
        return;
      }

      // Video without sidecar — extract first frame
      const file = await fileHandle!.getFile();
      if (!isActive) return;
      const videoObjectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.muted = true;

      video.addEventListener('error', () => {
        URL.revokeObjectURL(videoObjectUrl);
        video.src = '';
      }, { once: true });

      // loadeddata fires when the first frame is available and decodable
      video.addEventListener('loadeddata', () => {
        if (!isActive) { URL.revokeObjectURL(videoObjectUrl); video.src = ''; return; }
        // rAF ensures the browser has painted the decoded frame before canvas capture
        requestAnimationFrame(() => {
          if (!isActive) { URL.revokeObjectURL(videoObjectUrl); video.src = ''; return; }
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 160;
          canvas.height = video.videoHeight || 90;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(videoObjectUrl);
              video.src = '';
              if (!blob || !isActive) return;
              setNewUrl(URL.createObjectURL(blob));
            }, 'image/jpeg', 0.8);
          } else {
            URL.revokeObjectURL(videoObjectUrl);
            video.src = '';
          }
        });
      }, { once: true });

      video.preload = 'auto';
      video.playsInline = true;
      video.src = videoObjectUrl;
      video.load();
    }

    run().catch(console.warn);

    return () => {
      isActive = false;
      // Don't revoke activeUrlRef here — it may still be rendering.
      // It will be revoked when the next URL is set (setNewUrl) or on unmount below.
    };
  }, [fileHandle?.name, thumbnailHandle?.name]);  // Use names, not object refs, to avoid spurious re-runs

  // Revoke on unmount
  useEffect(() => {
    return () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, []);

  return url;
}
