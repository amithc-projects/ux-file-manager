import { useTranslation } from 'react-i18next';
import { GridItem } from '../../core/models/FilePair';

export type TypeFilter = 'images' | 'video' | 'audio' | 'documents' | 'other';

interface TypeFilterCounts {
  images: number;
  video: number;
  audio: number;
  documents: number;
  other: number;
}

interface TypeFiltersProps {
  items: GridItem[];
  /**
   * Set of currently-active type filters. Empty set means "no filter" (show all).
   * In recipe mode, non-empty set is required — clearing all chips hides everything.
   */
  active: Set<TypeFilter>;
  onChange: (next: Set<TypeFilter>) => void;
  /**
   * When provided, restricts the visible chips to these types and switches the
   * filter to multi-select mode (each chip toggles independently). Chips with
   * a count of 0 are still rendered (in muted style) so the user can see what
   * the recipe would accept.
   */
  allowedTypes?: TypeFilter[] | null;
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

const LABEL_KEYS: Record<TypeFilter, string> = {
  images: 'typeFilters.images',
  video: 'typeFilters.video',
  audio: 'typeFilters.audio',
  documents: 'typeFilters.documents',
  other: 'typeFilters.other',
};

const ALL_TYPES: TypeFilter[] = ['images', 'video', 'audio', 'documents', 'other'];

export function TypeFilters({ items, active, onChange, allowedTypes }: TypeFiltersProps) {
  const { t } = useTranslation();
  const LABELS: Record<TypeFilter, string> = {
    images: t(LABEL_KEYS.images),
    video: t(LABEL_KEYS.video),
    audio: t(LABEL_KEYS.audio),
    documents: t(LABEL_KEYS.documents),
    other: t(LABEL_KEYS.other),
  };
  const counts: TypeFilterCounts = { images: 0, video: 0, audio: 0, documents: 0, other: 0 };
  for (const item of items) {
    if (item.type !== 'file') continue;
    counts[getTypeFilter(item.pair.id)]++;
  }

  const recipeMode = !!(allowedTypes && allowedTypes.length);
  const visibleTypes: TypeFilter[] = recipeMode ? allowedTypes! : ALL_TYPES;

  // Recipe mode: per-type toggle. Legacy mode: single-select (with "All" chip).
  const toggle = (key: TypeFilter) => {
    if (recipeMode) {
      const next = new Set(active);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange(next);
    } else {
      // Single-select: clicking active chip clears; otherwise sets to {key}.
      if (active.has(key) && active.size === 1) onChange(new Set());
      else onChange(new Set([key]));
    }
  };

  const allCount = items.filter(i => i.type === 'file').length;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* "All" chip only in legacy (non-recipe) mode */}
      {!recipeMode && (
        <button
          onClick={() => onChange(new Set())}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
            active.size === 0
              ? 'bg-blue-600 text-white'
              : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
          }`}
        >
          {t('typeFilters.all')}
          <span className={`text-[10px] ${active.size === 0 ? 'text-blue-200' : 'text-gray-500'}`}>{allCount}</span>
        </button>
      )}

      {visibleTypes.map(key => {
        const count = counts[key];
        // Legacy mode: hide empty chips. Recipe mode: always show (muted if 0).
        if (!recipeMode && count === 0) return null;
        const isActive = active.has(key);
        const isEmpty = count === 0;
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? isEmpty
                  ? 'bg-blue-900/60 text-blue-200 ring-1 ring-blue-700/60'
                  : 'bg-blue-600 text-white'
                : isEmpty
                  ? 'bg-dark-800 text-gray-600 hover:bg-dark-700'
                  : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
            }`}
            title={isEmpty ? t('typeFilters.noMatching', { label: LABELS[key] }) : undefined}
          >
            {LABELS[key]}
            <span className={`text-[10px] ${isActive ? (isEmpty ? 'text-blue-300/70' : 'text-blue-200') : 'text-gray-500'}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
