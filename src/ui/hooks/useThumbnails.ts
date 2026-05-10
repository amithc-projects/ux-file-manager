import { useState, useEffect } from 'react';

/**
 * Returns a blob URL thumbnail for any image or video file handle.
 *
 * - Images: creates a blob URL directly from the file.
 * - Videos: extracts the first frame via an offscreen <video> + canvas drawImage.
 *
 * The URL is revoked automatically when the component unmounts or the handle changes.
 */
export function useThumbnails(fileHandle?: FileSystemFileHandle) {
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

    fileHandle.getFile().then((file) => {
      if (!isActive) return;

      if (isImage) {
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return;
      }

      // Video: extract first frame via offscreen <video> + canvas
      objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = objectUrl;
      video.currentTime = 0.5; // small offset to avoid black first frame

      const onSeeked = () => {
        if (!isActive) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 160;
        canvas.height = video.videoHeight || 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob && isActive) {
              thumbUrl = URL.createObjectURL(blob);
              setUrl(thumbUrl);
            }
            // Release the full video blob URL — we only needed the frame
            if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
          }, 'image/jpeg', 0.8);
        }
        video.src = '';
      };

      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', () => {
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
        video.src = '';
      }, { once: true });
    }).catch(console.warn);

    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
  }, [fileHandle]);

  return url;
}
