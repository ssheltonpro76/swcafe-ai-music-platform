import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BrowserItem,
  BrowserItemType,
  BROWSER_UPDATED_EVENT,
  buildBrowserItems,
  filterItems,
  findSimilar,
  SimilarResult,
  loadCollections,
  BrowserCollection,
  createCollection,
  deleteCollection,
  addItemToCollection,
  removeItemFromCollection,
  registerUploadedSound,
  addUserTag,
} from './unifiedBrowser';

/**
 * SwCafe Unified Browser (Section 10) — one searchable panel over every
 * SwCafe content type: songs, loops, one-shots, uploads, stem plans,
 * Studio effect presets, and Lyricist voices.
 *
 * Honest limits shown in the UI:
 *  - Upload BPM/key/tags are estimated on-device (Web Audio analysis),
 *    not full music-understanding classification.
 *  - "More like this" is tag + BPM/key similarity, not audio embeddings.
 *  - Stem records are plans only — no separation engine is connected.
 *  - No third-party catalog is shown: licensed catalogs need a
 *    licensing/partnership decision first (10.5, deferred).
 */

interface UnifiedBrowserViewProps {
  onPlay?: (title: string, artist: string, cover: string, audioUrl?: string) => void;
  onNavigate?: (tab: string) => void;
}

const TYPE_FILTERS: { id: BrowserItemType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🗂️' },
  { id: 'song', label: 'Songs', icon: '🎵' },
  { id: 'loop', label: 'Loops', icon: '🔁' },
  { id: 'one-shot', label: 'One-shots', icon: '🥁' },
  { id: 'upload', label: 'Uploads', icon: '📁' },
  { id: 'stem', label: 'Stems', icon: '🎚️' },
  { id: 'preset', label: 'Presets', icon: '🎛️' },
  { id: 'lyricist', label: 'Lyricists', icon: '✍️' },
];

const TYPE_ICON: Record<BrowserItemType, string> = {
  song: '🎵',
  loop: '🔁',
  'one-shot': '🥁',
  upload: '📁',
  stem: '🎚️',
  preset: '🎛️',
  lyricist: '✍️',
};

const UnifiedBrowserView: React.FC<UnifiedBrowserViewProps> = ({ onPlay, onNavigate }) => {
  const [items, setItems] = useState<BrowserItem[]>([]);
  const [collections, setCollections] = useState<BrowserCollection[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<BrowserItemType | 'all'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [similarTo, setSimilarTo] = useState<BrowserItem | null>(null);
  const [similarResults, setSimilarResults] = useState<SimilarResult[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [openCollectionId, setOpenCollectionId] = useState<string | null>(null);
  const [uploadCollectionId, setUploadCollectionId] = useState('');
  const [tagEditorId, setTagEditorId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    setItems(buildBrowserItems());
    setCollections(loadCollections());
  };

  useEffect(() => {
    reload();
    const onLib = () => reload();
    window.addEventListener('swcafe_library_updated', onLib);
    window.addEventListener(BROWSER_UPDATED_EVENT, onLib);
    return () => {
      window.removeEventListener('swcafe_library_updated', onLib);
      window.removeEventListener(BROWSER_UPDATED_EVENT, onLib);
    };
  }, []);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const seen: Set<string> = new Set();
      for (const t of item.tags) {
        if (seen.has(t)) continue;
        seen.add(t);
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    const entries: [string, number][] = [];
    counts.forEach((count, tag) => entries.push([tag, count]));
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [items]);

  const filtered = useMemo(
    () => filterItems(items, query, typeFilter, selectedTags),
    [items, query, typeFilter, selectedTags]
  );

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const showSimilar = (item: BrowserItem) => {
    setSimilarTo(item);
    setSimilarResults(findSimilar(item, items, 5));
  };

  const handleCreateCollection = () => {
    const col = createCollection(newCollectionName);
    if (col) {
      setNewCollectionName('');
      setOpenCollectionId(col.id);
      setStatus(`Collection "${col.name}" created.`);
    } else {
      setStatus('Give the collection a name first.');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsAnalyzing(true);
    setStatus(`Analyzing "${file.name}" on this device — estimating BPM, key and tags…`);
    try {
      const rec = await registerUploadedSound(file, undefined, true);
      if (!rec) {
        setStatus('Could not save that upload. Try a smaller audio file.');
        return;
      }
      const targetCol = uploadCollectionId || null;
      if (targetCol) addItemToCollection(targetCol, `upload:${rec.id}`);
      const bpmNote = rec.bpm ? ` ~${rec.bpm} BPM (estimated)` : '';
      const keyNote = rec.key ? `, key ${rec.key} (estimated)` : '';
      setStatus(
        `"${rec.name}" added to the Browser${bpmNote}${keyNote}` +
          (rec.audioDataUrl ? '' : ' — too large to keep in this browser, so it plays this session only; re-upload to play it later.') +
          (targetCol ? ' Added to its collection.' : '')
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const playItem = (item: BrowserItem) => {
    if (!item.audioUrl || !onPlay) return;
    onPlay(item.title, item.subtitle, `https://picsum.photos/seed/${encodeURIComponent(item.id)}/200/200`, item.audioUrl);
  };

  const openItemTarget = (item: BrowserItem) => {
    if (item.type === 'preset' && onNavigate) onNavigate('studio');
    else if (item.type === 'lyricist' && onNavigate) onNavigate('lyrics-studio');
    else if (item.type === 'stem' && onNavigate) onNavigate('stem-splitter');
    else if ((item.type === 'song' || item.type === 'loop' || item.type === 'one-shot') && onNavigate) onNavigate('library');
  };

  const renderItemCard = (item: BrowserItem, similar?: SimilarResult) => (
    <div
      key={item.id}
      className="bg-[#1a1a1e] border border-white/5 rounded-3xl p-5 space-y-3 hover:border-orange-500/40 transition-all"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{TYPE_ICON[item.type]}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
          <p className="text-[11px] text-zinc-400 truncate">{item.subtitle}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{item.type}</p>
        </div>
        {item.audioUrl && onPlay && (
          <button
            onClick={() => playItem(item)}
            className="w-9 h-9 shrink-0 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
            title="Play"
          >
            ▶
          </button>
        )}
      </div>

      {item.description && (
        <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{item.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        {item.bpm !== undefined && (
          <span className="text-[9px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
            {item.bpm} BPM{item.bpmEstimated ? ' · est.' : ''}
          </span>
        )}
        {item.key && (
          <span className="text-[9px] font-bold bg-white/5 text-zinc-300 border border-white/10 px-2 py-0.5 rounded-full">
            {item.key}
            {item.keyEstimated ? ' · est.' : ''}
          </span>
        )}
        {item.durationSec !== undefined && (
          <span className="text-[9px] font-bold bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5 rounded-full">
            {item.durationSec < 60
              ? `${item.durationSec.toFixed(1)}s`
              : `${Math.floor(item.durationSec / 60)}:${Math.floor(item.durationSec % 60).toString().padStart(2, '0')}`}
          </span>
        )}
        {item.type === 'song' && !item.audioUrl && (
          <span className="text-[9px] font-bold bg-white/5 text-zinc-400 border border-white/10 px-2 py-0.5 rounded-full">
            Lyrics only — no audio
          </span>
        )}
        {item.audioSessionOnly && (
          <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Session only — re-upload to keep
          </span>
        )}
        {item.type === 'stem' && (
          <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Plan only — no stem audio yet
          </span>
        )}
      </div>

      {similar && (
        <p className="text-[11px] text-orange-300 leading-relaxed">
          Why similar: {similar.reasons.join(' · ')}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {item.tags.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            title={selectedTags.includes(tag) ? 'Remove tag filter' : 'Filter by this tag'}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all ${
              selectedTags.includes(tag)
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
            }`}
          >
            #{tag}
          </button>
        ))}
        {item.tagsEstimated && (
          <span className="text-[9px] text-zinc-500 italic self-center">tags estimated on-device</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
        {item.type !== 'preset' && item.type !== 'lyricist' && item.type !== 'stem' && (
          <button
            onClick={() => showSimilar(item)}
            className="text-[10px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 transition-colors"
          >
            More like this
          </button>
        )}
        {(item.type === 'preset' || item.type === 'lyricist' || item.type === 'stem' || item.type === 'song') && (
          <button
            onClick={() => openItemTarget(item)}
            className="text-[10px] font-black uppercase tracking-wider text-zinc-300 hover:text-white transition-colors"
          >
            {item.type === 'preset' ? 'Open in Studio' : item.type === 'lyricist' ? 'Open in Lyric Studio' : item.type === 'stem' ? 'Open Stem Splitter' : 'Open in Library'}
          </button>
        )}
        <button
          onClick={() => {
            setTagEditorId(tagEditorId === item.id ? null : item.id);
            setTagDraft('');
          }}
          className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
        >
          {tagEditorId === item.id ? 'Close tags' : 'Add tag'}
        </button>
        <select
          defaultValue=""
          onChange={e => {
            if (e.target.value) {
              addItemToCollection(e.target.value, item.id);
              setStatus(`Added "${item.title}" to a collection.`);
            }
            e.target.value = '';
          }}
          className="ml-auto bg-[#131316] border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-zinc-300 focus:outline-none"
          title="Add to a collection"
        >
          <option value="">+ Collection…</option>
          {collections.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {tagEditorId === item.id && (
        <div className="flex gap-2">
          <input
            type="text"
            value={tagDraft}
            onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && tagDraft.trim()) {
                addUserTag(item.id, tagDraft);
                setTagDraft('');
              }
            }}
            placeholder="Add a tag, e.g. mellow"
            className="flex-1 bg-[#131316] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50"
          />
          <button
            onClick={() => {
              if (tagDraft.trim()) {
                addUserTag(item.id, tagDraft);
                setTagDraft('');
              }
            }}
            className="bg-white/10 hover:bg-white/20 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
          >
            Add
          </button>
        </div>
      )}
      {tagEditorId === item.id && (
        <p className="text-[10px] text-zinc-500">
          Your tags on this item are saved in this browser. Tap a tag chip above to filter by it.
        </p>
      )}
    </div>
  );

  const itemsById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700 pb-32">
      <header className="space-y-2">
        <h1 className="text-5xl font-semibold tracking-tight italic">
          Sound <span className="text-orange-400">Browser</span>
        </h1>
        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">
          One library for everything — songs, loops, one-shots, uploads, stems, presets, lyricists
        </p>
        <p className="text-[11px] text-zinc-400 leading-relaxed max-w-3xl">
          BPM, key and tags on uploads are estimated on this device (Web Audio analysis) — not full
          music-understanding classification. “More like this” ranks by shared tags plus BPM/key
          closeness, not audio embeddings. Stem records are plans only: no separation engine is
          connected, so no stem audio exists yet. No third-party catalog is listed here — licensed
          catalogs (e.g. Splice) need a licensing decision first.
        </p>
      </header>

      {/* Search + type filter */}
      <div className="bg-[#131316] border border-white/5 rounded-3xl p-6 space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Describe a sound… try "atmospheric pad" or "lo-fi kick"'
            className="w-full bg-[#1a1a1e] border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 transition-all placeholder:text-zinc-600"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Plain-language search matches tags, names and descriptions by keyword — e.g. “atmospheric
          pad” also finds ambient and airy sounds; “lo-fi kick” finds lo-fi drums.
        </p>
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map(f => {
            const count = f.id === 'all' ? items.length : items.filter(i => i.type === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-2 rounded-full border text-[11px] font-bold transition-all ${
                  typeFilter === f.id
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 border-orange-500 text-white'
                    : 'bg-[#1a1a1e] border-white/10 text-zinc-300 hover:bg-white/5'
                }`}
              >
                {f.icon} {f.label} · {count}
              </button>
            );
          })}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                  selectedTags.includes(tag)
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                }`}
              >
                #{tag} · {count}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-red-300"
              >
                Clear tags
              </button>
            )}
          </div>
        )}
      </div>

      {status && (
        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-200 text-xs font-medium px-5 py-3 rounded-2xl">
          {status}
        </div>
      )}

      {/* Similar sounds panel */}
      {similarTo ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              More like “{similarTo.title}”{' '}
              <span className="text-sm text-zinc-500 font-normal">
                — ranked by shared tags + BPM/key closeness (not audio embeddings)
              </span>
            </h2>
            <button
              onClick={() => setSimilarTo(null)}
              className="text-[10px] font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-all"
            >
              ← Back to all results
            </button>
          </div>
          {similarResults.length === 0 ? (
            <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-3xl p-10 text-center">
              <p className="text-sm text-zinc-400 font-bold">No close matches yet.</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Similarity needs shared tags or a nearby BPM/key — add tags to sounds or upload more
                audio and this fills in.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {similarResults.map(r => renderItemCard(r.item, r))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
            {query || selectedTags.length > 0 || typeFilter !== 'all' ? ' — filtered' : ''}
          </h2>
          {filtered.length === 0 ? (
            <div className="bg-white/[0.02] border-2 border-dashed border-white/5 rounded-[3rem] p-12 text-center space-y-2">
              <p className="text-lg font-black uppercase text-zinc-500">Nothing matches yet</p>
              <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest">
                Try a broader word, clear a tag, or upload a sound below to grow the library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map(item => renderItemCard(item))}
            </div>
          )}
        </section>
      )}

      {/* My Collections (10.6) */}
      <section className="bg-[#131316] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">My Collections</h2>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Your folders for uploaded sounds and library items — the web equivalent of adding a
            folder as a browser location. Collections live in this browser (localStorage).
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={newCollectionName}
            onChange={e => setNewCollectionName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateCollection();
            }}
            placeholder="New collection name, e.g. Lo-fi drums"
            className="flex-1 min-w-[220px] bg-[#1a1a1e] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50"
          />
          <button
            onClick={handleCreateCollection}
            className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all"
          >
            Create collection
          </button>
        </div>

        {/* Upload straight into a collection */}
        <div className="bg-[#1a1a1e] border border-white/5 rounded-2xl p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Upload a sound — straight into a collection
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={uploadCollectionId}
              onChange={e => setUploadCollectionId(e.target.value)}
              className="bg-[#131316] border border-white/10 rounded-xl px-3 py-3 text-xs font-bold text-white focus:outline-none"
            >
              <option value="">Browser only (no collection)</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-zinc-200 transition-all disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing…' : '📁 Upload audio'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Uploaded audio is analyzed on this device (estimated BPM, key, energy, brightness) and
            the tags are saved with the sound. Files up to ~4 MB are kept in this browser so they
            keep playing after reload; larger files play this session only.
          </p>
        </div>

        {collections.length === 0 ? (
          <p className="text-xs text-zinc-500">No collections yet — create one above, then add sounds to it from any result card.</p>
        ) : (
          <div className="space-y-3">
            {collections.map(col => {
              const colItems = col.itemIds.map(id => itemsById.get(id)).filter((i): i is BrowserItem => !!i);
              const open = openCollectionId === col.id;
              return (
                <div key={col.id} className="bg-[#1a1a1e] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <button onClick={() => setOpenCollectionId(open ? null : col.id)} className="flex-1 flex items-center gap-3 text-left">
                      <span className="text-lg">📂</span>
                      <span className="text-sm font-bold text-white">{col.name}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {colItems.length} item{colItems.length === 1 ? '' : 's'}
                      </span>
                      <span className="text-zinc-500 text-xs ml-auto">{open ? '▾' : '▸'}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete the "${col.name}" collection? The sounds stay in the Browser.`)) {
                          deleteCollection(col.id);
                          setStatus(`Collection "${col.name}" deleted. Its sounds stay in the Browser.`);
                        }
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                  {open && (
                    <div className="px-5 pb-5 space-y-2 border-t border-white/5 pt-4">
                      {colItems.length === 0 ? (
                        <p className="text-[11px] text-zinc-500">
                          Empty — add sounds from any result card with the “+ Collection…” menu, or upload straight into this collection above.
                        </p>
                      ) : (
                        colItems.map(item => (
                          <div key={item.id} className="flex items-center gap-3 bg-[#131316] rounded-xl px-4 py-3">
                            <span>{TYPE_ICON[item.type]}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">{item.title}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{item.subtitle}</p>
                            </div>
                            {item.audioUrl && onPlay && (
                              <button
                                onClick={() => playItem(item)}
                                className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-xs hover:scale-105 transition-all"
                                title="Play"
                              >
                                ▶
                              </button>
                            )}
                            <button
                              onClick={() => removeItemFromCollection(col.id, item.id)}
                              className="text-zinc-500 hover:text-red-400 text-xs px-2"
                              title="Remove from collection"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default UnifiedBrowserView;
