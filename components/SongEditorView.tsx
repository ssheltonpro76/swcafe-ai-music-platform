
import React, { useState, useEffect, useRef } from 'react';
import { suggestLyricsChujai, generateMusicAdvice } from '../geminiService';
import { autoSaveSongToLibrary } from '../songs';

interface Generation {
  id: string;
  title: string;
  genre: string;
  lyrics: string;
  status: 'rendering' | 'ready' | 'error';
  progress: number;
  createdAt: string;
  coverId: number;
  engine: string;
  complexity: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const SONG_TAGS = [
  'INTRO', 'VERSE', 'PRE-CHORUS', 'CHORUS', 'HOOK', 
  'BRIDGE', 'RAP', 'BREAK', 'INSTRUMENTAL SOLO', 'OUTRO'
];

const SongEditorView: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'prompt' | 'chujai' | 'audio-hub' | 'assistant'>('prompt');
  const [isLabOpen, setIsLabOpen] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [style, setStyle] = useState('');
  const [title, setTitle] = useState('');
  const [complexity, setComplexity] = useState('Metaphoric');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);

  // Assistant State
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantLog, setAssistantLog] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantLog]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGenerations(prev => prev.map(gen => {
        if (gen.status === 'rendering' && gen.progress < 100) {
          const nextProgress = gen.progress + Math.random() * 12;
          return {
            ...gen,
            progress: nextProgress >= 100 ? 100 : nextProgress,
            status: nextProgress >= 100 ? 'ready' : 'rendering'
          };
        }
        return gen;
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if ((activeMode === 'chujai' || activeMode === 'prompt') && !style) return alert('Please enter a style.');
    setIsGenerating(true);
    let finalLyrics = lyrics;
    if (activeMode === 'prompt' && !lyrics) {
        finalLyrics = await suggestLyricsChujai(prompt, style || "Pop", complexity);
    }
    const newGen: Generation = {
      id: Math.random().toString(36).substr(2, 9),
      title: title || (activeMode === 'prompt' ? prompt.substring(0, 20) : 'Untitled Master'),
      genre: style || 'Neural Fusion',
      lyrics: finalLyrics,
      status: 'rendering',
      progress: 0,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coverId: Math.floor(Math.random() * 1000),
      engine: 'Chujai v4.2',
      complexity: complexity
    };

    // Auto-save every generated song directly to persistent Library
    autoSaveSongToLibrary({
      id: newGen.id,
      title: newGen.title,
      genre: newGen.genre,
      lyrics: newGen.lyrics,
      engine: newGen.engine,
      coverId: newGen.coverId
    });

    setGenerations(prev => [newGen, ...prev]);
    setIsGenerating(false);
  };

  const handleAssistantAsk = async () => {
    if (!assistantPrompt.trim()) return;
    setAssistantLog(prev => [...prev, { role: 'user', text: assistantPrompt }]);
    setAssistantPrompt('');
    setIsAsking(true);
    try {
      const response = await generateMusicAdvice(assistantPrompt);
      setAssistantLog(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (e) {
      setAssistantLog(prev => [...prev, { role: 'assistant', text: "Signal interruption." }]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="h-full flex gap-8 animate-in fade-in duration-700 overflow-hidden relative">
      {/* Toggle Handle */}
      <button 
        onClick={() => setIsLabOpen(!isLabOpen)}
        className={`absolute top-1/2 -translate-y-1/2 left-0 z-50 w-6 h-20 bg-[#111] border border-white/5 rounded-r-xl flex items-center justify-center text-[10px] hover:bg-white/5 transition-all shadow-2xl`}
      >
        {isLabOpen ? '◀' : '▶'}
      </button>

      {/* LEFT SIDEBAR: SONG LAB v4 CREATION HUB */}
      <aside className={`transition-all duration-300 ease-in-out bg-[#111] border border-white/5 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl relative ${isLabOpen ? 'w-[420px] p-8' : 'w-0 p-0 border-none'}`}>
        <div className="min-w-[356px] flex flex-col h-full">
          <header className="space-y-4">
            <h2 className="text-2xl font-black uppercase tracking-tighter italic">Song <span className="text-blue-500">Lab</span> v4</h2>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                {(['prompt', 'chujai', 'audio-hub', 'assistant'] as const).map((mode) => (
                  <button key={mode} onClick={() => setActiveMode(mode)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{mode}</button>
                ))}
            </div>
          </header>
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar mt-6 space-y-6">
            <div className="px-3 py-2 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-center justify-between text-left">
              <div className="flex items-center gap-1.5 font-bold text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Auto-Save Active</span>
              </div>
              <span className="text-[9px] text-emerald-400/80">Every song saved to Library</span>
            </div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Description..." className="w-full h-40 bg-black/40 border border-white/10 rounded-2xl p-5 text-sm outline-none" />
            <button onClick={handleCreate} disabled={isGenerating} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl shadow-xl text-xs uppercase tracking-[0.3em] disabled:opacity-50">Synthesize</button>
          </div>
        </div>
      </aside>

      {/* MAIN FEED */}
      <main className="flex-1 flex flex-col gap-6 overflow-hidden">
        <header className="flex items-center justify-between px-4">
          <div className="flex gap-8">
            <button className="text-sm font-black uppercase tracking-widest text-white border-b-2 border-blue-500 pb-2">Generation Feed</button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-32">
          {generations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center gap-6">
              <span className="text-6xl">🧬</span>
              <p className="text-xs font-bold uppercase tracking-widest">Workspace Empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-500">
              {generations.map((gen) => (
                <div key={gen.id} className="bg-[#111] border border-white/5 rounded-[2.5rem] p-6 flex gap-6 shadow-2xl">
                  <div className="w-40 h-40 rounded-[2rem] overflow-hidden shrink-0"><img src={`https://picsum.photos/seed/${gen.coverId}/400/400`} className="w-full h-full object-cover" /></div>
                  <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                    <h3 className="text-lg font-black uppercase truncate text-white">{gen.title}</h3>
                    <p className="text-[10px] text-blue-400 font-bold uppercase">{gen.genre}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SongEditorView;
