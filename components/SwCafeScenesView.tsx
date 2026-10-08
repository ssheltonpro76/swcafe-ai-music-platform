
import React, { useState, useRef } from 'react';
import { generateSoundtrackFromMedia } from '../geminiService';

const SwCafeScenesView: React.FC = () => {
  const [mediaFile, setMediaFile] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (event) => {
      setMediaFile(event.target?.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const runSynestheticScan = async () => {
    if (!mediaFile || !mimeType) return;
    setIsScanning(true);
    try {
      const output = await generateSoundtrackFromMedia(mediaFile, mimeType, userPrompt);
      setResult(output);
    } catch (e) {
      alert('Neural sync failed. Please try a different memory.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleVaultToLibrary = () => {
    if (!result) return;
    
    // Attempt to extract title/genre from the markdown-like result
    const titleMatch = result.match(/Genre: (.*)\b/);
    const genre = titleMatch ? titleMatch[1] : 'Neural Scene';
    
    const newSong = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Scene: ' + genre.substring(0, 15),
      genre,
      lyrics: result,
      theme: 'Generated from visual scene',
      engine: 'SwCafe Scenes v1',
      createdAt: new Date().toISOString(),
      coverId: Math.floor(Math.random() * 1000)
    };

    const saved = localStorage.getItem('swcafe_song_library');
    const library = saved ? JSON.parse(saved) : [];
    localStorage.setItem('swcafe_song_library', JSON.stringify([newSong, ...library]));
    alert('Soundtrack blueprint vaulted to your Studio Archive!');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-semibold uppercase tracking-tight italic">SwCafe <span className="text-orange-300">Scenes</span></h1>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-tight">Visual Memory to Musical Blueprint</p>
        </div>
        <div className="flex bg-[#131316]/40 p-1 rounded-xl border border-white/5">
           <button className="px-6 py-2 rounded-lg bg-white/10 text-white text-[9px] font-black uppercase tracking-widest">Synesthetic Scan</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Media Capture & Scanner */}
        <div className="lg:col-span-5 space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[9/16] bg-black rounded-[3rem] border border-white/10 overflow-hidden relative shadow-2xl group cursor-pointer"
          >
            {mediaFile ? (
              <>
                {mimeType?.startsWith('video') ? (
                  <video src={mediaFile} autoPlay loop muted className="w-full h-full object-cover" />
                ) : (
                  <img src={mediaFile} className="w-full h-full object-cover" alt="Source" />
                )}
                
                {isScanning && (
                   <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent w-full absolute top-0 shadow-black/40 animate-scanline"></div>
                      <div className="absolute inset-0 bg-orange-500/5 animate-pulse"></div>
                   </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 space-y-6 opacity-30 group-hover:opacity-60 transition-all">
                <span className="text-8xl">📸</span>
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-widest">Upload Memory</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Photo or Video (max 10s recommended)</p>
                </div>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
          </div>

          <div className="bg-[#131316] p-8 rounded-[2.5rem] border border-white/5 space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Stylistic Direction (Optional)</label>
              <input 
                type="text"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="e.g. Make it sound like a space odyssey..."
                className="w-full bg-[#131316] border border-white/10 rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <button 
              onClick={runSynestheticScan}
              disabled={!mediaFile || isScanning}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-black py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-black/40 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30"
            >
              {isScanning ? 'Decoding Visual Data...' : 'Generate Soundtrack'}
            </button>
          </div>
        </div>

        {/* Right: Results Panel */}
        <div className="lg:col-span-7">
          <div className="bg-[#131316] min-h-[700px] rounded-[3.5rem] border border-white/5 p-12 relative flex flex-col shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[80px] -mr-32 -mt-32"></div>
            
            <header className="flex justify-between items-center mb-10 relative z-10">
               <h3 className="text-sm font-semibold tracking-tight uppercase text-zinc-500 flex items-center gap-3">
                 <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                 Neural Blueprint Output
               </h3>
               {result && (
                 <button 
                  onClick={handleVaultToLibrary}
                  className="bg-white text-black px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                 >
                   Vault to Library
                 </button>
               )}
            </header>

            <div className="flex-1 relative z-10">
              {isScanning ? (
                <div className="h-full flex flex-col items-center justify-center space-y-8 opacity-40">
                  <div className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                  <div className="text-center space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest">Translating colors to frequencies...</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase italic">Synesthetic Matrix Active</p>
                  </div>
                </div>
              ) : result ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-zinc-300 font-medium italic">
                    {result}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-10 text-center gap-10">
                   <span className="text-[12rem] grayscale">🎼</span>
                   <div className="space-y-2">
                      <p className="text-sm font-black uppercase tracking-[0.4em]">Awaiting Input</p>
                      <p className="text-[10px] font-bold text-zinc-600 uppercase">Upload a visual memory to begin the scan</p>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scanline {
          animation: scanline 2.5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default SwCafeScenesView;
