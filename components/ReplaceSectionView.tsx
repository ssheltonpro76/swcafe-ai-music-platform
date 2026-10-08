
import React, { useState, useEffect } from 'react';
import { generateReplacedSection } from '../geminiService';

interface SavedSong {
  id: string;
  title: string;
  genre: string;
  lyrics: string;
  theme?: string;
  engine: string;
}

interface ReplaceSectionViewProps {
  song: SavedSong;
  onConfirm: (finalData: { lyrics: string, title: string, genre: string }) => void;
  onCancel: () => void;
}

const ReplaceSectionView: React.FC<ReplaceSectionViewProps> = ({ song, onConfirm, onCancel }) => {
  const [startTime, setStartTime] = useState(15);
  const [endTime, setEndTime] = useState(35);
  const [lyrics, setLyrics] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [variations, setVariations] = useState<{v1: string, v2: string} | null>(null);

  useEffect(() => {
    // Simulate populating lyrics from the "segment"
    // In a real app, we'd slice the actual text. Here we pre-fill a representative chunk.
    setLyrics(song.lyrics.split('\n').slice(2, 6).join('\n'));
  }, [song]);

  const handleReplace = async () => {
    if (endTime - startTime < 10 || endTime - startTime > 30) {
      alert("Section must be between 10 and 30 seconds long.");
      return;
    }
    setIsProcessing(true);
    try {
      const result = await generateReplacedSection(
        song.lyrics, 
        `${startTime}s - ${endTime}s`, 
        lyrics, 
        song.genre
      );
      setVariations(result);
    } catch (e) {
      alert("Neural engine sync failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectVariation = (v: string) => {
    onConfirm({
      lyrics: v,
      title: `${song.title} (Re-Synthesized)`,
      genre: song.genre
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 animate-in fade-in duration-500 pb-32">
      <header className="flex justify-between items-end border-b border-white/5 pb-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-semibold tracking-tight italic">Edit Mode: <span className="text-orange-400">Replace Section</span></h1>
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">Surgical Lyrical & Instrumental Reconstruction</p>
        </div>
        <button onClick={onCancel} className="text-[10px] font-black uppercase text-zinc-400 hover:text-white transition-all">Discard Changes</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Configuration */}
        <div className="lg:col-span-5 space-y-10">
          <div className="bg-[#131316] p-10 rounded-[3rem] border border-white/5 space-y-8 shadow-2xl">
             <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Timeline Window</label>
                  <span className="text-xs font-mono text-orange-400 font-black">{endTime - startTime}s Duration</span>
                </div>
                
                <div className="space-y-6 pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black text-zinc-600 uppercase"><span>Start Position</span><span>{startTime}s</span></div>
                    <input type="range" min="0" max="90" value={startTime} onChange={(e) => setStartTime(Math.min(parseInt(e.target.value), endTime - 10))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-orange-500 cursor-pointer" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black text-zinc-600 uppercase"><span>End Position</span><span>{endTime}s</span></div>
                    <input type="range" min="10" max="100" value={endTime} onChange={(e) => setEndTime(Math.max(parseInt(e.target.value), startTime + 10))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-orange-500 cursor-pointer" />
                  </div>
                </div>
                
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[9px] text-zinc-500 leading-relaxed italic">"Select 10-30s. The AI will seamlessly blend the new section into the existing track."</p>
                </div>
             </div>

             <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Replacement Data</label>
                <textarea 
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Type new lyrics or [instrumental break]..."
                  className="w-full h-40 bg-[#131316] border border-white/10 rounded-2xl p-6 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder:text-zinc-800"
                />
             </div>

             <button 
              onClick={handleReplace}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-black/40 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30"
             >
               {isProcessing ? 'Synthesizing Variations...' : 'Replace Section'}
             </button>
          </div>
        </div>

        {/* Right: Output comparison */}
        <div className="lg:col-span-7">
          <div className="bg-[#131316] rounded-[4rem] border border-white/5 p-12 min-h-[600px] flex flex-col shadow-inner relative overflow-hidden">
             {/* Background Glow */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] -mr-32 -mt-32"></div>
             
             {isProcessing ? (
               <div className="flex-1 flex flex-col items-center justify-center space-y-8 opacity-40">
                  <div className="w-24 h-24 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-black uppercase tracking-[0.3em]">Neural Fusion Active</p>
                    <p className="text-[10px] text-zinc-500 uppercase italic">Blending 10-30s timeline window...</p>
                  </div>
               </div>
             ) : variations ? (
               <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-3">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                    Choose Your Variation
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                      { key: 'v1', label: 'Option Alpha', text: variations.v1 },
                      { key: 'v2', label: 'Option Beta', text: variations.v2 }
                    ].map(v => (
                      <div key={v.key} className="bg-[#1a1a1e] p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-6 group hover:border-orange-500/30 transition-all shadow-2xl">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">{v.label}</span>
                            <span className="text-[10px] text-zinc-600 font-mono">CH_V{v.key.slice(1)}</span>
                         </div>
                         <div className="flex-1 text-xs leading-relaxed italic text-zinc-300 font-medium whitespace-pre-wrap">
                            {v.text}
                         </div>
                         <button 
                          onClick={() => selectVariation(v.text)}
                          className="w-full bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
                         >
                           Select & Generate Track
                         </button>
                      </div>
                    ))}
                  </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center opacity-10 text-center gap-10">
                  <span className="text-[14rem] grayscale">⚙️</span>
                  <div className="space-y-2">
                    <p className="text-lg font-black uppercase tracking-[0.4em]">Studio IDLE</p>
                    <p className="text-[11px] font-bold text-zinc-600 uppercase">Awaiting timeline configuration</p>
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplaceSectionView;
