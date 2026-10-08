
import React, { useState, useEffect } from 'react';
import { generateMusicAdvice, generateMidiLoop } from '../geminiService';

type ProductionTab = 'chord-wheel' | 'maschine-plus' | 'mpc-one-plus' | 'maschine-3' | 'mpc-software' | 'kontakt-8' | 'akai-expansions';

const AKAI_PACKS = [
  { id: 1, name: 'The Vault 2', artist: 'Akai Professional', genre: 'Classic Hip Hop', cover: 'https://picsum.photos/seed/vault2/400/400' },
  { id: 2, name: 'F9 Audio Beats', artist: 'James Wiltshire', genre: 'House / Disco', cover: 'https://picsum.photos/seed/f9/400/400' },
  { id: 3, name: 'Lofi Soul Confessions', artist: 'MSXII', genre: 'Lo-Fi Soul', cover: 'https://picsum.photos/seed/lofi/400/400' },
  { id: 4, name: 'Techno City', artist: 'Sniper Beats', genre: 'Industrial Techno', cover: 'https://picsum.photos/seed/techno/400/400' },
  { id: 5, name: 'Trap Gods v4', artist: 'AraabMuzik', genre: 'Modern Trap', cover: 'https://picsum.photos/seed/trap/400/400' },
  { id: 6, name: 'Soulful Vocals', artist: 'Elicit Audio', genre: 'Vocal / R&B', cover: 'https://picsum.photos/seed/vox/400/400' },
];

const ChordWheelView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<ProductionTab>('chord-wheel');
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [progression, setProgression] = useState<string[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [midiData, setMidiData] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [activePattern, setActivePattern] = useState('Block Chords');
  const [isMidiOpen, setIsMidiOpen] = useState(true);

  // Hardware/Software State
  const [activePad, setActivePad] = useState<number | null>(null);
  const [activeBank, setActiveBank] = useState('A');
  const [selectedLibrary, setSelectedLibrary] = useState('Noire');
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [knobValues, setKnobValues] = useState([45, 60, 22, 89, 12, 55, 30, 75]);

  const majorChords = ['C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const minorChords = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

  const handleChordClick = async (chord: string) => {
    setSelectedChord(chord);
    if (progression.length < 4) setProgression(prev => [...prev, chord]);
    else setProgression([chord]);
    setIsThinking(true);
    try {
      const advice = await generateMusicAdvice(`Suggest a 4-chord progression starting with ${chord}.`);
      setAiAdvice(advice);
    } finally {
      setIsThinking(false);
    }
  };

  const handleGenerateMidi = async () => {
    if (progression.length === 0) return alert("Select at least one chord.");
    setIsThinking(true);
    try {
      const data = await generateMidiLoop(progression, activePattern);
      setMidiData(data);
    } finally {
      setIsThinking(false);
    }
  };

  const renderChordWheelSegment = (chord: string, index: number, radius: number, innerRadius: number, type: 'major' | 'minor') => {
    const angle = (index * 30) - 90;
    const nextAngle = ((index + 1) * 30) - 90;
    const x1 = 50 + radius * Math.cos(angle * Math.PI / 180);
    const y1 = 50 + radius * Math.sin(angle * Math.PI / 180);
    const x2 = 50 + radius * Math.cos(nextAngle * Math.PI / 180);
    const y2 = 50 + radius * Math.sin(nextAngle * Math.PI / 180);
    const x3 = 50 + innerRadius * Math.cos(nextAngle * Math.PI / 180);
    const y3 = 50 + innerRadius * Math.sin(nextAngle * Math.PI / 180);
    const x4 = 50 + innerRadius * Math.cos(angle * Math.PI / 180);
    const y4 = 50 + innerRadius * Math.sin(angle * Math.PI / 180);
    const isSelected = selectedChord === chord;
    return (
      <g key={chord} onClick={() => handleChordClick(chord)} className="cursor-pointer group">
        <path d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`} fill={isSelected ? '#FF6B6B' : 'rgba(255,255,255,0.05)'} className="transition-all hover:fill-white/20" stroke="rgba(255,255,255,0.1)" strokeWidth="0.2" />
        <text x={50 + (radius + innerRadius) / 2 * Math.cos((angle + 15) * Math.PI / 180)} y={50 + (radius + innerRadius) / 2 * Math.sin((angle + 15) * Math.PI / 180)} fill={isSelected ? '#000' : 'white'} fontSize="3" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{chord}</text>
      </g>
    );
  };

  const handlePadHit = (id: number) => {
    setActivePad(id);
    setTimeout(() => setActivePad(null), 150);
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-700 overflow-hidden pb-20">
      <header className="flex flex-col gap-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold uppercase italic tracking-tight">Production <span className="text-orange-400">Center</span></h2>
          <div className="flex bg-[#131316] p-1.5 rounded-2xl border border-white/5 overflow-x-auto custom-scrollbar no-scrollbar gap-1">
            {(['chord-wheel', 'maschine-plus', 'mpc-one-plus', 'maschine-3', 'mpc-software', 'kontakt-8', 'akai-expansions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === tab ? 'bg-white text-black shadow-xl scale-105' : 'text-zinc-500 hover:text-white'}`}
              >
                {tab === 'chord-wheel' ? 'Chord Wheel' : tab.replace('-', ' ').toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-4">
             <button onClick={() => setIsMidiOpen(!isMidiOpen)} className="bg-white/5 hover:bg-white/10 px-8 py-3 rounded-2xl text-[10px] font-black uppercase border border-white/10 transition-all">
               {isMidiOpen ? '◀ Hide Lab' : 'Show Lab ▶'}
             </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex gap-8 min-h-0 relative">
        <div className="bg-[#131316] rounded-[3rem] border border-white/5 p-8 shadow-2xl flex flex-col items-center justify-center flex-1 relative overflow-hidden custom-scrollbar overflow-y-auto">
          
          {activeSubTab === 'chord-wheel' && (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
               <svg className="w-full h-full max-w-lg max-h-lg" viewBox="0 0 100 100">
                {majorChords.map((chord, i) => renderChordWheelSegment(chord, i, 48, 32, 'major'))}
                {minorChords.map((chord, i) => renderChordWheelSegment(chord, i, 32, 18, 'minor'))}
              </svg>
            </div>
          )}

          {/* NATIVE INSTRUMENTS MASCHINE+ HARDWARE UI */}
          {activeSubTab === 'maschine-plus' && (
            <div className="w-full max-w-[1200px] bg-[#1a1a1e] p-8 rounded-3xl border-[4px] border-[#0a0a0a] shadow-[0_60px_150px_rgba(0,0,0,1)] flex flex-col gap-6 animate-in slide-in-from-bottom-10 duration-500">
               {/* Dual Screens Area */}
               <div className="flex gap-1.5 bg-[#0a0a0a] p-1.5 rounded-lg border border-black shadow-2xl">
                  {/* Left Screen: Browser */}
                  <div className="flex-1 h-64 bg-[#050505] rounded-sm overflow-hidden flex flex-col p-4 border-r border-black relative">
                    <div className="flex justify-between items-center text-[9px] font-black text-white/20 uppercase mb-4 tracking-widest border-b border-white/5 pb-2">
                       <span className="text-white">PROJECTS</span>
                       <span>GROUPS</span>
                       <span>SOUNDS</span>
                       <span>SAMPLES</span>
                    </div>
                    <div className="flex-1 space-y-2">
                       {['Midnight_Soul_Kit', 'Neon_Techno_v4', 'Ambient_Blue', 'Heavy_Grime'].map((item, idx) => (
                         <div key={idx} className={`p-2.5 rounded text-[10px] font-bold tracking-tight flex items-center gap-3 ${idx === 1 ? 'bg-orange-500 text-black shadow-black/40' : 'text-white/40'}`}>
                           <div className={`w-1.5 h-1.5 rounded-full ${idx === 1 ? 'bg-black' : 'bg-white/10'}`}></div>
                           {item}
                         </div>
                       ))}
                    </div>
                    <div className="mt-auto flex justify-between text-[8px] font-black text-white/10 uppercase tracking-[0.2em]">
                       <span>MASCHINE+ STANDALONE</span>
                       <span>V4.2.0</span>
                    </div>
                  </div>
                  {/* Right Screen: Pattern / Arranger */}
                  <div className="flex-1 h-64 bg-[#050505] rounded-sm overflow-hidden flex flex-col p-4 relative">
                    <div className="flex justify-between items-center text-[9px] font-black text-white/20 uppercase mb-4 tracking-widest border-b border-white/5 pb-2">
                       <span>SCENE</span>
                       <span className="text-white">PATTERN</span>
                       <span>EVENT</span>
                    </div>
                    <div className="flex-1 relative">
                       <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '15px 15px' }}></div>
                       <div className="h-full flex items-end gap-1 px-4">
                          {Array.from({length: 16}).map((_, i) => (
                             <div key={i} className="flex-1 bg-blue-500/40 rounded-t-sm" style={{ height: `${20 + Math.random() * 60}%` }}></div>
                          ))}
                       </div>
                    </div>
                    <div className="mt-auto flex justify-between text-[9px] font-mono text-white/40">
                       <span className="text-orange-400">128.00 BPM</span>
                       <span>1 / 4 BAR</span>
                    </div>
                  </div>
               </div>

               {/* Row of 8 Encoders */}
               <div className="flex justify-between px-6 -mt-2">
                  {knobValues.map((val, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                       <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#333] to-[#111] border-2 border-black shadow-[0_10px_20px_rgba(0,0,0,0.5)] relative flex items-center justify-center cursor-pointer group active:rotate-12 transition-transform">
                          <div className="w-1 h-3 bg-white/20 rounded-full absolute top-1 group-hover:bg-orange-500"></div>
                       </div>
                       <div className="bg-[#131316] px-2 py-0.5 rounded border border-white/5">
                          <span className="text-[7px] font-black text-white/30 uppercase">{val}%</span>
                       </div>
                    </div>
                  ))}
               </div>

               {/* Main Buttons and Pads Section */}
               <div className="flex gap-8 px-2">
                  {/* Left Controls Column */}
                  <div className="w-48 flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-2">
                       {['CHANNEL', 'PLUG-IN', 'MIX', 'BROWSER', 'ARRANGE', 'SAMPLING', 'SETTINGS', 'FILE'].map(b => (
                         <button key={b} className="h-10 bg-[#252525] border border-black rounded-sm text-[8px] font-black text-white/40 hover:bg-[#333] hover:text-white transition-all shadow-md">{b}</button>
                       ))}
                    </div>
                    <div className="mt-auto space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <button className="h-12 bg-white/5 border border-black rounded-sm text-[8px] font-black text-white/40">SCENE</button>
                          <button className="h-12 bg-white/5 border border-black rounded-sm text-[8px] font-black text-white/40">PATTERN</button>
                       </div>
                       {/* Transport Controls */}
                       <div className="bg-[#0a0a0a] p-4 rounded-xl border border-black grid grid-cols-2 gap-3">
                          <button className="h-10 bg-[#333] border-b-2 border-black rounded text-[8px] font-black text-white/60">RESTART</button>
                          <button className="h-10 bg-[#333] border-b-2 border-black rounded text-[8px] font-black text-white/60">ERASE</button>
                          <button className="h-12 bg-orange-900/30 border border-orange-500/40 text-orange-400 rounded text-[9px] font-black">PLAY</button>
                          <button className="h-12 bg-red-900/30 border border-red-500/40 text-red-500 rounded text-[9px] font-black">REC</button>
                       </div>
                    </div>
                  </div>

                  {/* 16 Pro RGB Pads */}
                  <div className="bg-[#0a0a0a] p-8 rounded-3xl border-4 border-black shadow-inner flex-1 grid grid-cols-4 gap-4">
                     {Array.from({length: 16}).map((_, i) => {
                        const colors = ['#f97316', '#3b82f6', '#ec4899', '#10b981'];
                        const color = colors[Math.floor(i / 4)];
                        // Correct numbering: 13-16 at top, 1-4 at bottom
                        const padNum = 13 - (Math.floor(i/4)*4) + (i%4);
                        return (
                          <button
                            key={i}
                            onMouseDown={() => handlePadHit(i)}
                            className={`aspect-square rounded-lg border-b-4 border-black/60 transition-all duration-75 relative overflow-hidden group ${activePad === i ? 'scale-90 brightness-150 shadow-[0_0_40px_white]' : 'brightness-75 hover:brightness-100 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]'}`}
                            style={{ backgroundColor: '#222', borderTop: `2px solid ${color}40`, borderLeft: `2px solid ${color}40`, borderRight: `2px solid ${color}40` }}
                          >
                             <div className="absolute inset-1.5 rounded opacity-10 group-hover:opacity-20" style={{ backgroundColor: color }}></div>
                             <span className="absolute bottom-2 right-2 text-[9px] font-black text-white/10 uppercase italic">PAD {padNum}</span>
                          </button>
                        );
                     })}
                  </div>

                  {/* Right Navigation Cluster */}
                  <div className="w-56 flex flex-col gap-8">
                     <div className="grid grid-cols-4 gap-1.5 bg-[#131316] p-2 rounded-xl border border-white/5">
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(b => (
                           <button key={b} onClick={() => setActiveBank(b)} className={`h-8 rounded-sm text-[9px] font-black transition-all ${activeBank === b ? 'bg-blue-500 text-white' : 'bg-[#333] text-white/20'}`}>{b}</button>
                        ))}
                     </div>
                     {/* 4-D Directional Encoder */}
                     <div className="flex flex-col items-center gap-4 relative">
                        <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#444] via-[#222] to-[#000] border-[6px] border-black/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative flex items-center justify-center cursor-pointer group active:scale-95 transition-transform">
                           <div className="w-24 h-24 rounded-full border-4 border-white/5 shadow-inner"></div>
                           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2 bg-white/5 rounded-full mt-2"></div>
                           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-2 bg-white/5 rounded-full mb-2"></div>
                           <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-2 bg-white/5 rounded-full ml-2"></div>
                           <div className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-2 bg-white/5 rounded-full mr-2"></div>
                        </div>
                        <div className="flex gap-4">
                           {['VOLUME', 'SWING', 'TEMPO'].map(t => <button key={t} className="px-3 py-1.5 bg-[#333] rounded-md text-[7px] font-black text-white/40 uppercase tracking-tighter hover:text-white">{t}</button>)}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* MPC ONE+ HARDWARE UI */}
          {activeSubTab === 'mpc-one-plus' && (
            <div className="w-full max-w-[1400px] bg-[#991b1b] p-12 rounded-2xl border-[12px] border-[#7f1d1d] shadow-[0_50px_120px_rgba(0,0,0,1)] flex flex-col gap-10 animate-in slide-in-from-bottom-10 duration-500">
               <div className="flex justify-between items-center px-6">
                  <span className="text-white/80 font-black italic tracking-widest text-2xl">MPC ONE +</span>
                  <div className="flex flex-col items-end">
                     <span className="text-white text-3xl font-black tracking-tighter leading-none">AKAI</span>
                     <span className="text-white/60 text-[10px] font-bold uppercase tracking-[0.4em]">Professional</span>
                  </div>
               </div>
               <div className="h-[450px] bg-[#1a1a1e] rounded-xl border-[8px] border-[#333] shadow-2xl relative flex flex-col overflow-hidden">
                  <div className="bg-[#1a1a1e] h-14 flex items-center px-6 border-b border-black text-xs font-black text-white/30 gap-8">
                     <span className="text-[#ef4444]">MAIN</span>
                     <span>BROWSE</span>
                     <span>STEP SEQ</span>
                     <span>XYFX</span>
                  </div>
                  <div className="flex-1 bg-gradient-to-b from-[#222] to-[#0a0a0a] flex items-center justify-center p-8">
                     <div className="flex gap-2 h-48 items-end w-full">
                        {Array.from({length: 48}).map((_, i) => (
                           <div key={i} className="flex-1 bg-[#ef4444] rounded-t-md opacity-40 h-[60%]"></div>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="flex gap-12 items-start px-4">
                  <div className="w-24 grid grid-cols-1 gap-4">
                    {['16 LVL', 'COPY', 'ERASE'].map(b => <button key={b} className="h-14 bg-[#333] border-b-4 border-black rounded-lg text-[8px] font-black text-white/50">{b}</button>)}
                  </div>
                  {/* 30% LARGER PADS per previous request */}
                  <div className="bg-[#1a1a1e] p-16 rounded-[3rem] border-[6px] border-black shadow-[inset_0_0_50px_rgba(0,0,0,0.9)] grid grid-cols-4 gap-8 flex-1">
                     {Array.from({length: 16}).map((_, i) => {
                       const padNum = 13 - (Math.floor(i / 4) * 4) + (i % 4);
                       return (
                        <button key={i} onMouseDown={() => handlePadHit(i)} className={`aspect-square rounded-xl border-b-[8px] border-black/40 transition-all relative group ${activePad === i ? 'bg-white shadow-[0_0_60px_white] scale-90' : 'bg-[#1a1a1e] border-l-[6px] border-t-[6px] border-[#ef4444]40'}`}>
                           <span className="absolute bottom-2 right-2 text-[8px] font-black text-white/10">PAD {padNum}</span>
                        </button>
                       )
                     })}
                  </div>
                  <div className="w-80 flex flex-col gap-10">
                     <div className="bg-black/30 p-5 rounded-2xl border border-white/5 grid grid-cols-4 gap-3">
                        {['A', 'B', 'C', 'D'].map(b => <button key={b} onClick={() => setActiveBank(b)} className={`h-12 border border-black rounded transition-all text-xs font-black ${activeBank === b ? 'bg-white text-black' : 'bg-[#222] text-white/30'}`}>{b}</button>)}
                     </div>
                     <div className="w-48 h-48 rounded-full bg-gradient-to-br from-[#444] to-[#000] border-[8px] border-black/60 mx-auto relative flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full border-2 border-white/5"></div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* MPC SOFTWARE UI */}
          {activeSubTab === 'mpc-software' && (
            <div className="w-full h-[750px] bg-[#1a1a1e] border border-white/10 rounded-2xl flex flex-col animate-in fade-in zoom-in-95 duration-500 shadow-[0_60px_120px_rgba(0,0,0,1)]">
               <div className="h-12 bg-[#2a2a2a] border-b border-black flex items-center justify-between px-6 shrink-0">
                  <div className="flex items-center gap-6">
                     <div className="text-sm font-black text-[#ef4444] italic">MPC <span className="text-white">SOFTWARE</span></div>
                     <div className="flex gap-4">
                        {['FILE', 'EDIT', 'VIEW', 'TOOLS', 'HELP'].map(m => <button key={m} className="text-[9px] font-black text-zinc-500 hover:text-white uppercase">{m}</button>)}
                     </div>
                  </div>
                  <div className="flex items-center gap-6 bg-[#131316] px-6 h-full border-x border-black">
                     <div className="flex flex-col items-center">
                        <span className="text-[7px] text-zinc-500 font-black">BPM</span>
                        <span className="text-xs font-mono text-[#ef4444]">128.00</span>
                     </div>
                     <div className="flex flex-col items-center">
                        <span className="text-[7px] text-zinc-500 font-black">SEQ</span>
                        <span className="text-xs font-mono text-white">01: SEQUENCE</span>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <div className="w-3 h-3 rounded-full bg-orange-500 shadow-black/40"></div>
                     <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Neural Link v4</span>
                  </div>
               </div>

               <div className="flex-1 flex overflow-hidden">
                  <div className="w-96 bg-[#222] border-r border-black flex flex-col">
                     <div className="p-4 border-b border-black space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[9px] font-black text-zinc-500 uppercase">Input / Track</span></div>
                        <div className="bg-black/60 rounded-lg p-3 border border-white/5 space-y-2">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-[#ef4444]">TRK 01</span>
                              <span className="text-[10px] font-bold text-white uppercase">MPC DRUM KIT</span>
                           </div>
                        </div>
                     </div>
                     <div className="flex-1 p-6 grid grid-cols-4 gap-3 bg-black/20">
                        {Array.from({length: 16}).map((_, i) => (
                           <button 
                              key={i} 
                              onMouseDown={() => handlePadHit(i)}
                              className={`aspect-square rounded-lg border-2 transition-all flex items-center justify-center
                              ${activePad === i ? 'bg-white border-white scale-90 shadow-[0_0_20px_white]' : 'bg-[#333] border-white/5 hover:border-white/10'}`}
                           >
                              <span className={`text-[10px] font-black ${activePad === i ? 'text-black' : 'text-white/20'}`}>{16-i}</span>
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="flex-1 bg-[#1a1a1e] flex flex-col relative overflow-hidden">
                     <header className="h-10 bg-[#1a1a1e] border-b border-black flex items-center px-6 gap-6">
                        {['GRID', 'WAVE', 'LIST', 'STEP'].map(m => (
                           <button key={m} className={`text-[9px] font-black uppercase tracking-widest ${m === 'WAVE' ? 'text-[#ef4444]' : 'text-zinc-500 hover:text-white'}`}>{m}</button>
                        ))}
                     </header>
                     <div className="flex-1 p-8 flex flex-col relative">
                        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                        <div className="flex-1 bg-[#131316] border border-white/5 rounded-2xl relative overflow-hidden flex items-center justify-center">
                           <svg className="w-full h-48 opacity-40" preserveAspectRatio="none">
                              <path d={`M 0 100 ${Array.from({length: 100}).map((_, j) => `L ${j*10} ${100 + (Math.random()-0.5)*150}`).join(' ')}`} fill="none" stroke="#ef4444" strokeWidth="2" />
                           </svg>
                        </div>
                     </div>
                  </div>

                  <div className="w-80 bg-[#1a1a1e] border-l border-black flex flex-col">
                     <header className="p-4 border-b border-black bg-black/20">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black text-zinc-500 uppercase">Browser</span>
                        </div>
                     </header>
                     <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                        {AKAI_PACKS.slice(0, 4).map(pack => (
                           <button key={pack.id} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left group">
                              <img src={pack.cover} className="w-10 h-10 rounded-lg shadow-lg" alt={pack.name} />
                              <div className="min-w-0">
                                 <div className="text-[10px] font-black text-white truncate">{pack.name}</div>
                                 <div className="text-[8px] text-zinc-500 font-bold uppercase truncate">{pack.artist}</div>
                              </div>
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* AKAI SOUND PACKS / EXPANSIONS HUB */}
          {activeSubTab === 'akai-expansions' && (
            <div className="w-full max-w-[1200px] space-y-8 animate-in fade-in duration-500">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <h2 className="text-4xl font-semibold uppercase tracking-tight italic">Akai <span className="text-[#ef4444]">Expansions</span></h2>
                  </div>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                  {AKAI_PACKS.map(pack => (
                     <div 
                        key={pack.id} 
                        onClick={() => setSelectedPack(pack.name)}
                        className={`group relative aspect-square bg-[#1a1a1e] rounded-[2.5rem] overflow-hidden border transition-all cursor-pointer shadow-2xl
                        ${selectedPack === pack.name ? 'border-[#ef4444] scale-[1.02]' : 'border-white/5 hover:border-white/20'}`}
                     >
                        <img src={pack.cover} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700" alt={pack.name} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-8 flex flex-col justify-end">
                           <div className="space-y-1">
                              <h3 className="text-xl font-black uppercase text-white truncate leading-tight">{pack.name}</h3>
                              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{pack.artist}</p>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
          )}

          {/* KONTAKT 8 INTEGRATION */}
          {activeSubTab === 'kontakt-8' && (
            <div className="w-full max-w-[1200px] h-[750px] bg-[#1a1a1e] border-[4px] border-[#333] rounded-xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-500 shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
               <div className="w-80 bg-[#1a1a1e] border-r border-black flex flex-col">
                  <header className="p-6 border-b border-white/5 flex items-center justify-between">
                     <span className="text-[10px] font-black tracking-[0.2em] text-orange-500">KONTAKT 8</span>
                     <span className="text-[8px] font-bold text-white/20">KOMPLETE 15</span>
                  </header>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                     {['Noire', 'Alicia\'s Keys', 'Stradivari Violin', 'Action Strings 2', 'Pharlight', 'Ashlight', 'Modular Icons'].map(lib => (
                        <button 
                           key={lib} 
                           onClick={() => setSelectedLibrary(lib)}
                           className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedLibrary === lib ? 'bg-orange-500/10 border border-orange-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                        >
                           <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded flex items-center justify-center text-xs shadow-lg">🎹</div>
                           <span className={`text-[10px] font-black uppercase ${selectedLibrary === lib ? 'text-orange-400' : 'text-zinc-500'}`}>{lib}</span>
                        </button>
                     ))}
                  </div>
               </div>

               <div className="flex-1 flex flex-col bg-[#141414]">
                  <header className="h-14 bg-[#131316] border-b border-black flex items-center px-8 justify-between">
                     <div className="flex gap-6">
                        {['FILES', 'LIBRARIES', 'DATABASE', 'EXPERT', 'AUTOMATION'].map(h => (
                           <button key={h} className="text-[9px] font-black text-zinc-500 hover:text-white uppercase tracking-widest">{h}</button>
                        ))}
                     </div>
                     <div className="bg-black border border-white/5 px-4 py-1.5 rounded flex items-center gap-3">
                        <span className="text-[8px] font-black text-white/20">MEM</span>
                        <span className="text-[9px] font-mono text-orange-400">1.24 GB</span>
                     </div>
                  </header>

                  <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                     <div className="bg-[#222] border-l-[10px] border-orange-600 rounded-r-xl overflow-hidden shadow-2xl relative">
                        <div className="h-48 bg-gradient-to-r from-black via-[#111] to-black p-8 flex items-center justify-between">
                           <h3 className="text-4xl font-black italic tracking-tighter text-white">{selectedLibrary}</h3>
                           <div className="w-64 h-32 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center text-6xl opacity-30">🎹</div>
                        </div>
                     </div>
                  </div>

                  <div className="h-32 bg-[#0a0a0a] border-t border-black flex px-2 py-4 gap-[2px]">
                     {Array.from({length: 48}).map((_, i) => {
                        const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
                        return (
                           <div 
                              key={i} 
                              className={`flex-1 rounded-sm shadow-inner transition-all hover:brightness-125 cursor-pointer
                              ${isBlack ? 'bg-black h-[60%] z-10 border-x border-white/5' : 'bg-gradient-to-b from-[#eee] to-[#ccc] h-full border-x border-black/20'}`}
                           ></div>
                        );
                     })}
                  </div>
               </div>
            </div>
          )}

          {/* MASCHINE 3 INTEGRATION */}
          {activeSubTab === 'maschine-3' && (
            <div className="w-full max-w-[1250px] bg-[#121212] border-[1px] border-white/10 rounded-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500 shadow-[0_60px_150px_rgba(0,0,0,1)]">
               <div className="h-16 bg-[#1a1a1e] border-b border-black flex items-center justify-between px-8 shrink-0">
                  <div className="flex items-center gap-8">
                     <span className="text-xl font-black italic text-white tracking-tighter">MASCHINE <span className="text-orange-500">3</span></span>
                  </div>
               </div>

               <div className="flex-1 flex min-h-0">
                  <div className="w-64 bg-[#1a1a1e] border-r border-black p-6 space-y-8">
                     <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">Group Focus</p>
                     <div className="space-y-2">
                        {['Drums', 'Bass Synth', 'Melody A', 'Atmosphere'].map((grp, i) => (
                           <div key={grp} className={`p-4 rounded-xl flex items-center justify-between transition-all ${i === 0 ? 'bg-orange-600/20 border border-orange-500/30' : 'bg-black/20 border border-transparent'}`}>
                              <span className="text-[10px] font-black text-white">{grp}</span>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="flex-1 bg-black p-12 flex flex-col gap-10">
                     <div className="flex-1 grid grid-cols-4 gap-6">
                        {Array.from({length: 16}).map((_, i) => {
                           const colors = ['#3b82f6', '#ec4899', '#f97316', '#10b981'];
                           const color = colors[i % colors.length];
                           return (
                              <button 
                                 key={i} 
                                 onMouseDown={() => handlePadHit(i)}
                                 className={`aspect-square rounded-2xl transition-all relative group overflow-hidden border-2
                                 ${activePad === i ? 'scale-90 border-white bg-white' : 'bg-[#181818] border-white/5 hover:border-white/20 shadow-2xl'}`}
                              >
                                 <div className="absolute inset-2 rounded-xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: color }}></div>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Right Lab Output */}
        <div className={`transition-all duration-300 ease-in-out bg-[#131316] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl ${isMidiOpen ? 'w-[420px] p-8' : 'w-0 p-0 border-none'}`}>
          <div className="min-w-[356px] flex flex-col h-full gap-8">
             <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">MIDI Lab Output</h3>
                {isThinking && <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>}
             </div>
             
             <div className="flex-1 bg-[#131316] rounded-3xl p-6 border border-white/5 overflow-y-auto custom-scrollbar">
                {selectedChord && (
                  <div className="mb-6 pb-6 border-b border-white/5">
                    <p className="text-[10px] font-black uppercase text-zinc-500 mb-2">Active Session Chord</p>
                    <h4 className="text-4xl font-black text-[#FF6B6B]">{selectedChord}</h4>
                  </div>
                )}
                
                <div className="space-y-6">
                   <div>
                      <p className="text-[10px] font-black uppercase text-zinc-500 mb-3">AI Progression Advice</p>
                      {aiAdvice ? (
                        <p className="text-[11px] leading-relaxed text-zinc-300 italic animate-in fade-in duration-700">"{aiAdvice}"</p>
                      ) : (
                        <div className="py-12 flex flex-col items-center justify-center opacity-20 text-center gap-4">
                           <span className="text-4xl">🧠</span>
                           <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed text-center">Trigger neural analysis by interacting with the hardware interfaces.</p>
                        </div>
                      )}
                   </div>

                   {midiData && (
                     <div className="pt-6 border-t border-white/5 animate-in slide-in-from-bottom-2">
                        <p className="text-[10px] font-black uppercase text-orange-400 mb-3">MIDI Event Log</p>
                        <div className="bg-black/60 rounded-xl p-4 border border-orange-500/20 font-mono text-[9px] text-orange-400/80 whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                           {midiData}
                        </div>
                     </div>
                   )}
                </div>
             </div>

             <div className="space-y-4">
                <div className="space-y-2">
                   <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest px-1">Pattern Algorithm</p>
                   <div className="grid grid-cols-2 gap-2">
                      {['Arpeggio', 'Block Chords', 'Neo-Soul Vibe', 'Dark Techno'].map(p => (
                        <button 
                          key={p} 
                          onClick={() => setActivePattern(p)}
                          className={`py-2.5 rounded-xl text-[8px] font-black uppercase border transition-all ${activePattern === p ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20'}`}
                        >
                          {p}
                        </button>
                      ))}
                   </div>
                </div>
                <button 
                  onClick={handleGenerateMidi} 
                  disabled={progression.length === 0 || isThinking}
                  className="w-full bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30"
                >
                   {isThinking ? 'Synthesizing MIDI...' : 'Generate MIDI Loop'}
                </button>
             </div>
          </div>
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default ChordWheelView;
