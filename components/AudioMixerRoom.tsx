
import React, { useState, useRef, useEffect } from 'react';
import { generateMusicAdvice } from '../geminiService';

interface EQPoint {
  id: string;
  x: number; // Frequency (0-100)
  y: number; // Gain (0-100, 50 is neutral)
  color: string;
  label: string;
}

const AudioMixerRoom: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState('Vocals');
  const [advice, setAdvice] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [activeTab, setActiveTab] = useState<'eq' | 'dynamics' | 'effects' | 'chords'>('eq');
  const [bpm, setBpm] = useState(128);
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  
  // EQ State
  const [eqPoints, setEqPoints] = useState<EQPoint[]>([
    { id: 'low', x: 10, y: 50, color: '#FF6B6B', label: 'Low' },
    { id: 'lmid', x: 30, y: 50, color: '#4ECDC4', label: 'L-Mid' },
    { id: 'mid', x: 50, y: 50, color: '#FFE66D', label: 'Mid' },
    { id: 'hmid', x: 70, y: 50, color: '#10b981', label: 'H-Mid' },
    { id: 'high', x: 90, y: 50, color: '#3b82f6', label: 'High' },
  ]);
  const [draggingPoint, setDraggingPoint] = useState<string | null>(null);
  const eqContainerRef = useRef<HTMLDivElement>(null);

  // Pitch Correction State (Effects Tab)
  const [pitchConfig, setPitchConfig] = useState({
    retuneSpeed: 20,
    humanize: 45,
    key: 'C',
    scale: 'Major',
    bypass: false
  });

  const channels = ['Vocals', 'Drums', 'Bass', 'Synths', 'Guitars', 'FX', 'Master'];
  const [faders, setFaders] = useState<Record<string, number>>({
    Vocals: 75, Drums: 85, Bass: 70, Synths: 65, Guitars: 60, FX: 50, Master: 90
  });

  const majorChords = ['C', 'G', 'D', 'A', 'E', 'B', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const minorChords = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

  // dB scale referencing
  const dbScale = [6, 0, -5, -10, -20, -30, -40, -60];

  // BPM Flash Logic
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setFlash(prev => !prev);
    }, (60 / bpm) * 500);
    return () => clearInterval(interval);
  }, [bpm]);

  const handleFaderChange = (channel: string, value: number) => {
    setFaders(prev => ({ ...prev, [channel]: value }));
  };

  const handleMouseDown = (id: string) => setDraggingPoint(id);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingPoint || !eqContainerRef.current) return;
    const rect = eqContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setEqPoints(prev => prev.map(p => p.id === draggingPoint ? { ...p, x, y } : p));
  };
  const handleMouseUp = () => setDraggingPoint(null);

  const generatePath = () => {
    const sorted = [...eqPoints].sort((a, b) => a.x - b.x);
    let path = `M 0 ${sorted[0].y}`;
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const cp1x = curr.x + (next.x - curr.x) / 2;
      path += ` C ${cp1x} ${curr.y}, ${cp1x} ${next.y}, ${next.x} ${next.y}`;
    }
    path += ` L 100 ${sorted[sorted.length - 1].y}`;
    return path;
  };

  const handleChordClick = async (chord: string) => {
    setSelectedChord(chord);
    setIsAsking(true);
    const res = await generateMusicAdvice(`Advise on a song key modulation from ${pitchConfig.key} ${pitchConfig.scale} to ${chord}. Suggest common chords for this transition.`);
    setAdvice(res);
    setIsAsking(false);
  };

  const renderChordSegment = (chord: string, index: number, radius: number, innerRadius: number, type: 'major' | 'minor') => {
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
        <path 
          d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`} 
          fill={isSelected ? (type === 'major' ? '#FF6B6B' : '#4ECDC4') : 'rgba(255,255,255,0.05)'}
          className="transition-all duration-300 group-hover:fill-white/10"
          stroke="rgba(255,255,255,0.1)" strokeWidth="0.1"
        />
        <text 
          x={50 + (radius + innerRadius) / 2 * Math.cos((angle + 15) * Math.PI / 180)} 
          y={50 + (radius + innerRadius) / 2 * Math.sin((angle + 15) * Math.PI / 180)}
          fill={isSelected ? '#000' : 'white'} fontSize="2.5" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" className="pointer-events-none"
        >
          {chord}
        </text>
      </g>
    );
  };

  const getAIAdvice = async () => {
    setIsAsking(true);
    const prompt = `Mixing advice for ${activeChannel}. EQ is active. BPM is ${bpm}. ${selectedChord ? `Song is exploring ${selectedChord}.` : ''} Provide 2 specific tips.`;
    const res = await generateMusicAdvice(prompt);
    setAdvice(res);
    setIsAsking(false);
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in slide-in-from-bottom-6 duration-500 overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <header className="flex justify-between items-center bg-white/5 p-6 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Master Production Hub</h2>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-tight">Engineered for Professional Excellence</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="bg-black/40 px-6 py-2 rounded-2xl border border-white/5 flex items-center gap-4">
             <div className={`w-2 h-2 rounded-full transition-all duration-75 ${flash ? 'bg-orange-500 shadow-black/40' : 'bg-orange-950'}`}></div>
             <span className="text-xs font-mono text-orange-400 tabular-nums font-black">{bpm} BPM</span>
          </div>
          <button className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all">Final Export</button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        <div className="col-span-8 flex flex-col gap-6 min-h-0">
          <div className="bg-[#131316] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl flex-grow">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xs font-semibold tracking-tight text-zinc-500">Multichannel Console</h3>
              <div className="flex gap-4">
                 <span className="text-[9px] font-black text-[#FF6B6B] animate-pulse">● MASTER BUS LINKED</span>
              </div>
            </div>
            
            <div className="flex-1 flex p-8 gap-4 overflow-x-auto custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
              {channels.map((chan) => (
                <div 
                  key={chan} 
                  onClick={() => setActiveChannel(chan)}
                  className={`flex-1 min-w-[120px] flex flex-col items-center p-5 rounded-[2rem] transition-all cursor-pointer group relative overflow-hidden ${activeChannel === chan ? 'bg-orange-500/10 border-2 border-orange-500/60 shadow-black/40' : 'bg-white/5 border border-white/5 hover:bg-white/[0.08]'}`}
                >
                  <div className="text-center mb-6 z-10">
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${activeChannel === chan ? 'text-orange-400' : 'text-zinc-400'}`}>{chan}</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center justify-center relative w-full mb-6 z-10 px-2">
                     {/* Decibel Ruler Board */}
                     <div className="absolute left-0 right-0 top-0 bottom-0 flex flex-col justify-between py-6 pointer-events-none opacity-40">
                        {dbScale.map(val => (
                          <div key={val} className="flex items-center px-2 w-full">
                            <span className="text-[7px] font-mono text-slate-600 font-black w-6">{val > 0 ? `+${val}` : val}</span>
                            <div className="flex-1 h-[0.5px] bg-white/10"></div>
                          </div>
                        ))}
                        <div className="flex items-center px-2 w-full">
                           <span className="text-[7px] font-mono text-slate-600 font-black w-6">-∞</span>
                           <div className="flex-1 h-[0.5px] bg-white/10"></div>
                        </div>
                     </div>

                     <div className="w-1.5 h-full bg-white/10 rounded-full shadow-inner ml-4 relative z-10"></div>
                     <input type="range" min="0" max="100" value={faders[chan]} onChange={(e) => handleFaderChange(chan, parseInt(e.target.value))} className="absolute w-44 -rotate-90 origin-center cursor-pointer appearance-none bg-transparent fader-thumb-custom ml-4 z-20" />
                  </div>

                  <div className="space-y-3 w-full pt-4 border-t border-white/5 z-10 text-center">
                     <p className="text-[10px] font-mono text-[#FFE66D] italic">-{ (100 - faders[chan]) / 5 } dB</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-[#131316] rounded-[2rem] border border-white/5 p-8 shadow-2xl flex items-center justify-between">
              <div className="flex-1 max-w-lg space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Global Master Tempo</p>
                    <span className="text-[11px] font-black text-[#FFE66D] font-mono">{bpm} BPM</span>
                  </div>
                  <input type="range" min="40" max="220" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500" />
              </div>
              <div className="flex gap-4 ml-12">
                 {['Sync', 'Quantize', 'Lock'].map(ctrl => (
                   <button key={ctrl} className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[8px] font-black uppercase hover:border-orange-500 transition-all">{ctrl}</button>
                 ))}
              </div>
          </div>
        </div>

        <div className="col-span-4 flex flex-col gap-6">
          <div className="bg-[#131316] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl space-y-6 flex flex-col h-full overflow-hidden">
            <div className="flex bg-[#131316]/40 p-1 rounded-2xl border border-white/5">
                {(['eq', 'dynamics', 'effects', 'chords'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === t ? 'bg-gradient-to-r from-orange-500 to-red-600 text-black shadow-lg shadow-black/40' : 'text-zinc-500 hover:text-white'}`}
                    >
                        {t === 'chords' ? 'Chord Wheel' : t}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {activeTab === 'eq' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <header className="flex justify-between items-center px-1"><h4 className="text-xs font-semibold tracking-tight text-orange-400">Parametric EQ</h4></header>
                        <div ref={eqContainerRef} className="h-48 bg-[#131316] rounded-3xl border border-white/5 relative overflow-hidden group shadow-inner">
                           <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <path d={generatePath()} fill="url(#eq-grad)" fillOpacity="0.1" />
                              <path d={generatePath()} fill="none" stroke="#FF6B6B" strokeWidth="1" className="animate-pulse" />
                              <defs><linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B6B" /><stop offset="100%" stopColor="transparent" /></linearGradient></defs>
                           </svg>
                           {eqPoints.map(p => (
                             <div key={p.id} onMouseDown={() => handleMouseDown(p.id)} className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center group/point z-20 cursor-grab active:cursor-grabbing" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                                <div className="w-2.5 h-2.5 rounded-full border-2 border-white bg-slate-900 group-hover/point:scale-150 transition-transform" style={{ color: p.color, backgroundColor: p.color }}></div>
                             </div>
                           ))}
                        </div>
                    </div>
                )}

                {activeTab === 'effects' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <header className="flex justify-between items-center px-1"><h4 className="text-xs font-semibold tracking-tight text-orange-400">Vocal Pitch Engine</h4></header>
                        <div className="bg-[#131316]/40 rounded-3xl p-6 border border-white/5 space-y-8">
                            <div className="flex justify-around">
                                {[{ l: 'Retune Speed', v: pitchConfig.retuneSpeed, vScale: pitchConfig.retuneSpeed, c: '#3b82f6' }, { l: 'Humanize', v: pitchConfig.humanize, vScale: pitchConfig.humanize, c: '#a78bfa' }].map(knob => (
                                    <div key={knob.l} className="flex flex-col items-center gap-2">
                                        <div className="w-20 h-20 rounded-full border-4 border-white/5 relative flex items-center justify-center">
                                            <div className="absolute inset-2 rounded-full border border-white/10" style={{ transform: `rotate(${(knob.v * 2.4) - 120}deg)` }}><div className="w-1 h-3 bg-blue-500 rounded-full mx-auto"></div></div>
                                            <span className="text-[10px] font-black font-mono">{knob.v}%</span>
                                        </div>
                                        <span className="text-[8px] font-black uppercase text-slate-500">{knob.l}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2"><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Target Key</p>
                               <select className="w-full bg-[#131316] border-white/10 rounded-2xl p-3 text-[10px] font-black text-white focus:ring-1 focus:ring-orange-500 outline-none appearance-none cursor-pointer">
                                  {['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => <option key={k}>{k}</option>)}
                               </select></div>
                               <div className="space-y-2"><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Scale</p>
                               <select className="w-full bg-[#131316] border-white/10 rounded-2xl p-3 text-[10px] font-black text-white focus:ring-1 focus:ring-orange-500 outline-none appearance-none cursor-pointer">
                                  {['Major', 'Minor', 'Dorian', 'Phrygian', 'Chromatic'].map(k => <option key={k}>{k}</option>)}
                               </select></div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chords' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <header className="flex justify-between items-center px-1"><h4 className="text-xs font-semibold tracking-tight text-orange-400">Harmonic Wheel</h4></header>
                        <div className="aspect-square bg-black rounded-full border border-white/5 relative p-4 flex items-center justify-center overflow-hidden shadow-2xl">
                           <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none"></div>
                           <svg className="w-full h-full" viewBox="0 0 100 100">
                              {majorChords.map((chord, i) => renderChordSegment(chord, i, 48, 30, 'major'))}
                              {minorChords.map((chord, i) => renderChordSegment(chord, i, 30, 16, 'minor'))}
                              <circle cx="50" cy="50" r="14" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.2" />
                              <text x="50" y="50" fill="#FF6B6B" fontSize="2.5" fontWeight="black" textAnchor="middle" dominantBaseline="middle" className="uppercase tracking-widest">SC</text>
                           </svg>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                           <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Selected Tonic: <span className="text-white text-lg ml-2 italic">{selectedChord || 'None'}</span></p>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-white/5 space-y-6">
                <div className="flex-1 overflow-y-auto custom-scrollbar max-h-32 bg-[#131316]/40 rounded-2xl p-4 border border-white/5">
                   {advice ? (
                     <p className="text-[10px] leading-relaxed text-zinc-400 font-medium italic animate-in fade-in duration-700">"{advice}"</p>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-20 gap-2">
                        <span className="text-2xl">🧠</span>
                        <p className="text-[8px] font-black uppercase tracking-widest">Neural Production Advisor</p>
                     </div>
                   )}
                </div>
                <button 
                   onClick={getAIAdvice}
                   disabled={isAsking}
                   className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-black py-4 rounded-2xl text-[9px] uppercase tracking-widest shadow-xl transition-all disabled:opacity-50"
                >
                   {isAsking ? 'Thinking...' : `Consult Signal Engine`}
                </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .fader-thumb-custom::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 24px;
          width: 32px;
          background: #1a1a1a;
          border: 2px solid #FF6B6B;
          border-radius: 6px;
          box-shadow: 0 0 15px rgba(255, 107, 107, 0.3);
          cursor: pointer;
        }
        .fader-thumb-custom::-moz-range-thumb {
          height: 24px;
          width: 32px;
          background: #1a1a1a;
          border: 2px solid #FF6B6B;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default AudioMixerRoom;
