
import React, { useState } from 'react';
import { generateMusicAdvice, suggestLyricsChujai } from '../geminiService';

const MusicAI: React.FC = () => {
  const [advicePrompt, setAdvicePrompt] = useState('');
  const [adviceResponse, setAdviceResponse] = useState('');
  const [lyricTopic, setLyricTopic] = useState('');
  const [lyricGenre, setLyricGenre] = useState('Pop');
  const [lyricResponse, setLyricResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGetAdvice = async () => {
    if (!advicePrompt) return;
    setIsLoading(true);
    const res = await generateMusicAdvice(advicePrompt);
    setAdviceResponse(res);
    setIsLoading(false);
  };

  const handleGetLyrics = async () => {
    if (!lyricTopic) return;
    setIsLoading(true);
    // Corrected to use suggestLyricsChujai as exported from geminiService
    const res = await suggestLyricsChujai(lyricTopic, lyricGenre);
    setLyricResponse(res);
    setIsLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24 animate-in slide-in-from-bottom-10 duration-500">
      <header className="text-center space-y-4">
        <h1 className="text-5xl font-black bg-gradient-to-r from-emerald-400 to-blue-500 text-transparent bg-clip-text">Producer AI Assistant</h1>
        <p className="text-slate-400 text-lg">Harness the power of Gemini to refine your creative process.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Production Advice */}
        <div className="bg-slate-800/50 p-8 rounded-3xl border border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎹</span>
            <h2 className="text-xl font-bold">Ask a Producer</h2>
          </div>
          <p className="text-sm text-slate-400">Ask about mixing, compression, song structure, or gear advice.</p>
          <textarea 
            value={advicePrompt}
            onChange={(e) => setAdvicePrompt(e.target.value)}
            placeholder="e.g. How do I get my kick drum to punch through the mix?"
            className="w-full h-32 bg-slate-700/50 border border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
          <button 
            onClick={handleGetAdvice}
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? 'Thinking...' : 'Get Advice'}
          </button>
          {adviceResponse && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm leading-relaxed whitespace-pre-wrap">
              {adviceResponse}
            </div>
          )}
        </div>

        {/* Lyric Generator */}
        <div className="bg-slate-800/50 p-8 rounded-3xl border border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✍️</span>
            <h2 className="text-xl font-bold">Lyric Generator</h2>
          </div>
          <p className="text-sm text-slate-400">Overcome writer's block with AI-generated lyrics based on your theme.</p>
          <div className="space-y-4">
            <input 
              type="text"
              value={lyricTopic}
              onChange={(e) => setLyricTopic(e.target.value)}
              placeholder="Song topic (e.g. grace and devotion)"
              className="w-full bg-slate-700/50 border border-white/10 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select 
              value={lyricGenre}
              onChange={(e) => setLyricGenre(e.target.value)}
              className="w-full bg-slate-700/50 border border-white/10 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Pop</option>
              <option>Hip Hop</option>
              <option>Rock</option>
              <option>Electronic</option>
              <option>Lo-Fi</option>
              <option>Soul</option>
              <option>R&B</option>
              <option>Neo-soul</option>
              <option>Gospel</option>
              <option>Trap</option>
              <option>Trap-soul</option>
            </select>
          </div>
          <button 
            onClick={handleGetLyrics}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? 'Writing...' : 'Generate Lyrics'}
          </button>
          {lyricResponse && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm leading-relaxed italic whitespace-pre-wrap">
              {lyricResponse}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicAI;
