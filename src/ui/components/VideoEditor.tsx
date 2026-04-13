import { useState, useEffect, useRef } from 'react';
import { Scissors, Save, X, Play, Pause, Loader2, SplitSquareHorizontal, Layers } from 'lucide-react';

interface VideoEditorProps {
    file: File;
    originalName: string;
    onSaveNewFile?: (blob: Blob, suffixName: string, options?: {overwriteOriginal?: boolean}) => Promise<void>;
}

interface Clip {
    id: string;
    start: number;
    end: number;
}

export function VideoEditor({ file, originalName, onSaveNewFile }: VideoEditorProps) {
    const [url, setUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    
    // Multi-clip state
    const [clips, setClips] = useState<Clip[]>([]);
    const [activeClipId, setActiveClipId] = useState<string>('');
    const activeClip = clips.find(c => c.id === activeClipId);
    
    // Drag state
    const [activeDragState, setActiveDragState] = useState<{ type: 'start' | 'end' | 'center', startX: number, initStart: number, initEnd: number } | null>(null);

    const [thumbnails, setThumbnails] = useState<string[]>([]);
    
    // Save Prompt Setup
    const [showSavePrompt, setShowSavePrompt] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [exportMode, setExportMode] = useState<'single' | 'all'>('single');
    const [batchNames, setBatchNames] = useState<Record<string, string>>({});
    const [batchProgress, setBatchProgress] = useState<{ current: number, total: number } | null>(null);
    
    const [splitInterval, setSplitInterval] = useState(15);

    const videoRef = useRef<HTMLVideoElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [file]);

    useEffect(() => {
        if (!isEditing) return;
        
        // Auto-pause when entering edit mode
        if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
            setIsPlaying(false);
        }

        if (thumbnails.length > 0) return;
        
        let active = true;
        const genThumbs = async () => {
            const v = document.createElement('video');
            v.src = URL.createObjectURL(file);
            v.muted = true;
            v.preload = 'metadata';
            
            await new Promise((r) => { v.onloadedmetadata = r; });
            const total = v.duration;
            setDuration(total);
            
            if (clips.length === 0) {
               const id = Math.random().toString(36).slice(2);
               setClips([{id, start: 0, end: total}]);
               setActiveClipId(id);
            }
            
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
            v.currentTime = 0;
        };
        genThumbs();
        return () => { active = false; };
    }, [isEditing, file, thumbnails.length]);

    // Handle Playback loop syncing with active clip
    useEffect(() => {
        const v = videoRef.current;
        if (!v || !isEditing || !activeClip) return;
        
        const updateTime = () => {
            setCurrentTime(v.currentTime);
            if (v.currentTime >= activeClip.end && isPlaying) {
                v.currentTime = activeClip.start;
            }
        };
        
        v.addEventListener('timeupdate', updateTime);
        return () => v.removeEventListener('timeupdate', updateTime);
    }, [isEditing, activeClip, isPlaying]);

    const updateActiveClip = (newStart: number, newEnd: number) => {
        setClips(prev => prev.map(c => c.id === activeClipId ? { ...c, start: newStart, end: newEnd } : c));
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!activeDragState || !timelineRef.current || !activeClip) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const deltaX = e.clientX - activeDragState.startX;
        const deltaT = (deltaX / rect.width) * duration;
        
        let newStart = activeDragState.initStart;
        let newEnd = activeDragState.initEnd;

        if (activeDragState.type === 'start') {
            newStart = Math.max(0, Math.min(newStart + deltaT, newEnd - 0.5));
        } else if (activeDragState.type === 'end') {
            newEnd = Math.min(duration, Math.max(newEnd + deltaT, newStart + 0.5));
        } else if (activeDragState.type === 'center') {
            const width = newEnd - newStart;
            newStart = Math.max(0, Math.min(newStart + deltaT, duration - width));
            newEnd = newStart + width;
        }

        updateActiveClip(newStart, newEnd);
        if (videoRef.current) {
            videoRef.current.currentTime = activeDragState.type === 'end' ? newEnd : newStart;
        }
    };

    const handleTimelineClick = (e: React.MouseEvent) => {
        if (!timelineRef.current || activeDragState) return; // don't seek if dragging
        const rect = timelineRef.current.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const t = percent * duration;
        
        // Find if clicked inside a clip to activate it
        const clickedClip = clips.find(c => t >= c.start && t <= c.end);
        if (clickedClip) setActiveClipId(clickedClip.id);

        if (videoRef.current) {
            videoRef.current.currentTime = t;
            setCurrentTime(t);
        }
    };

    const handleSplit = () => {
        if (!activeClip) return;
        if (currentTime <= activeClip.start + 0.5 || currentTime >= activeClip.end - 0.5) return;
        
        const newClip1 = { id: Math.random().toString(36).slice(2), start: activeClip.start, end: currentTime };
        const newClip2 = { id: Math.random().toString(36).slice(2), start: currentTime, end: activeClip.end };
        
        setClips(prev => {
            const idx = prev.findIndex(c => c.id === activeClip.id);
            const next = [...prev];
            next.splice(idx, 1, newClip1, newClip2);
            return next;
        });
        setActiveClipId(newClip2.id);
    };

    const handleAutoSplitSegments = (count: number) => {
        const seg = duration / count;
        const newClips: Clip[] = [];
        for(let i=0; i<count; i++) {
           newClips.push({ id: Math.random().toString(36).slice(2), start: i*seg, end: (i+1)*seg });
        }
        setClips(newClips);
        setActiveClipId(newClips[0].id);
    };

    const handleAutoSplitDuration = (intervalSeconds: number) => {
        const newClips: Clip[] = [];
        let cur = 0;
        while(cur < duration) {
            const end = Math.min(cur + intervalSeconds, duration);
            if (end - cur > 0.5) { // Minimum 0.5s chunks
                newClips.push({ id: Math.random().toString(36).slice(2), start: cur, end: end });
            }
            cur = end;
        }
        setClips(newClips);
        if (newClips.length > 0) setActiveClipId(newClips[0].id);
    };

    const triggerSavePrompt = () => {
        const basename = originalName.split('.').slice(0,-1).join('.') || originalName;
        // Check if multiple clips exist, maybe default name is "basename (Clip N)"
        const isMulti = clips.length > 1;
        const activeIdx = isMulti ? clips.findIndex(c => c.id === activeClipId) + 1 : null;
        
        setSaveName(`${basename}${isMulti ? ` - Clip ${activeIdx}` : ' (Trimmed)'}`);
        if (isMulti) {
            const bNames: Record<string, string> = {};
            clips.forEach((c, i) => bNames[c.id] = `${basename} - Clip ${i+1}`);
            setBatchNames(bNames);
        }
        setExportMode('single');
        setShowSavePrompt(true);
    };

    const handleExecuteTrim = async (overwrite: boolean) => {
        setIsProcessing(true);
        setShowSavePrompt(false);
        try {
            const mb = await import('mediabunny');
            
            const processClip = async (clip: Clip, targetName: string) => {
                const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
                const outputTARGET = new mb.BufferTarget();
                const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: outputTARGET });
                
                const conversion = await mb.Conversion.init({ 
                    input, 
                    output,
                    trim: { start: clip.start, end: clip.end }
                });
                await conversion.execute();
                
                if (!outputTARGET.buffer) throw new Error("Processing failed: output buffer is null");
                if (onSaveNewFile) {
                    const blob = new Blob([outputTARGET.buffer], { type: 'video/mp4' });
                    await onSaveNewFile(blob, targetName, { overwriteOriginal: overwrite });
                }
            };

            if (exportMode === 'single') {
                if (!activeClip) return;
                await processClip(activeClip, overwrite ? originalName : `${saveName}.mp4`);
            } else {
                for (let i = 0; i < clips.length; i++) {
                    setBatchProgress({ current: i + 1, total: clips.length });
                    await processClip(clips[i], `${batchNames[clips[i].id]}.mp4`);
                }
            }
            
            if (overwrite) setIsEditing(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
            setBatchProgress(null);
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

            {!isEditing && (
                <div className="absolute top-6 right-6 bg-dark-800/90 backdrop-blur-md border border-dark-600 shadow-2xl rounded-xl p-1.5 flex items-center gap-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={() => setIsEditing(true)} className="p-2 bg-dark-700/50 hover:bg-dark-600 text-blue-400 hover:text-blue-300 rounded transition-colors flex items-center gap-2 text-sm font-bold">
                        <Scissors size={18} /> Edit & Trim
                    </button>
                </div>
            )}

            {isEditing && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl bg-dark-900/95 backdrop-blur-xl border border-dark-600 shadow-2xl rounded-2xl p-6 z-50 animate-in slide-in-from-bottom-8 duration-300">
                    
                    <div className="flex items-center gap-4 mb-4">
                       <button onClick={() => {
                          if (videoRef.current) {
                             if (isPlaying) videoRef.current.pause();
                             else {
                                 if (activeClip && videoRef.current.currentTime >= activeClip.end) videoRef.current.currentTime = activeClip.start;
                                 videoRef.current.play();
                             }
                             setIsPlaying(!isPlaying);
                          }
                       }} className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 transition-transform hover:scale-105 active:scale-95 shadow-lg flex-shrink-0">
                           {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
                       </button>

                           {/* Action Toolset */}
                           <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-dark-950 rounded-xl border border-dark-700 mx-2 overflow-x-auto no-scrollbar">
                               <button onClick={handleSplit} title="Split at playhead" className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg text-xs font-bold transition-colors whitespace-nowrap">
                                   <SplitSquareHorizontal size={14} className="text-blue-400"/> Split
                               </button>
                               <div className="w-px h-4 bg-dark-700 mx-2" />
                               <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">Auto-Split:</span>
                               <button onClick={() => handleAutoSplitSegments(10)} className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg text-xs font-bold transition-colors whitespace-nowrap">
                                   <SplitSquareHorizontal size={14}/> 10 Segments
                               </button>
                               
                               <div className="flex items-center bg-dark-800 rounded-lg pr-1 hover:bg-dark-700 transition-colors">
                                   <button onClick={() => handleAutoSplitDuration(splitInterval)} className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:text-white transition-colors text-xs font-bold whitespace-nowrap">
                                       <Layers size={14}/> Split Every
                                   </button>
                                   <div className="relative flex items-center">
                                        <input type="number" min="1" max="3600" value={splitInterval} onChange={e => setSplitInterval(Number(e.target.value) || 0)} className="w-12 bg-slate-900 border border-slate-700 rounded text-center text-xs text-white py-1 outline-none appearance-none" />
                                        <select value={splitInterval} onChange={e => setSplitInterval(Number(e.target.value))} className="absolute right-0 opacity-0 w-full cursor-pointer h-full">
                                            <option value={10}>10s</option>
                                            <option value={15}>15s</option>
                                            <option value={30}>30s</option>
                                            <option value={60}>1m</option>
                                            <option value={90}>90s</option>
                                            <option value={120}>2m</option>
                                        </select>
                                   </div>
                                   <span className="text-xs font-bold text-gray-500 pl-1 pr-2">sec</span>
                               </div>
                           </div>

                       {activeClip && (
                           <div className="text-xs font-mono text-gray-400 flex flex-col items-end gap-1 flex-shrink-0">
                               <span>{activeClip.start.toFixed(1)}s <span className="opacity-50 mx-1">to</span> {activeClip.end.toFixed(1)}s</span>
                               <span className="text-blue-400 font-bold">{(activeClip.end - activeClip.start).toFixed(1)}s Length</span>
                           </div>
                       )}

                       <button onClick={() => setIsEditing(false)} className="p-2 text-gray-400 hover:text-white rounded transition-colors absolute top-4 right-4 bg-dark-950 border border-dark-700 hover:bg-dark-800 z-10">
                          <X size={16} />
                       </button>
                    </div>

                    {/* Timeline Scrubber */}
                    <div className="h-20 w-full relative bg-dark-950 rounded-lg border border-dark-700 select-none overflow-hidden my-4 group/timeline" 
                         ref={timelineRef} 
                         onMouseMove={handleMouseMove}
                         onMouseUp={() => setActiveDragState(null)}
                         onMouseLeave={() => setActiveDragState(null)}
                         onClick={handleTimelineClick}>
                        
                        {/* Filmstrip Background */}
                        {thumbnails.length === 0 ? (
                           <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                              <span className="text-xs text-blue-500 font-mono tracking-widest uppercase">Extracting Frames...</span>
                           </div>
                        ) : (
                           <div className="absolute inset-0 flex items-stretch overflow-hidden opacity-50 z-0">
                               {thumbnails.map((t, i) => <img key={i} src={t} className="flex-1 object-cover pointer-events-none" draggable={false} />)}
                           </div>
                        )}

                        {/* Interactive Clips */}
                        {duration > 0 && clips.map((clip, i) => {
                            const isActive = clip.id === activeClipId;
                            // Sort so active renders on top of adjacent clip borders
                            return (
                                <div key={clip.id} className="absolute top-0 bottom-0" style={{ left: `${(clip.start/duration)*100}%`, width: `${((clip.end - clip.start)/duration)*100}%`, zIndex: isActive ? 25 : 20 }}>
                                    
                                    {/* Clip Body (Draggable & Explicitly Outlined) */}
                                    <div className={`absolute inset-0 transition-colors border-r-2 border-l-2 border-black flex items-center justify-center overflow-hidden ${isActive ? 'bg-blue-500/30 border-blue-500/90 border-t-2 border-b-2 cursor-grab active:cursor-grabbing backdrop-blur-[1px]' : 'bg-black/30 hover:bg-black/50 cursor-pointer'}`}
                                         onMouseDown={(e) => {
                                            if (isActive) setActiveDragState({ type: 'center', startX: e.clientX, initStart: clip.start, initEnd: clip.end });
                                            else setActiveClipId(clip.id);
                                         }}
                                    >
                                         {!isActive && clips.length > 1 && <span className="text-[10px] font-black text-white/50 select-none pointer-events-none drop-shadow-md">CLIP {i+1}</span>}
                                    </div>
                                    
                                    {/* Start Handle - Global */}
                                    <div className={`absolute top-0 bottom-0 left-0 w-3 ml-[-6px] hover:bg-blue-400 cursor-ew-resize flex items-center justify-center z-30 transform hover:scale-x-125 transition-all ${isActive ? 'bg-blue-500/90 shadow-[0_0_15px_rgba(59,130,246,1)]' : 'bg-white/20 hover:bg-blue-500/50'}`}
                                         onMouseDown={(e) => { e.stopPropagation(); setActiveClipId(clip.id); setActiveDragState({ type: 'start', startX: e.clientX, initStart: clip.start, initEnd: clip.end }); }}>
                                         <div className={`w-0.5 h-4 bg-white rounded-full ${isActive ? 'opacity-80' : 'opacity-40'}`} />
                                    </div>

                                    {/* End Handle - Global */}
                                    <div className={`absolute top-0 bottom-0 right-0 w-3 mr-[-6px] hover:bg-blue-400 cursor-ew-resize flex items-center justify-center z-30 transform hover:scale-x-125 transition-all ${isActive ? 'bg-blue-500/90 shadow-[0_0_15px_rgba(59,130,246,1)]' : 'bg-white/20 hover:bg-blue-500/50'}`}
                                         onMouseDown={(e) => { e.stopPropagation(); setActiveClipId(clip.id); setActiveDragState({ type: 'end', startX: e.clientX, initStart: clip.start, initEnd: clip.end }); }}>
                                         <div className={`w-0.5 h-4 bg-white rounded-full ${isActive ? 'opacity-80' : 'opacity-40'}`} />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Playhead Scrubber */}
                        {duration > 0 && (
                           <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-40 pointer-events-none transition-all duration-75 shadow-[0_0_10px_rgba(239,68,68,1)] flex flex-col items-center" style={{ left: `${(currentTime / duration) * 100}%` }}>
                              <div className="w-3 h-3 bg-red-500 rounded-full mt-[-4px]" />
                           </div>
                        )}
                        
                        {/* Visual Timeline Ticks */}
                        <div className="absolute bottom-0 left-0 right-0 h-4 border-t border-white/10 flex items-end justify-between px-1 pointer-events-none z-10 opacity-40">
                             {[...Array(20)].map((_, i) => <div key={i} className="w-[1px] h-2 bg-white/30" />)}
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-4 border-t border-dark-700/50">
                        <span className="text-sm font-bold text-gray-500">{clips.length} Clip{clips.length !== 1 && 's'} Found</span>
                        
                        <div className="flex items-center gap-3">
                            <button onClick={() => setIsEditing(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-dark-800 transition-colors">
                                Cancel
                            </button>
                            <button onClick={triggerSavePrompt} disabled={isProcessing || thumbnails.length === 0 || !activeClip} className="px-6 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                                {isProcessing ? <><Loader2 size={16} className="animate-spin" /> {batchProgress ? `Processing ${batchProgress.current} / ${batchProgress.total}` : 'Transcoding...'}</> : <><Save size={16} /> Export {clips.length > 1 ? 'Clips...' : 'Clip'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Prompt Modal */}
            {showSavePrompt && (
                <div className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-dark-900 border border-dark-700 p-6 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">{exportMode === 'all' ? `Export All ${clips.length} Clips` : 'Export Active Clip'}</h3>
                        
                        {clips.length > 1 && (
                            <div className="flex items-center gap-2 mb-6 bg-dark-950 rounded-lg p-1">
                                <button onClick={() => setExportMode('single')} className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-colors ${exportMode === 'single' ? 'bg-dark-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>Current Clip Only</button>
                                <button onClick={() => setExportMode('all')} className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-colors ${exportMode === 'all' ? 'bg-dark-800 text-blue-400 shadow' : 'text-gray-500 hover:text-gray-300'}`}>All {clips.length} Clips</button>
                            </div>
                        )}

                        {exportMode === 'single' ? (
                            <div className="space-y-4">
                                <div className="bg-dark-800/50 border border-dark-700 p-4 rounded-xl">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Save as New File</label>
                                    <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors" />
                                    <button onClick={() => handleExecuteTrim(false)} className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg transition-colors">Save Copy</button>
                                </div>
                                <div className="relative">
                                   <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dark-700"></div></div>
                                   <div className="relative flex justify-center"><span className="bg-dark-900 px-3 text-xs text-gray-500 font-bold uppercase">OR</span></div>
                                </div>
                                <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl">
                                   <p className="text-xs text-red-400 mb-3"><strong className="text-red-300">Warning:</strong> This will destructively overwrite `{originalName}`.</p>
                                   <button onClick={() => handleExecuteTrim(true)} className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 font-bold text-sm rounded-lg transition-colors">Replace Original File</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 no-scrollbar">
                                    {clips.map((clip, i) => (
                                        <div key={clip.id} className="flex flex-col gap-1">
                                            <label className="text-[10px] text-gray-500 font-bold ml-1">CLIP {i+1} ({clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s)</label>
                                            <input type="text" value={batchNames[clip.id] || ''} onChange={e => setBatchNames(prev => ({...prev, [clip.id]: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => handleExecuteTrim(false)} className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg transition-colors shadow-lg shadow-blue-900/20">Save {clips.length} Files</button>
                            </div>
                        )}

                        <button onClick={() => setShowSavePrompt(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={20}/></button>
                    </div>
                </div>
            )}
        </div>
    );
}
