import React, { useState, useMemo } from 'react';
import { generateMusicAdvice } from '../geminiService';

/**
 * SwCafe Stem Separation — three-mode UI, honestly disabled.
 *
 * There is NO separation engine connected to SwCafe yet, so nothing here
 * extracts stems. The old view ran a fake progress timer and showed
 * hardcoded stems — that is gone. What this view does:
 *  - Lets the user pick a mode (Auto Split / Split from Mix / Advanced Split),
 *    a target instrument, and (for Advanced) a set of instruments.
 *  - Holds per-stem export slots that are ready to wire to a real engine.
 *  - Says so plainly in the UI: extraction is disabled until an engine
 *    is connected. No filters are applied and no stems are produced.
 */

type SplitMode = 'auto' | 'split' | 'advanced';

const AUTO_CATEGORIES = [
  { id: 'lead-vocals', label: 'Lead Vocals', icon: '🎙️' },
  { id: 'backing-vocals', label: 'Backing Vocals', icon: '🎤' },
  { id: 'bass', label: 'Bass', icon: '🎸' },
  { id: 'drums', label: 'Drums', icon: '🥁' },
  { id: 'percussion', label: 'Percussion', icon: '🪘' },
  { id: 'synth', label: 'Synth', icon: '🎛️' },
  { id: 'pad', label: 'Pad', icon: '🌫️' },
  { id: 'guitar', label: 'Guitar', icon: '🎸' },
  { id: 'keys', label: 'Keys', icon: '🎹' },
  { id: 'strings', label: 'Strings', icon: '🎻' },
  { id: 'brass', label: 'Brass', icon: '🎺' },
  { id: 'fx', label: 'FX', icon: '✨' },
];

const SPLIT_TARGETS = [
  'Lead Vocals', 'Backing Vocals', 'Drums', 'Bass', 'Electric Guitar',
  'Acoustic Guitar', 'Piano', 'Keys', 'Synth', 'Strings', 'Brass',
  'Saxophone', 'Flute', 'Percussion',
];

/** Advanced Split instrument library, grouped by family. */
const ADVANCED_GROUPS: { group: string; items: string[] }[] = [
  { group: 'Drums', items: ['Kick', 'Snare', 'Hi-hat', 'Open hi-hat', 'Crash cymbal', 'Ride cymbal', 'Toms', 'Clap', 'Rim click', 'Shaker', 'Cowbell', 'Conga', 'Bongo', 'Tambourine', 'Woodblock', 'Triangle'] },
  { group: 'Bass', items: ['Electric bass', 'Synth bass', 'Upright bass', 'Fretless bass', 'Sub bass', 'Acoustic bass'] },
  { group: 'Guitar', items: ['Acoustic guitar', 'Electric guitar', 'Classical guitar', '12-string guitar', 'Slide guitar', 'Dobro', 'Lap steel', 'Banjo', 'Mandolin', 'Ukulele'] },
  { group: 'Keys', items: ['Piano', 'Electric piano', 'Rhodes', 'Wurlitzer', 'Organ', 'Clavinet', 'Mellotron', 'Harpsichord', 'Accordion', 'Harmonica'] },
  { group: 'Strings', items: ['Violin', 'Viola', 'Cello', 'Double bass', 'Harp', 'String ensemble', 'Pizzicato strings', 'Erhu', 'Shamisen'] },
  { group: 'Brass', items: ['Trumpet', 'Trombone', 'French horn', 'Tuba', 'Flugelhorn', 'Euphonium'] },
  { group: 'Woodwind', items: ['Flute', 'Clarinet', 'Oboe', 'Bassoon', 'Saxophone', 'Recorder', 'Pan flute'] },
  { group: 'Vocals', items: ['Lead vocals', 'Backing vocals', 'Choir', 'Spoken word', 'Rap vocals', 'Whisper vocals', 'Vocal chops'] },
  { group: 'Percussion & World', items: ['Marimba', 'Xylophone', 'Vibraphone', 'Steel drum', 'Didgeridoo', 'Djembe', 'Tabla', 'Sitar', 'Koto', 'Kalimba', 'Handpan', 'Cajón', 'Berimbau', 'Cuíca'] },
  { group: 'Synth & FX', items: ['Synth lead', 'Synth pad', 'Arpeggio synth', 'Pluck synth', 'Sub drop', 'Riser', 'Impact', 'Vinyl crackle', 'Tape hiss', 'Ambient texture', 'Granular texture'] },
];

const ADVANCED_TOTAL = ADVANCED_GROUPS.reduce((n, g) => n + g.items.length, 0);

const StemSplitterView: React.FC = () => {
  const [mode, setMode] = useState<SplitMode>('auto');
  const [sourceFile, setSourceFile] = useState<{ name: string; size: number } | null>(null);
  const [splitTarget, setSplitTarget] = useState<string>(SPLIT_TARGETS[0]);
  const [advancedSelected, setAdvancedSelected] = useState<string[]>([]);
  const [advancedSearch, setAdvancedSearch] = useState('');
  const [advice, setAdvice] = useState<string | null>(null);
  const [isAskingAdvice, setIsAskingAdvice] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const filteredGroups = useMemo(() => {
    const q = advancedSearch.trim().toLowerCase();
    if (!q) return ADVANCED_GROUPS;
    return ADVANCED_GROUPS
      .map(g => ({ group: g.group, items: g.items.filter(i => i.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0);
  }, [advancedSearch]);

  const toggleAdvanced = (item: string) => {
    setAdvancedSelected(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const getAdvice = async () => {
    setIsAskingAdvice(true);
    try {
      const context = mode === 'auto'
        ? 'Auto Split into 12 stem categories'
        : mode === 'split'
          ? `Split from Mix, isolating ${splitTarget}`
          : `Advanced Split targeting ${advancedSelected.length > 0 ? advancedSelected.join(', ') : 'no instruments selected yet'}`;
      const res = await generateMusicAdvice(
        `A producer is planning stem separation with this setup: ${context}. ` +
        `Give practical advice on how to use those stems in a mix once a separation engine is connected.`
      );
      setAdvice(res);
    } finally {
      setIsAskingAdvice(false);
    }
  };

  // The slots this mode would produce, once an engine is connected.
  const pendingSlots: { id: string; label: string; note: string }[] =
    mode === 'auto'
      ? AUTO_CATEGORIES.map(c => ({ id: c.id, label: c.label, note: 'Auto Split · 12 categories' }))
      : mode === 'split'
        ? [
            { id: 'target', label: splitTarget, note: 'Split from Mix · isolated instrument / voice' },
            { id: 'remainder', label: 'Everything Else', note: 'Split from Mix · the mix without the target' },
          ]
        : advancedSelected.map(s => ({ id: s, label: s, note: 'Advanced Split · targeted extraction' }));

  const modeSummary = mode === 'auto'
    ? 'Auto Split — the classic 12-category separation for a quick split.'
    : mode === 'split'
      ? `Split from Mix — pull ${splitTarget} out of the mix and get two stems: the ${splitTarget.toLowerCase()}, and everything else without it.`
      : `Advanced Split — pick exactly what to extract from ${ADVANCED_TOTAL} instruments. ${advancedSelected.length} selected.`;

  return (
    <div className="h-full flex flex-col gap-6 animate-in slide-in-from-bottom-6 duration-500 overflow-hidden">
      <header className="flex justify-between items-center bg-[#131316] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl flex-wrap gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold tracking-tight uppercase italic">Neural Splitter <span className="text-orange-400">&</span> Submix</h2>
          <p className="text-[11px] text-zinc-400">Three ways to extract stems — Auto Split, Split from Mix, Advanced Split.</p>
          <p className="text-[11px] font-bold text-amber-400">
            ⚠️ No separation engine is connected yet. Extraction is disabled — your choices below are saved and ready to run the moment an engine is wired in. Nothing here is faked.
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <label className="bg-white text-black px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl transition-all cursor-pointer hover:bg-zinc-200">
            {sourceFile ? `📁 ${sourceFile.name}` : 'Upload Master Source'}
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSourceFile({ name: f.name, size: f.size });
              }}
            />
          </label>
        </div>
      </header>

      {sourceFile && (
        <p className="text-[11px] text-zinc-400 px-2">
          Source ready: <span className="text-white font-bold">{sourceFile.name}</span> ({(sourceFile.size / 1024 / 1024).toFixed(1)} MB).
          The file stays in this browser — no audio is sent anywhere until a separation engine is connected.
        </p>
      )}

      <div className="flex-1 flex gap-6 min-h-0 relative">
        {/* Main workspace */}
        <div className="transition-all duration-300 bg-[#131316] rounded-[3rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl relative flex-1 min-h-0">
          <div className="p-6 md:p-8 space-y-5 overflow-y-auto custom-scrollbar">
            {/* Mode tabs */}
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'auto' as SplitMode, label: 'Auto Split', desc: '12 categories' },
                { id: 'split' as SplitMode, label: 'Split from Mix', desc: '1 instrument + remainder' },
                { id: 'advanced' as SplitMode, label: 'Advanced Split', desc: `${ADVANCED_TOTAL} instruments` },
              ]).map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`px-4 py-2.5 rounded-2xl border text-left transition-all ${
                    mode === m.id
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 border-orange-500 text-white shadow-lg'
                      : 'bg-[#1a1a1e] border-white/5 text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <span className="block text-[11px] font-black uppercase tracking-wider">{m.label}</span>
                  <span className={`block text-[9px] ${mode === m.id ? 'text-white/70' : 'text-zinc-500'}`}>{m.desc}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">{modeSummary}</p>

            {/* Split from Mix: pick the target */}
            {mode === 'split' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Instrument / voice to pull out</label>
                <select
                  value={splitTarget}
                  onChange={(e) => setSplitTarget(e.target.value)}
                  className="bg-[#1a1a1e] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500/50"
                >
                  {SPLIT_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            {/* Advanced Split: instrument picker */}
            {mode === 'advanced' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    value={advancedSearch}
                    onChange={(e) => setAdvancedSearch(e.target.value)}
                    placeholder="Search instruments… (try 'didgeridoo')"
                    className="flex-1 min-w-[200px] bg-[#1a1a1e] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50"
                  />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    {advancedSelected.length} selected · {ADVANCED_TOTAL} instruments
                  </span>
                  {advancedSelected.length > 0 && (
                    <button onClick={() => setAdvancedSelected([])} className="text-[10px] font-black uppercase text-zinc-400 hover:text-red-400 transition-colors">Clear all</button>
                  )}
                </div>
                <div className="space-y-4">
                  {filteredGroups.map(g => (
                    <div key={g.group} className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">{g.group}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {g.items.map(item => {
                          const active = advancedSelected.includes(item);
                          return (
                            <button
                              key={item}
                              onClick={() => toggleAdvanced(item)}
                              className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                                active
                                  ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                                  : 'bg-[#1a1a1e] border-white/5 text-zinc-400 hover:text-white hover:border-white/15'
                              }`}
                            >
                              {active ? '✓ ' : ''}{item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filteredGroups.length === 0 && (
                    <p className="text-[11px] text-zinc-500">No instruments match "{advancedSearch}".</p>
                  )}
                </div>
              </div>
            )}

            {/* Get Stems — disabled until an engine exists */}
            <div className="pt-2 border-t border-white/5 space-y-2">
              <button
                disabled
                title="Stem extraction needs a separation engine, which is not connected yet."
                className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/5 text-zinc-500 font-black text-xs uppercase tracking-widest cursor-not-allowed"
              >
                Get Stems — disabled · no engine connected
              </button>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                When an engine is connected, this button will extract the stems listed below as separate WAV files.
                Your mode{mode === 'split' ? ` and target (${splitTarget})` : ''}{mode === 'advanced' ? ` and ${advancedSelected.length} selected instrument${advancedSelected.length === 1 ? '' : 's'}` : ''} are kept and will be used.
              </p>
            </div>

            {/* Pending stem slots — export disabled, ready to wire */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                Stem slots {mode === 'advanced' && advancedSelected.length === 0 ? '(pick instruments above to fill them)' : `(${pendingSlots.length})`}
              </span>
              {pendingSlots.length === 0 ? (
                <p className="text-[11px] text-zinc-500 bg-[#1a1a1e] border border-white/5 rounded-2xl p-4">
                  No stems selected yet. Pick instruments above and their export slots will appear here.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {pendingSlots.slice(0, 12).map(slot => (
                    <div key={slot.id} className="bg-[#1a1a1e] rounded-2xl border border-white/5 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-[11px] font-black text-white truncate">{slot.label}</span>
                        <span className="block text-[9px] text-zinc-500">{slot.note}</span>
                      </div>
                      <button
                        disabled
                        title="Export unlocks once a separation engine produces this stem."
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black uppercase text-zinc-600 cursor-not-allowed"
                      >
                        Export WAV
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pendingSlots.length > 12 && (
                <p className="text-[10px] text-zinc-500">+ {pendingSlots.length - 12} more stems queued for export once the engine runs.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar: AI advice */}
        <div className={`transition-all duration-300 ease-in-out bg-[#131316] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl ${isSidebarOpen ? 'w-[320px] p-8' : 'w-0 p-0 border-none'}`}>
          <div className="min-w-[256px] flex flex-col h-full gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Mix Advice</h3>
              <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-white text-xs">◀</button>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Real AI advice about using the stems from your chosen setup — not a scan, and not separation itself.
            </p>
            <button
              onClick={() => void getAdvice()}
              disabled={isAskingAdvice}
              className="w-full bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest disabled:opacity-50"
            >
              {isAskingAdvice ? 'Thinking…' : 'Get Mix Advice'}
            </button>
            {advice && (
              <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap bg-[#1a1a1e] border border-white/5 rounded-2xl p-4">{advice}</p>
            )}
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Honest limits: no stems exist until a separation engine is connected. Auto Split would produce 12 stems, Split from Mix produces 2, Advanced Split produces one per selected instrument.
            </p>
          </div>
        </div>
        {!isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(true)} className="absolute right-4 top-4 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-zinc-300 border border-white/10">Show Sidebar ▶</button>
        )}
      </div>
    </div>
  );
};

export default StemSplitterView;
