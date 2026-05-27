import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, X, Maximize } from 'lucide-react';
import { GridItem } from '../../core/models/FilePair';

interface SlideshowModalProps {
    items: GridItem[];
    onClose: () => void;
}

export function SlideshowModal({ items, onClose }: SlideshowModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const activeItem = items[currentIndex];

    useEffect(() => {
        if (!activeItem || activeItem.type !== 'file') return;
        let active = true;
        let objectUrl = '';
        activeItem.pair.mainHandle.getFile().then(file => {
            if (!active) return;
            objectUrl = URL.createObjectURL(file);
            setCurrentUrl(objectUrl);
        });
        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [activeItem]);

    const handleNext = () => setCurrentIndex(i => (i + 1) % items.length);
    const handlePrev = () => setCurrentIndex(i => (i - 1 + items.length) % items.length);

    useEffect(() => {
        if (!isPlaying) return;
        const t = setInterval(handleNext, 3000);
        return () => clearInterval(t);
    }, [isPlaying, items.length]);

    useEffect(() => {
        const hKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (document.fullscreenElement) document.exitFullscreen();
                else onClose();
            } else if (e.key === 'ArrowRight') {
                setIsPlaying(false);
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                setIsPlaying(false);
                handlePrev();
            } else if (e.key === ' ') {
                e.preventDefault();
                setIsPlaying(p => !p);
            }
        };
        window.addEventListener('keydown', hKey);
        return () => window.removeEventListener('keydown', hKey);
    }, [onClose]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const changeFs = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', changeFs);
        return () => document.removeEventListener('fullscreenchange', changeFs);
    }, []);

    return (
        <div ref={containerRef} className="fixed inset-0 z-[400] bg-black flex flex-col select-none">

            {/* Control strip — always visible, hidden in fullscreen */}
            {!isFullscreen && (
                <div className="flex items-center gap-3 px-4 h-14 bg-black/90 backdrop-blur border-b border-white/10 shrink-0 z-50">
                    {/* Counter */}
                    <span className="text-white font-mono text-sm tabular-nums w-16">
                        {currentIndex + 1} / {items.length}
                    </span>

                    {/* Prev */}
                    <button
                        onClick={() => { setIsPlaying(false); handlePrev(); }}
                        className="text-gray-300 hover:text-white transition-colors p-1"
                        title="Previous (←)"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    {/* Play / Pause */}
                    <button
                        onClick={() => setIsPlaying(p => !p)}
                        className="w-9 h-9 bg-white text-black flex items-center justify-center rounded-full hover:bg-gray-200 transition-transform hover:scale-105 active:scale-95 shadow-lg"
                        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    >
                        {isPlaying
                            ? <Pause size={16} className="fill-current" />
                            : <Play size={16} className="fill-current ml-0.5" />}
                    </button>

                    {/* Next */}
                    <button
                        onClick={() => { setIsPlaying(false); handleNext(); }}
                        className="text-gray-300 hover:text-white transition-colors p-1"
                        title="Next (→)"
                    >
                        <ChevronRight size={24} />
                    </button>

                    <div className="flex-1" />

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        className="text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                        title="Fullscreen"
                    >
                        <Maximize size={18} />
                    </button>

                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-red-500/80"
                        title="Close (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Image area — fills remaining space */}
            <div className="flex-1 flex items-center justify-center min-h-0">
                {currentUrl && (
                    <img
                        src={currentUrl}
                        className="max-w-full max-h-full object-contain"
                        draggable={false}
                    />
                )}
            </div>

            {/* Fullscreen: minimal exit hint */}
            {isFullscreen && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none">
                    Esc to exit · ← → to navigate · Space to pause
                </div>
            )}
        </div>
    );
}
