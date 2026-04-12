import { useState, useEffect } from 'react';

export function useThumbnails(fileHandle?: FileSystemFileHandle) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileHandle) return;

    // Check if it's an image file by extension natively or we just attempt
    const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(fileHandle.name);
    
    if (!isImage) return;

    let objectUrl: string | null = null;
    let isActive = true;

    fileHandle.getFile().then((file) => {
      if (!isActive) return;
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
    }).catch(console.warn);

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileHandle]);

  return url;
}
