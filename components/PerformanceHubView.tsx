
import React, { useState, useEffect } from 'react';
import { generateMusicAdvice } from '../geminiService';

const PerformanceHubView: React.FC = () => {
  const [activePad, setActivePad] = useState<number | null>(null);
  const [isFxOpen, setIsFxOpen] = useState(true);
  const [fxLevels, setFxLevels] = useState({ grit: 20, wash: 35, echo: 15, space: 50 });
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const drumPads = [
    { id: 1, label: 'KICK 1', color: '#FF6B6B' }, { id: 2, label: 'KICK 2', color: '#FF6B6B' },
    { id: 3, label: 'SNARE 1', color: '#4ECDC4' }, { id: 4, label: 'SNARE 2', color: '#4ECDC4' },
    { id: 5, label: 'CLOSED HAT', color: '#FFE66D' }, { id: 6, label: 'OPEN HAT', color: '#FFE66D' },
    { id: 7, label: 'CLAP', color: '#10b981' }, { id: 8, label: 'RIMSHOT', color: '#10b981' },
    { id: 9, label: 'TOM LOW', color: '#3b82f6' }, { id: 10, label: 'TOM MID', color: '#3b82f6' },
    { id: 11, label: 'TOM HIGH', color: '#3b82f6' }, { id: 12, label: 'CRASH', color: '#a78bfa' },
    { id: 13, label: 'PERC 1', color: '#f472b6' }, { id: 14, label: 'PERC 2', color: '#f472b6' },
    { id: 15, label: 'SUB HIT', color: '#fb923c' }, { id: 16, label: 'GLITCH', color: '#ef4444' }
  ];

  const handlePadHit = (id: number) => {
    setActivePad(id);
    setTimeout(() => setActivePad(null), 100);
  };

  const getRhythmAdvice = async () => {
    setIsAnalyzing(true);
    const res = await generateMusicAdvice("Suggest a beat pattern.");
    setAiTip(res);
    setIsAnalyzing(false);
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-700 overflow-hidden">
      <header className="flex justify-between items-center bg-white/5 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <h2 className="text-3xl font-black tracking-tighter uppercase italic">Performance <span className="text-[#FF6B6B]">Hub</span></h2>
        <div className="flex gap-4">
           <button onClick={() => setIsFxOpen(!isFxOpen)} className="bg-white/5 hover:bg-white/10 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10">
             {isFxOpen ? '◀ Hide FX Rack' : 'Show FX Rack ▶'}
           </button>
           <button className="bg-[#FF6B6B] text-black px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Record Loop</button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 min-h-0 relative">
        <div className={`transition-all duration-300 bg-[#111] rounded-[3rem] border border-white/5 p-10 shadow-2xl flex flex-col gap-10 flex-1`}>
          <div className="grid grid-cols-4 gap-4 flex-1">
            {drumPads.map(pad => (
              <button key={pad.id} onMouseDown={() => handlePadHit(pad.id)} className={`relative rounded-[2rem] border-2 transition-all duration-75 flex flex-col items-center justify-center gap-2 group ${activePad === pad.id ? 'scale-95 border-white shadow-2xl' : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/20'}`} style={{ color: pad.color }}>
                <span className="text-xl">🥁</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{pad.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`transition-all duration-300 ease-in-out bg-[#111] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl ${isFxOpen ? 'w-[420px] p-8' : 'w-0 p-0 border-none'}`}>
          <div className="min-w-[356px] flex flex-col h-full gap-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#FFE66D]">Macro FX Rack</h3>
            <div className="grid grid-cols-2 gap-8">
              {['grit', 'wash', 'echo', 'space'].map(id => (
                <div key={id} className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 bg-[#1a1a1a] rounded-full border border-white/10 flex items-center justify-center cursor-pointer shadow-inner">
                    <div className="w-1 h-6 bg-white/20 rounded-full" style={{ transform: `rotate(${(fxLevels as any)[id] * 2.4 - 120}deg)` }}></div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{id.toUpperCase()}</p>
                </div>
              ))}
            </div>
            <button onClick={getRhythmAdvice} className="w-full bg-white text-black font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest shadow-2xl">Suggest Rhythm</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceHubView;
