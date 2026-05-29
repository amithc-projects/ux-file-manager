import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface ZoomState {
  scale: number;
  tx: number; // translateX in px
  ty: number; // translateY in px
}

export const DEFAULT_ZOOM: ZoomState = { scale: 1, tx: 0, ty: 0 };

interface ZoomableImageProps {
  src: string;
  alt?: string;
  /** When provided, this component reads+writes shared zoom instead of local state */
  zoomState?: ZoomState;
  onZoomChange?: (z: ZoomState) => void;
  className?: string;
}

export function ZoomableImage({ src, alt, zoomState, onZoomChange, className }: ZoomableImageProps) {
  const { t } = useTranslation();
  const [localZoom, setLocalZoom] = useState<ZoomState>(DEFAULT_ZOOM);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);

  const zoom = zoomState ?? localZoom;
  const setZoom = useCallback((z: ZoomState) => {
    if (onZoomChange) onZoomChange(z);
    else setLocalZoom(z);
  }, [onZoomChange]);

  // Reset zoom when image changes
  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
  }, [src]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const prev = zoomRef.current;
    const newScale = Math.max(0.25, Math.min(32, prev.scale * factor));
    const ratio = newScale / prev.scale;
    setZoom({
      scale: newScale,
      tx: mouseX - (mouseX - prev.tx) * ratio,
      ty: mouseY - (mouseY - prev.ty) * ratio,
    });
  }, [setZoom]);

  // Attach wheel with { passive: false } so preventDefault works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom.scale <= 1) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTx: zoom.tx, startTy: zoom.ty };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setZoom({ ...zoom, tx: dragRef.current.startTx + dx, ty: dragRef.current.startTy + dy });
  };

  const handleMouseUp = () => { dragRef.current = null; };

  const handleDoubleClick = () => setZoom(DEFAULT_ZOOM);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? 'w-full h-full'}`}
      style={{ cursor: zoom.scale > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          transformOrigin: '0 0',
          transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          userSelect: 'none',
          pointerEvents: 'none',
          transition: dragRef.current ? 'none' : 'transform 0.05s ease-out',
        }}
      />
      {zoom.scale !== 1 && (
        <div className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/60 text-white px-2 py-0.5 rounded pointer-events-none">
          {t('zoomableImage.resetHint', { percent: Math.round(zoom.scale * 100) })}
        </div>
      )}
    </div>
  );
}
