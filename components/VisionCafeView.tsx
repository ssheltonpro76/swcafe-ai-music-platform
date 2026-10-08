
import React, { useState, useEffect } from 'react';
import { generateVideo } from '../geminiService';

const VisionCafeView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'media' | 'effects' | 'audio'>('media');
  const [selectedImage, setSelectedImage] = useState<{ data: string, mimeType: string } | null>(null);
  
  // Layout State
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  
  // Property Sliders
  const [properties, setProperties] = useState({
    opacity: 100,
    scale: 100,
    rotation: 0,
    motionFlow: 75
  });

  const [genStep, setGenStep] = useState<string>('');
  const loadingMessages = [
    "Initializing neural cafe...",
    "Dreaming up cinematic frames...",
    "Brewing visual textures...",
    "Perfecting temporal flow...",
    "Serving your vision..."
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
    if (!prompt && !selectedImage) return alert('What should the Vision Cafe create for you? Provide a prompt or a starting image.');
    
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        alert('Vision Cafe requires a selected API key for high-fidelity generation.');
        await window.aistudio.openSelectKey();
      }
    }

    setIsGenerating(true);
    setVideoUrl(null);

    try {
      const url = await generateVideo(prompt, aspectRatio, selectedImage || undefined);
      setVideoUrl(url);
    } catch (e: any) {
      if (e.message?.includes("Requested entity was not found")) {
        alert("API Key error. Please re-select your key from a paid GCP project.");
        await window.aistudio.openSelectKey();
      } else {
        alert('The cafe is currently over capacity. Please try again in a moment.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage({
          data: reader.result as string,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const updateProp = (key: keyof typeof properties, val: number) => {
    setProperties(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-700 font-['Inter']">
      {/* Top Controls Bar */}
      <div className="flex justify-between items-center px-4">
        <div className="flex items-center gap-4">
          <span className="text-2xl">🎬</span>
          <div className="space-y-0.5">
            <h2 className="text-xl font-semibold uppercase tracking-tight italic">Vision <span className="text-orange-400">Cafe</span></h2>
            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-tight">Neural Creative Suite</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsLibraryOpen(!isLibraryOpen)} 
            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isLibraryOpen ? 'bg-white/10 text-white' : 'bg-orange-500/10 text-orange-400'}`}
          >
            {isLibraryOpen ? '◀ Library' : '▶ Library'}
          </button>
          <button 
            onClick={() => setIsPropertiesOpen(!isPropertiesOpen)} 
            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isPropertiesOpen ? 'bg-white/10 text-white' : 'bg-orange-500/10 text-orange-400'}`}
          >
            {isPropertiesOpen ? 'Properties ▶' : 'Properties ◀'}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex gap-6 min-h-0 relative">
        
        {/* Left: ASSET LIBRARY */}
        <div className={`transition-all duration-300 ease-in-out bg-[#131316] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl ${isLibraryOpen ? 'w-[320px]' : 'w-0 border-none'}`}>
          <div className="min-w-[320px] flex flex-col h-full">
            <header className="p-8 border-b border-white/5 space-y-6 bg-[#131316]/20">
              <h3 className="text-sm font-semibold tracking-tight uppercase text-zinc-500">Asset Library</h3>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                {(['media', 'effects', 'audio'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-gradient-to-r from-orange-500 to-red-600 text-black shadow-black/40' : 'text-zinc-500 hover:text-white'}`}>{tab}</button>
                ))}
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Starting Image</label>
                {selectedImage ? (
                  <div className="relative group rounded-2xl overflow-hidden border border-white/10 aspect-video">
                    <img src={selectedImage.data} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-[10px] hover:bg-red-600 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="w-full flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-white/5 rounded-3xl text-slate-500 hover:text-white transition-all bg-white/[0.01] cursor-pointer hover:bg-white/[0.03]">
                    <span className="text-2xl">📸</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Upload Base Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Aspect Ratio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setAspectRatio('16:9')}
                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${aspectRatio === '16:9' ? 'bg-gradient-to-r from-orange-500 to-red-600 border-transparent text-white shadow-lg' : 'bg-[#131316]/40 border-white/5 text-zinc-500 hover:text-white'}`}
                  >
                    16:9
                  </button>
                  <button 
                    onClick={() => setAspectRatio('9:16')}
                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${aspectRatio === '9:16' ? 'bg-gradient-to-r from-orange-500 to-red-600 border-transparent text-white shadow-lg' : 'bg-[#131316]/40 border-white/5 text-zinc-500 hover:text-white'}`}
                  >
                    9:16
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Cinematic Preview & Prompt Hub */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex-1 bg-black rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl relative group min-h-0">
            {isGenerating ? (
              <div className="absolute inset-0 z-20 bg-[#0a0a0a]/95 flex flex-col items-center justify-center p-12 text-center space-y-10">
                <div className="w-24 h-24 border-4 border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
                <p className="text-xl font-black uppercase tracking-widest text-white italic">{genStep}</p>
              </div>
            ) : videoUrl ? (
              <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-20 opacity-30 group-hover:opacity-50 transition-opacity">
                <span className="text-[10rem] mb-8 grayscale">🎥</span>
                <h3 className="text-3xl font-black uppercase tracking-[0.3em] italic">Ready to Render</h3>
              </div>
            )}
          </div>

          {/* Prompt Hub */}
          <div className="bg-[#131316] p-10 rounded-[3rem] border border-white/5 flex flex-col gap-6 shadow-2xl">
             <div className="flex gap-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Cinematic drone shot of a neon cyberpunk sprawl at midnight..."
                  className="flex-1 h-28 bg-[#131316]/40 border border-white/10 rounded-3xl p-6 text-sm font-bold outline-none placeholder:text-zinc-800 resize-none transition-all shadow-inner"
                />
                <button onClick={handleGenerate} disabled={isGenerating} className="w-48 bg-white text-black font-black rounded-3xl text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl disabled:opacity-50">Generate AI Scene</button>
             </div>
          </div>
        </div>

        {/* Right: PROPERTIES & NEURAL PARAMETERS */}
        <div className={`transition-all duration-300 ease-in-out bg-[#131316] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl ${isPropertiesOpen ? 'w-[320px]' : 'w-0 border-none'}`}>
          <div className="min-w-[320px] flex flex-col h-full">
            <header className="p-8 border-b border-white/5 bg-[#131316]/20">
              <h3 className="text-sm font-semibold tracking-tight uppercase text-zinc-500">Properties</h3>
            </header>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-12">
              <section className="space-y-8">
                {[
                  { label: 'Opacity', key: 'opacity', min: 0, max: 100, unit: '%' },
                  { label: 'Scale', key: 'scale', min: 10, max: 200, unit: '%' }
                ].map(item => (
                  <div key={item.key} className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500"><span>{item.label}</span><span className="text-white">{(properties as any)[item.key]}{item.unit}</span></div>
                    <input type="range" min={item.min} max={item.max} value={(properties as any)[item.key]} onChange={(e) => updateProp(item.key as any, parseInt(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-orange-500" />
                  </div>
                ))}
              </section>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        input[type=range] { -webkit-appearance: none; background: transparent; }
        input[type=range]:focus { outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; background: white; border: 3px solid #3b82f6; border-radius: 50%; cursor: pointer; margin-top: -8px; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 2px; background: rgba(255,255,255,0.1); border-radius: 1px; }
      `}</style>
    </div>
  );
};

export default VisionCafeView;
