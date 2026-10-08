
import React, { useState, useEffect } from 'react';
import { generateVideo } from '../geminiService';

// Redundant global declaration removed. It is now centralized in types.ts

const VideoEditorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'media' | 'effects' | 'audio'>('media');
  const [genStep, setGenStep] = useState<string>('');

  const loadingMessages = [
    "Analyzing visual concepts...",
    "Synthesizing neural frames...",
    "Rendering cinematic lighting...",
    "Syncing temporal consistency...",
    "Finalizing pixel output..."
  ];

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      let idx = 0;
      setGenStep(loadingMessages[0]);
      interval = setInterval(() => {
        idx = (idx + 1) % loadingMessages.length;
        setGenStep(loadingMessages[idx]);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!prompt) return alert('Please enter a description for the video scene.');

    // Check if aistudio is available and if an API key has been selected
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        alert('Veo video generation requires a selected paid API key. Opening selection dialog...');
        await window.aistudio.openSelectKey();
        // Proceed as per instructions: assume success after triggering selection
      }
    }

    setIsGenerating(true);
    setVideoUrl(null);

    try {
      const url = await generateVideo(prompt, aspectRatio);
      setVideoUrl(url);
    } catch (e: any) {
      if (e.message?.includes("Requested entity was not found")) {
        // Reset key selection if the request fails due to invalid project/billing
        alert("API Key error. Please re-select your key from a paid GCP project.");
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
        }
      } else {
        alert('Video generation failed. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in slide-in-from-bottom-6 duration-500 overflow-hidden">
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        
        {/* Left Library Panel */}
        <div className="col-span-3 bg-[#131316] rounded-[2rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl">
          <header className="p-6 border-b border-white/5 space-y-4">
            <h3 className="text-sm font-semibold tracking-tight uppercase text-zinc-500">Asset Library</h3>
            <div className="flex bg-[#131316]/40 p-1 rounded-xl border border-white/5">
              {(['media', 'effects', 'audio'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-gradient-to-r from-orange-500 to-red-600 text-black' : 'text-zinc-500 hover:text-white'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
            {activeTab === 'media' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Recent Generations</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="aspect-video bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center group cursor-pointer hover:border-[#FF6B6B]/30 transition-all overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 to-red-600/20"></div>
                      <span className="text-2xl group-hover:scale-110 transition-transform">🎬</span>
                    </div>
                  </div>
                </div>
                <button className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:border-white/20 transition-all">
                  Import Local File
                </button>
              </div>
            )}
            {activeTab === 'effects' && (
              <div className="grid grid-cols-2 gap-3">
                {['VHS Bloom', 'Neural Glitch', 'Cyber Tint', 'Noir Phase'].map(effect => (
                  <div key={effect} className="aspect-square bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-2 p-3 text-center cursor-pointer hover:bg-white/10 transition-all">
                    <span className="text-xl">✨</span>
                    <span className="text-[8px] font-black uppercase tracking-tighter leading-tight">{effect}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Preview and Generator */}
        <div className="col-span-6 flex flex-col gap-6">
          <div className="flex-1 bg-black rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl relative group">
            {isGenerating ? (
              <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-12 text-center space-y-8">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">📽️</div>
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-black uppercase tracking-widest text-white">{genStep}</p>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Veo 3.1 Fast Preview Engine</p>
                </div>
              </div>
            ) : videoUrl ? (
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-30">
                <span className="text-9xl mb-6">🎥</span>
                <h3 className="text-2xl font-black uppercase tracking-[0.2em]">Ready to Render</h3>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-2">Describe a scene below to begin</p>
              </div>
            )}
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="text-xl">⏮</button>
              <button className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center text-sm">▶</button>
              <button className="text-xl">⏭</button>
              <div className="h-4 w-px bg-white/20 mx-2"></div>
              <span className="text-[10px] font-black font-mono">00:00 / 00:00</span>
            </div>
          </div>

          <div className="bg-[#131316] p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-6 shadow-2xl">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1 flex justify-between">
                AI Vision Prompt <span>Veo 3.1 Fast</span>
              </label>
              <div className="flex gap-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A cinematic aerial shot of a futuristic neon city at sunset..."
                  className="flex-1 h-20 bg-[#131316]/40 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-zinc-700 resize-none transition-all"
                />
                <div className="flex flex-col gap-2">
                   {(['16:9', '9:16'] as const).map(ar => (
                     <button
                        key={ar}
                        onClick={() => setAspectRatio(ar)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${aspectRatio === ar ? 'bg-gradient-to-r from-orange-500 to-red-600 text-black border-transparent' : 'bg-white/5 border-white/10 text-zinc-500'}`}
                     >
                       {ar}
                     </button>
                   ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-black font-black py-5 rounded-2xl shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all text-xs uppercase tracking-[0.2em] disabled:opacity-50"
            >
              {isGenerating ? 'Rendering Cinematic Visuals...' : 'Generate AI Scene'}
            </button>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="col-span-3 bg-[#131316] rounded-[2rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl">
          <header className="p-6 border-b border-white/5">
            <h3 className="text-sm font-semibold tracking-tight uppercase text-zinc-500">Properties</h3>
          </header>
          <div className="p-8 space-y-8">
            <div className="space-y-4">
               <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Transform</p>
               {['Opacity', 'Scale', 'Rotation'].map(prop => (
                 <div key={prop} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                       <span>{prop}</span>
                       <span className="text-orange-400">100%</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-white/40 w-full"></div>
                    </div>
                 </div>
               ))}
            </div>
            <div className="space-y-4 pt-8 border-t border-white/5">
               <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Neural Parameters</p>
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold">Motion Flow</span>
                  <div className="w-10 h-5 bg-orange-500/20 rounded-full relative">
                     <div className="absolute top-1 left-1 w-3 h-3 bg-orange-500 rounded-full"></div>
                  </div>
               </div>
            </div>
          </div>
          <div className="mt-auto p-6 bg-white/5 border-t border-white/5">
             <button className="w-full bg-gradient-to-r from-orange-500 to-red-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Sync to Timeline</button>
          </div>
        </div>
      </div>

      {/* Multi-Track Timeline */}
      <div className="h-64 bg-[#131316] rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col overflow-hidden">
         <header className="h-12 bg-[#131316]/40 border-b border-white/5 flex items-center px-8 justify-between">
            <div className="flex items-center gap-6">
               <div className="flex gap-2">
                  <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">✂️</button>
                  <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">🗑️</button>
                  <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">🔗</button>
               </div>
               <div className="h-4 w-px bg-white/10"></div>
               <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Zoom</span>
                  <div className="w-32 h-1 bg-white/10 rounded-full"></div>
               </div>
            </div>
            <div className="bg-orange-500/10 px-4 py-1 rounded-full border border-orange-500/20">
               <span className="text-[10px] font-black text-orange-400 tabular-nums">00:01:24:08</span>
            </div>
         </header>
         
         <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-[#131316]/20">
            <div className="min-w-[2000px] h-full flex flex-col relative">
               <div className="absolute top-0 bottom-0 left-[33%] w-px bg-orange-500/50 z-20"></div>
               
               {['Visual-1', 'Audio-1', 'Overlays'].map((track, i) => (
                 <div key={track} className="flex-1 border-b border-white/5 flex relative group">
                    <div className="w-32 bg-[#131316] border-r border-white/5 flex items-center px-4 shrink-0 z-10">
                       <span className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">{track}</span>
                    </div>
                    <div className="flex-1 relative flex items-center px-8">
                       {i === 0 && videoUrl && (
                         <div className="h-12 bg-orange-500/30 border border-orange-500/50 rounded-lg flex items-center px-4 w-[400px] cursor-move relative overflow-hidden">
                            <span className="text-[10px] font-black uppercase">AI_GEN_SCENE_01.mp4</span>
                            <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/20 cursor-ew-resize"></div>
                         </div>
                       )}
                       {i === 1 && (
                         <div className="h-8 bg-orange-500/20 border border-orange-500/30 rounded-lg flex items-center px-4 w-[600px] cursor-move">
                            <span className="text-[9px] font-black uppercase text-orange-400">Atmospheric_Background_Vibe.wav</span>
                         </div>
                       )}
                    </div>
                 </div>
               ))}
               
               {/* Time ruler */}
               <div className="h-6 bg-[#131316]/40 flex items-center px-32 gap-[100px]">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(s => (
                    <span key={s} className="text-[8px] font-mono text-zinc-600">00:00:0{s}:00</span>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default VideoEditorView;
