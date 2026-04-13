import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import ReactMarkdown from 'react-markdown';
import { GridItem } from '../../core/models/FilePair';
import { FileIcon } from 'lucide-react';

function JsonNode({ nodeKey, value, isLast }: { nodeKey?: string, value: any, isLast: boolean }) {
   const [expanded, setExpanded] = useState(true);
   const isObject = value !== null && typeof value === 'object';
   const isArray = Array.isArray(value);

   if (!isObject) {
       const typeColor = typeof value === 'string' ? 'text-green-400' : typeof value === 'number' ? 'text-orange-400' : typeof value === 'boolean' ? 'text-purple-400' : 'text-gray-500';
       const displayVal = typeof value === 'string' ? `"${value}"` : String(value);
       return (
           <div className="pl-6 font-mono text-xs md:text-sm whitespace-pre-wrap leading-relaxed">
               {nodeKey && <span className="text-gray-300 font-semibold">"{nodeKey}": </span>}
               <span className={typeColor}>{displayVal}</span>{!isLast && <span className="text-gray-500">,</span>}
           </div>
       );
   }

   const isEmpty = Object.keys(value).length === 0;
   const openBracket = isArray ? '[' : '{';
   const closeBracket = isArray ? ']' : '}';

   return (
       <div className="pl-6 font-mono text-xs md:text-sm relative leading-relaxed">
          <div 
             className={`flex items-center -ml-5 pl-1 rounded transition-colors ${!isEmpty ? 'cursor-pointer hover:bg-dark-700/50' : ''}`}
             onClick={(e) => { e.stopPropagation(); if (!isEmpty) setExpanded(!expanded); }}
          >
             {!isEmpty && (
                 <span className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 text-[10px] mr-1 absolute left-1">
                    {expanded ? '▼' : '▶'}
                 </span>
             )}
             {nodeKey && <span className="text-gray-300 font-semibold">"{nodeKey}": </span>}
             <span className="text-gray-500">{openBracket}</span>
             {!expanded && !isEmpty && <span className="text-gray-500 text-xs px-2 italic">... {Object.keys(value).length} items ...</span>}
             {(!expanded || isEmpty) && <span><span className="text-gray-500">{closeBracket}</span>{!isLast && <span className="text-gray-500">,</span>}</span>}
          </div>
          {expanded && !isEmpty && (
             <div className="border-l border-dark-700/80 ml-[6px] relative">
                 {Object.entries(value).map(([k, v], i, arr) => (
                    <JsonNode key={k} nodeKey={isArray ? undefined : k} value={v} isLast={i === arr.length - 1} />
                 ))}
             </div>
          )}
          {expanded && !isEmpty && (
             <div className="text-gray-500 relative -left-[14px]">
                 {closeBracket}{!isLast && <span className="text-gray-500">,</span>}
             </div>
          )}
       </div>
   );
}

function ZipViewer({ file }: { file: File }) {
    const [files, setFiles] = useState<string[]>([]);
    useEffect(() => {
        let isActive = true;
        const load = async () => {
            const zip = new JSZip();
            try {
                const loaded = await zip.loadAsync(file);
                if (isActive) setFiles(Object.keys(loaded.files));
            } catch(e) {}
        };
        load();
        return () => { isActive = false; }
    }, [file]);

    return (
        <div className="w-full h-full overflow-y-auto p-6 bg-dark-900 border border-dark-700 shadow-inner rounded-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-dark-700">
               <FileIcon className="text-orange-500" size={24} />
               <h3 className="text-gray-200 font-bold font-mono tracking-wider">Archive Contents</h3>
            </div>
            <ul className="space-y-1">
                {files.map(f => (
                    <li key={f} className="text-blue-300 font-mono text-sm leading-relaxed hover:text-blue-200 transition-colors bg-dark-800/40 hover:bg-dark-800 px-3 py-1.5 rounded truncate">
                        {f}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function MediaViewer({ file, type }: { file: File, type: 'image' | 'video' | 'pdf' }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [file]);

    if (!url) return null;

    return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden p-2">
            {type === 'image' && <img src={url} className="w-full h-full object-contain filter drop-shadow-2xl rounded" />}
            {type === 'video' && <video src={url} controls autoPlay className="w-full h-full object-contain rounded shadow-2xl outline-none" />}
            {type === 'pdf' && <object data={url} type="application/pdf" className="w-full h-full rounded shadow-2xl bg-white"></object>}
        </div>
    );
}

function CodeViewer({ text, item }: { text: string | null, item: GridItem }) {
    if (text === null) return <div className="text-gray-400 p-8">Parsing Markup stream...</div>;
    return (
        <div className="w-full h-full overflow-hidden p-0 bg-dark-950 text-gray-300 border border-dark-700 shadow-inner rounded-xl flex flex-col">
            <div className="px-4 py-3 bg-dark-900 border-b border-dark-700 flex items-center justify-between shadow-sm shrink-0">
               <span className="font-mono text-[10px] uppercase font-bold text-gray-500 tracking-widest">Source String</span>
               <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">{item.pair.id}</span>
            </div>
            <div className="flex-1 overflow-auto p-4 shrink-0 h-0 min-h-0 relative select-text">
                <pre className="font-mono text-[13px] leading-relaxed text-gray-300 w-max min-w-full"><code className="block w-full whitespace-pre-wrap">{text}</code></pre>
            </div>
        </div>
    );
}

function HtmlViewer({ text, item }: { text: string | null, item: GridItem }) {
    if (text === null) return <div className="text-gray-400 p-8">Parsing Markup stream...</div>;
    return (
        <div className="w-full h-full overflow-hidden bg-dark-950 border border-dark-700 shadow-inner rounded-xl flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-dark-700">
            <div className="flex-1 overflow-auto p-4 flex flex-col relative h-full">
               <span className="absolute top-2 right-4 font-mono text-[10px] font-bold text-gray-500 bg-dark-900 border border-dark-700 shadow-sm px-2 py-0.5 rounded z-10 pointer-events-none tracking-widest uppercase">Dom Root</span>
               <pre className="font-mono text-[13px] leading-relaxed text-gray-300 min-w-full block pt-6"><code className="block w-full">{text}</code></pre>
            </div>
            <div className="flex-1 h-full bg-white relative flex flex-col overflow-hidden">
               <span className="absolute top-2 right-4 font-mono text-[10px] font-bold shadow bg-gray-100 border border-gray-300 text-gray-500 px-2 py-0.5 rounded z-10 pointer-events-none tracking-widest uppercase">Sandbox Frame</span>
               <iframe className="w-full h-full border-none flex-1 mt-0 bg-white" srcDoc={text} sandbox="allow-scripts allow-same-origin" />
            </div>
        </div>
    );
}

export function FileViewer({ item, forceText }: { item: GridItem, forceText?: boolean }) {
   const [fileObj, setFileObj] = useState<File | null>(null);
   const [textData, setTextData] = useState<string | null>(null);
   const [error, setError] = useState(false);

   useEffect(() => {
       if (item.type !== 'file') return;
       let isActive = true;
       setFileObj(null); setTextData(null); setError(false);

       item.pair.mainHandle.getFile().then(async f => {
           if (!isActive) return;
           setFileObj(f);
           const ext = item.pair.id.split('.').pop()?.toLowerCase();
           const isTextPath = ['json', 'md', 'markdown', 'txt', 'js', 'ts', 'tsx', 'jsx', 'sh', 'css', 'html', 'csv'].includes(ext || '');

           if (forceText || isTextPath) {
               try {
                  const buffer = await f.arrayBuffer();
                  let text = '';
                  const LIMIT = 500 * 1024; // 500 KB ceiling
                  if (buffer.byteLength > LIMIT) {
                     text = new TextDecoder().decode(buffer.slice(0, LIMIT)) + '\n\n... [TRUNCATED - EXCEEDS 500KB RENDERER SAFETY LIMIT] ...';
                  } else {
                     text = new TextDecoder().decode(buffer);
                  }
                  if (isActive) setTextData(text);
               } catch(ex) {
                  if (isActive) setError(true);
               }
           }
       }).catch(() => {
           if (isActive) setError(true);
       });

       return () => { isActive = false; }
   }, [item, forceText]);

   if (item.type !== 'file') return null;

   const ext = item.pair.id.split('.').pop()?.toLowerCase() || '';

   if (error) return <div className="text-red-400 flex items-center gap-2 m-auto p-4 bg-red-900/20 border border-red-500/50 rounded-xl"><FileIcon size={20} /> Access Error Processing Stream</div>;
   if (!fileObj) return (
       <div className="flex flex-col items-center justify-center m-auto opacity-50 space-y-4">
           <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
       </div>
   );

   if (forceText) return <CodeViewer text={textData} item={item} />;

   const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
   const isVideo = ['mp4', 'webm', 'mov', 'ogg'].includes(ext);
   const isPDF = ['pdf'].includes(ext);
   const isZip = ['zip'].includes(ext);
   const isJson = ['json'].includes(ext);
   const isMd = ['md', 'markdown'].includes(ext);
   const isCode = ['js', 'ts', 'tsx', 'jsx', 'sh', 'css', 'csv', 'txt'].includes(ext);
   const isHtml = ['html', 'htm'].includes(ext);

   if (isImage) return <MediaViewer file={fileObj} type="image" />;
   if (isVideo) return <MediaViewer file={fileObj} type="video" />;
   if (isPDF) return <MediaViewer file={fileObj} type="pdf" />;
   if (isZip) return <ZipViewer file={fileObj} />;
   if (isCode) return <CodeViewer text={textData} item={item} />;
   if (isHtml) return <HtmlViewer text={textData} item={item} />;

   if (isJson) {
       if (textData === null) return <div className="text-gray-400 p-8">Parsing JSON stream...</div>;
       try {
           const obj = JSON.parse(textData);
           return (
               <div className="w-full h-full overflow-y-auto p-4 md:p-8 bg-dark-950 text-gray-200 border border-dark-700 shadow-inner rounded-xl overflow-x-auto text-left relative">
                   <div className="absolute top-2 right-4 text-xs font-bold text-gray-600 pointer-events-none z-10 font-mono tracking-widest uppercase">wutility-native-port</div>
                   <JsonNode value={obj} isLast={true} />
               </div>
           );
       } catch (e) {
           return <div className="text-red-400 bg-red-900/20 p-4 font-mono border border-red-500/50 rounded-xl my-auto">Malformed JSON payload string.</div>;
       }
   }

   if (isMd) {
       if (textData === null) return <div className="text-gray-400 p-8">Parsing Markup stream...</div>;
       return (
           <div className="w-full h-full overflow-y-auto p-6 md:p-10 bg-dark-900 text-gray-300 border border-dark-700 shadow-inner rounded-xl max-w-none text-left">
               <ReactMarkdown
                  components={{
                     h1: ({node, ...props}) => <h1 className="text-3xl font-bold tracking-tight text-white mt-8 mb-4 pb-2 border-b border-dark-700" {...props} />,
                     h2: ({node, ...props}) => <h2 className="text-2xl font-bold tracking-tight text-white mt-8 mb-4 border-b border-dark-700 pb-2" {...props} />,
                     h3: ({node, ...props}) => <h3 className="text-xl font-bold text-gray-100 mt-6 mb-3" {...props} />,
                     h4: ({node, ...props}) => <h4 className="text-lg font-bold text-gray-200 mt-4 mb-2" {...props} />,
                     p: ({node, ...props}) => <p className="leading-relaxed mb-4 text-gray-300" {...props} />,
                     ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-300" {...props} />,
                     ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-gray-300" {...props} />,
                     li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                     strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                     a: ({node, ...props}) => <a className="text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-500/30" target="_blank" {...props} />,
                     blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-dark-600 pl-4 py-1 italic text-gray-400 bg-dark-800/50 rounded-r-lg my-4" {...props} />,
                     code: ({node, ...props}) => {
                         const match = /inline/.test(props.className || '') || !props.children?.toString().includes('\n');
                         return match ? (
                             <code className="bg-dark-800 border border-dark-600 px-1.5 py-0.5 rounded-md font-mono text-[13px] text-blue-300 mx-0.5" {...props} />
                         ) : (
                             <pre className="bg-dark-950 border border-dark-700 p-4 rounded-xl overflow-x-auto text-[13px] font-mono my-6 shadow-inner text-gray-300">
                                 <code {...props} />
                             </pre>
                         );
                     }
                  }}
               >
                   {textData}
               </ReactMarkdown>
           </div>
       );
   }

   return (
       <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-300 opacity-60 m-auto">
           <FileIcon size={128} className="text-gray-500 pointer-events-none" />
           <h2 className="text-xl font-bold font-mono tracking-tight max-w-[80vw] truncate text-white">{item.pair.id}</h2>
           <span className="text-sm bg-dark-700 text-gray-300 px-3 py-1 rounded-full border border-dark-600">Preview format not supported natively.</span>
       </div>
   );
}
