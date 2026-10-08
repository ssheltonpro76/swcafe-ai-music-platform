
import React, { useState } from 'react';

const CoversView: React.FC = () => {
  const [source, setSource] = useState('');
  const [targetStyle, setTargetStyle] = useState('80s Retro');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generated, setGenerated] = useState(false);

  const styles = ['80s Retro', 'Modern Trap', 'Acoustic Soul', 'Lofi Hip Hop', 'Epic Orchestral', 'Cyberpunk'];

  const handleReimagine = () => {
    if (!source) return alert('Enter a song to reimagine.');
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setGenerated(true);
    }, 3500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500 pb-32">
      <header className="text-center space-y-4">
        <h1 className="text-5xl font-semibold tracking-tight italic bg-gradient-to-r from-orange-500 to-red-600 text-transparent bg-clip-text">🎶 Covers v4</h1>
        <p className="text-zinc-400 text-lg uppercase tracking-widest font-black">Reimagine originals in new neural styles</p>
      </header>

      <div className="bg-[#131316] rounded-[3rem] border border-white/5 p-12 space-y-10 shadow-2xl relative">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Original Track / Vibe</label>
               <input 
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. Bohemian Rhapsody..."
                  className="w-full bg-[#131316] border border-white/10 rounded-2xl p-6 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
               />
            </div>
            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Target Style v4</label>
               <select 
                  value={targetStyle}
                  onChange={(e) => setTargetStyle(e.target.value)}
                  className="w-full bg-[#131316] border border-white/10 rounded-2xl p-6 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
               >
                  {styles.map(s => <option key={s}>{s}</option>)}
               </select>
            </div>
         </div>

         <button 
            onClick={handleReimagine}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 py-6 rounded-3xl font-black text-xs uppercase tracking-[0.4em] text-white shadow-xl shadow-black/40 hover:scale-[1.01] transition-all disabled:opacity-50"
         >
            {isProcessing ? 'Stylizing Neural Stems...' : 'Reimagine Now'}
         </button>

         {isProcessing && (
           <div className="flex flex-col items-center gap-6 py-10 animate-pulse">
              <div className="flex gap-2 h-12">
                 {[0.1, 0.3, 0.5, 0.2, 0.4].map(d => <div key={d} className="w-2 bg-orange-500 rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${d}s` }}></div>)}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Harmonizing styles...</p>
           </div>
         )}

         {generated && (
            <div className="animate-in zoom-in-95 duration-700 bg-white/5 rounded-[2.5rem] border border-white/5 p-10 flex flex-col md:flex-row items-center gap-8">
               <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-6xl shadow-2xl">📀</div>
               <div className="flex-1 space-y-4 text-center md:text-left">
                  <h3 className="text-2xl font-black uppercase">{source} <span className="text-zinc-500 font-medium">({targetStyle})</span></h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Neural Cover v4 Generated Successfully</p>
                  <div className="flex gap-3 justify-center md:justify-start">
                     <button className="bg-white text-black px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Preview</button>
                     <button className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Download</button>
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default CoversView;
