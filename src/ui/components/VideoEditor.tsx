import { useState, useEffect, useRef } from 'react';
import { Scissors, Save, X, Play, Pause, Loader2 } from 'lucide-react';

interface VideoEditorProps {
    file: File;
    originalName: string;
    onClose?: () => void;
    onSaveNewFile?: (blob: Blob, suffixName: string) => Promise<void>;
}

export function VideoEditor({ file, originalName, onSaveNewFile }: VideoEditorProps) {
    const [url, setUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    
    // Trimming State
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);
    const [activeDragThumb, setActiveDragThumb] = useState<'start' | 'end' | null>(null);
    
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [file]);

    useEffect(() => {
        if (!isEditing || thumbnails.length > 0) return;
        
        // Generate thumbnails on edit mode
        let active = true;
        const genThumbs = async () => {
            const v = document.createElement('video');
            v.src = URL.createObjectURL(file);
            v.muted = true;
            v.preload = 'metadata';
            
            await new Promise((r) => { v.onloadedmetadata = r; });
            const total = v.duration;
            setDuration(total);
            setTrimEnd(total); // Init bounds
            
            const count = 10;
            const step = total / count;
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d');
            const thumbs: string[] = [];
            
            v.onseeked = () => {
                if (!active) return;
                c.width = v.videoWidth / 4;
                c.height = v.videoHeight / 4;
                ctx?.drawImage(v, 0, 0, c.width, c.height);
                thumbs.push(c.toDataURL('image/jpeg', 0.5));
                if (thumbs.length < count) {
                    v.currentTime = thumbs.length * step;
                } else {
                    setThumbnails(thumbs);
                    URL.revokeObjectURL(v.src);
                }
            };
            v.currentTime = 0; // trigger first seek
        };
        genThumbs();
        return () => { active = false; }
    }, [isEditing, file, thumbnails.length]);

    // Handle Playback loop syncing with Trims
    useEffect(() => {
        const v = videoRef.current;
        if (!v || !isEditing) return;
        
        const updateTime = () => {
            setCurrentTime(v.currentTime);
            // Loop logic
            if (v.currentTime >= trimEnd && isPlaying) {
                v.currentTime = trimStart;
            }
        };
        
        v.addEventListener('timeupdate', updateTime);
        return () => v.removeEventListener('timeupdate', updateTime);
    }, [isEditing, trimStart, trimEnd]);

    // MediaBunny Transcode logic
    const handleExecuteTrim = async () => {
        setIsProcessing(true);
        try {
            // Lazy load to prevent breaking SSR or initial bundle parsing
            const mb = await import('mediabunny');
            
            const input = new mb.Input({
                source: new mb.BlobSource(file),
                formats: mb.ALL_FORMATS,
            });
            
            const outputFORMAT = new mb.Mp4OutputFormat();
            const outputTARGET = new mb.BufferTarget();
            const output = new mb.Output({
                format: outputFORMAT,
                target: outputTARGET,
            });

            // Conversion graph with trimming options
            const conversion = await mb.Conversion.init({ 
                input, 
                output,
                trim: {
                    start: trimStart,
                    end: trimEnd
                }
            });
            // Execution of the rendering pipeline.
            await conversion.execute();
            
            if (!outputTARGET.buffer) throw new Error("Processing failed: output buffer is null");
            if (onSaveNewFile) {
                const blob = new Blob([outputTARGET.buffer], { type: 'video/mp4' });
                await onSaveNewFile(blob, `${originalName} (Trimmed).mp4`);
            }
            
            setIsEditing(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!url) return null;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative bg-black group overflow-hidden">
            <video 
               ref={videoRef}
               src={url} 
               controls={!isEditing} 
               autoPlay 
               className="w-full h-full object-contain rounded outline-none" 
            />

            {/* Action Bar Toggle */}
            {!isEditing && (
                <div className="absolute top-6 right-6 bg-dark-800/90 backdrop-blur-md border border-dark-600 shadow-2xl rounded-xl p-1.5 flex items-center gap-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={() => setIsEditing(true)} className="p-2 bg-dark-700/50 hover:bg-dark-600 text-blue-400 hover:text-blue-300 rounded transition-colors flex items-center gap-2 text-sm font-bold">
                        <Scissors size={18} /> Edit & Trim
                    </button>
                </div>
            )}

            {/* Overlay Editor Panel */}
            {isEditing && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-dark-900/95 backdrop-blur-xl border border-dark-600 shadow-2xl rounded-2xl p-6 z-50 animate-in slide-in-from-bottom-8 duration-300">
                    
                    <div className="flex items-center gap-4 mb-4">
                       <button onClick={() => {
                          if (videoRef.current) {
                             if (isPlaying) videoRef.current.pause();
                             else {
                                 if (videoRef.current.currentTime >= trimEnd) videoRef.current.currentTime = trimStart;
                                 videoRef.current.play();
                             }
                             setIsPlaying(!isPlaying);
                          }
                       }} className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 transition-transform hover:scale-105 active:scale-95 shadow-lg">
                           {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
                       </button>

                       <div className="flex-1 text-sm font-mono text-gray-400 flex items-center gap-2">
                           <span className="text-gray-100 font-bold">{trimStart.toFixed(1)}s</span>
                           <span className="opacity-50">to</span>
                           <span className="text-gray-100 font-bold">{trimEnd.toFixed(1)}s</span>
                           <span className="ml-auto opacity-70">Duration: {(trimEnd - trimStart).toFixed(1)}s</span>
                       </div>

                       <button onClick={() => setIsEditing(false)} className="p-2 text-gray-400 hover:text-white rounded transition-colors absolute top-4 right-4">
                          <X size={20} />
                       </button>
                    </div>

                    {/* Timeline Scrubber */}
                    <div className="h-16 w-full relative bg-dark-950 rounded-lg border border-dark-700 select-none overflow-hidden my-6" ref={timelineRef} 
                         onMouseMove={(e) => {
                             if (!activeDragThumb || !timelineRef.current) return;
                             const rect = timelineRef.current.getBoundingClientRect();
                             const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                             const percent = x / rect.width;
                             const t = percent * duration;
                             if (activeDragThumb === 'start') setTrimStart(Math.min(t, trimEnd - 0.5));
                             if (activeDragThumb === 'end') setTrimEnd(Math.max(t, trimStart + 0.5));
                             if (videoRef.current) videoRef.current.currentTime = t;
                         }}
                         onMouseUp={() => setActiveDragThumb(null)}
                         onMouseLeave={() => setActiveDragThumb(null)}>
                        
                        {/* Filmstrip Background */}
                        {thumbnails.length === 0 ? (
                           <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                              <span className="text-xs text-blue-500 font-mono tracking-widest uppercase">Extracting Frames...</span>
                           </div>
                        ) : (
                           <div className="absolute inset-0 flex items-stretch overflow-hidden opacity-50 z-0">
                               {thumbnails.map((t, i) => <img key={i} src={t} className="flex-1 object-cover" draggable={false} />)}
                           </div>
                        )}

                        {/* Interactive Range Handles */}
                        {duration > 0 && (
                            <>
                                {/* Left Mask */}
                                <div className="absolute top-0 bottom-0 left-0 bg-black/60 z-10" style={{ width: `${(trimStart / duration) * 100}%`, pointerEvents: 'none' }} />
                                {/* Right Mask */}
                                <div className="absolute top-0 bottom-0 right-0 bg-black/60 z-10" style={{ width: `${100 - (trimEnd / duration) * 100}%`, pointerEvents: 'none' }} />
                                
                                {/* Start Thumb */}
                                <div className="absolute top-0 bottom-0 w-2 ml-[-4px] bg-blue-500 cursor-ew-resize z-20 flex items-center justify-center hover:bg-blue-400 hover:scale-x-150 transition-all shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                                     style={{ left: `${(trimStart / duration) * 100}%` }}
                                     onMouseDown={() => setActiveDragThumb('start')}>
                                     <div className="w-0.5 h-6 bg-white opacity-50 rounded-full pointer-events-none" />
                                </div>
                                
                                {/* End Thumb */}
                                <div className="absolute top-0 bottom-0 w-2 ml-[-4px] bg-blue-500 cursor-ew-resize z-20 flex items-center justify-center hover:bg-blue-400 hover:scale-x-150 transition-all shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                                     style={{ left: `${(trimEnd / duration) * 100}%` }}
                                     onMouseDown={() => setActiveDragThumb('end')}>
                                     <div className="w-0.5 h-6 bg-white opacity-50 rounded-full pointer-events-none" />
                                </div>

                                {/* Scrubber Bar */}
                                <div className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-10 pointer-events-none transition-all duration-75" style={{ left: `${(currentTime / duration) * 100}%` }} />
                            </>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-6">
                        <button onClick={() => setIsEditing(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-dark-800 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleExecuteTrim} disabled={isProcessing || thumbnails.length === 0} className="px-6 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                            {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><Save size={16} /> Save Trim</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
