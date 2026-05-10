import { GridItem } from '../../core/models/FilePair';

export type TypeFilter = 'all' | 'images' | 'video' | 'audio' | 'documents' | 'other';

interface TypeFilterCounts {
  all: number;
  images: number;
  video: number;
  audio: number;
  documents: number;
  other: number;
}

interface TypeFiltersProps {
  items: GridItem[];
  active: TypeFilter;
  onChange: (f: TypeFilter) => void;
}

const IMAGE_RE  = /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i;
const VIDEO_RE  = /\.(mp4|webm|mov|avi|mkv)$/i;
const AUDIO_RE  = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
const DOC_RE    = /\.(txt|json|md|pdf|html|csv|xml|yaml|yml)$/i;

export function getTypeFilter(filename: string): TypeFilter {
  if (IMAGE_RE.test(filename)) return 'images';
  if (VIDEO_RE.test(filename)) return 'video';
  if (AUDIO_RE.test(filename)) return 'audio';
  if (DOC_RE.test(filename))   return 'documents';
  return 'other';
}

export function TypeFilters({ items, active, onChange }: TypeFiltersProps) {
  const counts: TypeFilterCounts = { all: 0, images: 0, video: 0, audio: 0, documents: 0, other: 0 };

  for (const item of items) {
    if (item.type !== 'file') continue;
    counts.all++;
    const cat = getTypeFilter(item.pair.id);
    counts[cat]++;
  }

  const buttons: { key: TypeFilter; label: string }[] = [
    { key: 'all',       label: 'All'       },
    { key: 'images',    label: 'Images'    },
    { key: 'video',     label: 'Video'     },
    { key: 'audio',     label: 'Audio'     },
    { key: 'documents', label: 'Docs'      },
    { key: 'other',     label: 'Other'     },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {buttons.map(({ key, label }) => {
        const count = counts[key];
        if (key !== 'all' && count === 0) return null;
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            {label}
            <span className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
