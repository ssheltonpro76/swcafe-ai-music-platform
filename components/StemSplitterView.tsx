
import React, { useState, useEffect } from 'react';
import { generateMusicAdvice } from '../geminiService';

interface SubmixBus {
  id: string;
  name: string;
  color: string;
  stemIds: string[];
  volume: number;
}

const StemSplitterView: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [activeSubmixProfile, setActiveSubmixProfile] = useState<string>('Standard');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Submix Bus State
  const [submixBuses, setSubmixBuses] = useState<SubmixBus[]>([
    { id: 'bus-vox', name: 'Vocal Group', color: '#FF6B6B', stemIds: ['vocals'], volume: 80 },
    { id: 'bus-music', name: 'Music Group', color: '#4ECDC4', stemIds: ['drums', 'bass', 'melody'], volume: 70 }
  ]);

  const stems = [
    { id: 'vocals', label: 'Vocals', color: '#FF6B6B', icon: '🎙️' },
    { id: 'drums', label: 'Drums', color: '#4ECDC4', icon: '🥁' },
    { id: 'bass', label: 'Bass', color: '#10b981', icon: '🎸' },
    { id: 'melody', label: 'Melody', color: '#FFE66D', icon: '🎹' }
  ];

  const profiles = [
    { name: 'Standard', desc: 'Balanced distribution' },
    { name: 'Instrumental', desc: 'Vocal removal focus' },
    { name: 'Acapella Only', desc: 'Music elimination' }
  ];

  const startProcessing = () => {
    setIsProcessing(true);
    setHasData(false);
    setProgress(0);
  };

  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsProcessing(false);
            setHasData(true);
            return 100;
          }
          return prev + 1.5;
        });
      }, 30);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  const analyzeStems = async () => {
    const res = await generateMusicAdvice("Provide a professional signal analysis of a Vocal vs Music submix split.");
    setAnalysis(res);
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in slide-in-from-bottom-6 duration-500 overflow-hidden">
      <header className="flex justify-between items-center bg-[#131316] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold tracking-tight uppercase italic">Neural Splitter <span className="text-orange-400">&</span> Submix</h2>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="bg-white/5 hover:bg-white/10 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all">
             {isSidebarOpen ? '◀ Hide Sidebar' : 'Show Sidebar ▶'}
           </button>
           <button onClick={startProcessing} className="bg-white text-black px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl transition-all">Upload Master Source</button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 min-h-0 relative">
        {/* Main Workspace */}
        <div className={`transition-all duration-300 bg-[#131316] rounded-[3rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl relative flex-1`}>
          {isProcessing && (
            <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-3xl flex flex-col items-center justify-center p-20 space-y-12">
               <div className="w-48 h-48 border-8 border-orange-500/10 border-t-orange-500 rounded-full animate-spin shadow-black/40"></div>
               <p className="text-2xl font-black uppercase tracking-[0.3em] text-white">Extracting DNA {Math.round(progress)}%</p>
            </div>
          )}

          <div className={`flex-1 flex flex-col p-10 transition-opacity duration-700 ${hasData ? 'opacity-100' : 'opacity-10 pointer-events-none'}`}>
            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
               {submixBuses.map((bus) => (
                 <div key={bus.id} className="bg-[#1a1a1e] rounded-[2.5rem] border border-white/10 p-6 space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white px-4">{bus.name}</h3>
                    <div className="space-y-2 pl-8">
                       {stems.filter(s => bus.stemIds.includes(s.id)).map(stem => (
                         <div key={stem.id} className="h-20 bg-[#131316] rounded-2xl border border-white/5 flex items-center px-6 gap-4">
                            <span className="text-sm">{stem.icon}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{stem.label}</span>
                         </div>
                       ))}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Profiles & AI */}
        <div className={`transition-all duration-300 ease-in-out bg-[#131316] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl ${isSidebarOpen ? 'w-[320px] p-8' : 'w-0 p-0 border-none'}`}>
          <div className="min-w-[256px] flex flex-col h-full gap-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Profiles</h3>
            <div className="grid grid-cols-1 gap-3">
               {profiles.map(profile => (
                 <button key={profile.name} onClick={() => setActiveSubmixProfile(profile.name)} className={`w-full text-left p-5 rounded-[2rem] border transition-all ${activeSubmixProfile === profile.name ? 'bg-orange-600 border-orange-500 shadow-2xl' : 'bg-white/5 border-white/5'}`}>
                   <div className="text-[11px] font-black uppercase tracking-widest text-white">{profile.name}</div>
                 </button>
               ))}
            </div>
            <button onClick={analyzeStems} disabled={!hasData} className="w-full bg-white text-black font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest disabled:opacity-30">Run Neural Scan</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StemSplitterView;
