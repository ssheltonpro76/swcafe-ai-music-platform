
import React, { useState } from 'react';
import { suggestLyricsChujai } from '../geminiService';

const LyricsReMiView: React.FC = () => {
  const [theme, setTheme] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [complexity, setComplexity] = useState('High');
  const [lyrics, setLyrics] = useState('');
  const [isWriting, setIsWriting] = useState(false);

  const handleSaveToLibrary = (lyricsToSave?: string) => {
    const finalLyrics = lyricsToSave || lyrics;
    if (!finalLyrics) return;
    
    const newSong = {
      id: Math.random().toString(36).substr(2, 9),
      title: theme.substring(0, 20) || 'Untitled Master',
      genre,
      lyrics: finalLyrics,
      theme,
      engine: 'ReMi v4.2',
      createdAt: new Date().toISOString(),
      coverId: Math.floor(Math.random() * 1000)
    };

    const saved = localStorage.getItem('swcafe_song_library');
    const library = saved ? JSON.parse(saved) : [];
    localStorage.setItem('swcafe_song_library', JSON.stringify([newSong, ...library]));
    console.log('Draft automatically vaulted to your Studio Archive!');
  };

  const handleWrite = async () => {
    if (!theme) return alert('Enter a theme for ReMi.');
    setIsWriting(true);
    setLyrics('');
    try {
      const res = await suggestLyricsChujai(theme, genre, complexity);
      setLyrics(res);
      // Automatically save to library
      handleSaveToLibrary(res);
    } catch (e) {
      alert('ReMi engine is cooling down.');
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500 pb-32">
      <header className="flex items-center justify-between">
         <div className="space-y-1">
            <h1 className="text-4xl font-semibold uppercase tracking-tight">Lyrics by <span className="text-orange-400 italic">Chujai v4</span></h1>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">Advanced Neural Songwriting Engine</p>
         </div>
         <div className="flex bg-[#131316] p-1 rounded-xl border border-white/5">
            {['Standard', 'Metaphoric', 'Deep'].map(mode => (
               <button key={mode} onClick={() => setComplexity(mode)} className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${complexity === mode ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}>
                  {mode}
               </button>
            ))}
         </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-4 space-y-8">
            <div className="bg-[#1a1a1e] p-8 rounded-[2.5rem] border border-white/5 space-y-6">
               <div className="space-y-3">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Song Theme</label>
                  <textarea 
                     value={theme}
                     onChange={(e) => setTheme(e.target.value)}
                     placeholder="e.g. The silence after a storm in a neon city..."
                     className="w-full h-32 bg-[#131316] border border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
               </div>
               <div className="space-y-3">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Musical Genre</label>
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-[#131316] border border-white/10 rounded-xl p-4 text-xs font-bold appearance-none outline-none">
                     {['Pop', 'Synth-wave', 'Trap-Soul', 'Indie Rock', 'R&B', 'Electronic', 'Gospel'].map(g => <option key={g}>{g}</option>)}
                  </select>
               </div>
               <button 
                  onClick={handleWrite}
                  disabled={isWriting}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-500 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-black/40 transition-all disabled:opacity-50"
               >
                  {isWriting ? 'Chujai is drafting...' : 'Generate with Chujai'}
               </button>
            </div>
            
            <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
               <h4 className="text-[10px] font-black uppercase text-orange-400 mb-4">Chujai Pro Tip</h4>
               <p className="text-xs text-zinc-500 leading-relaxed italic">"Try specifying an emotion like 'melancholy' or 'ecstatic' in your theme for better tonal mapping."</p>
            </div>
         </div>

         <div className="lg:col-span-8">
            <div className="bg-[#1a1a1e] min-h-[600px] rounded-[3rem] border border-white/5 p-12 relative flex flex-col shadow-2xl">
               <div className="absolute top-8 right-8 text-[9px] font-black text-orange-400 uppercase tracking-widest">v4 Output Console</div>
               {isWriting ? (
                 <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-40">
                    <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                    <p className="text-xs font-black uppercase tracking-widest animate-pulse">Consulting creative nodes...</p>
                 </div>
               ) : lyrics ? (
                 <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="text-lg leading-relaxed text-zinc-300 font-medium whitespace-pre-wrap italic">
                       {lyrics}
                    </div>
                    <div className="mt-12 flex gap-4 pt-8 border-t border-white/5">
                       <button className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest" onClick={() => navigator.clipboard.writeText(lyrics)}>Copy to Clipboard</button>
                       <button onClick={() => handleSaveToLibrary()} className="px-8 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all">Manual Save</button>
                    </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center opacity-10 text-center gap-6">
                    <span className="text-[10rem]">📝</span>
                    <p className="text-sm font-black uppercase tracking-[0.4em]">Draft Empty</p>
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default LyricsReMiView;
