import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, X, Maximize, Minimize } from 'lucide-react';
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
        <div ref={containerRef} className="fixed inset-0 z-[400] bg-black flex flex-col justify-center items-center select-none group">
            {currentUrl && <img src={currentUrl} className="w-full h-full object-contain" draggable={false} />}
            
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="absolute top-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                <button onClick={toggleFullscreen} className="bg-dark-800/80 hover:bg-dark-700 text-white p-3 rounded-full backdrop-blur shadow-lg transition-transform hover:scale-110">
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
                <button onClick={onClose} className="bg-dark-800/80 hover:bg-red-500 text-white p-3 rounded-full backdrop-blur shadow-lg transition-transform hover:scale-110">
                    <X size={20} />
                </button>
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-dark-900/80 px-8 py-4 rounded-full backdrop-blur-md border border-dark-600/50 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50">
                <button onClick={() => { setIsPlaying(false); handlePrev(); }} className="text-gray-300 hover:text-white transition-colors hover:scale-110 transform">
                    <ChevronLeft size={32} />
                </button>
                
                <button onClick={() => setIsPlaying(!isPlaying)} className="w-14 h-14 bg-white text-black flex items-center justify-center rounded-full hover:bg-gray-200 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    {isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-1" />}
                </button>
                
                <button onClick={() => { setIsPlaying(false); handleNext(); }} className="text-gray-300 hover:text-white transition-colors hover:scale-110 transform">
                    <ChevronRight size={32} />
                </button>
            </div>

            <div className="absolute top-6 left-6 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                <span className="bg-dark-900/80 text-white font-mono text-sm px-4 py-2 rounded-full backdrop-blur shadow-lg border border-dark-700">
                    {currentIndex + 1} / {items.length}
                </span>
            </div>
        </div>
    );
}
