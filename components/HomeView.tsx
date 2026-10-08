
import React from 'react';
import { AI_GENERATORS } from '../constants';

interface HomeViewProps {
  onOpenVoice: () => void;
  onNavigate: (tab: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onOpenVoice, onNavigate }) => {
  return (
    <div className="space-y-12 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-20">
      {/* Featured Model Banner - SwCafe v5.5 Launch */}
      <section className="relative rounded-[3rem] overflow-hidden bg-gradient-to-br from-[#1a1a1e] via-[#131316] to-[#1a1a1e] border border-white/5 shadow-2xl p-1">
        <div className="bg-[#131316]/60 backdrop-blur-3xl rounded-[2.9rem] p-12 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="space-y-6 max-w-2xl text-left">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-black px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
              SwCafe v5.5 Launch 🚀
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight uppercase italic text-white font-sans">
              Our Best & Most <span className="text-orange-400">Personal Model Yet.</span>
            </h2>
            <div className="space-y-4">
              <p className="text-zinc-200 text-sm md:text-base leading-relaxed font-semibold font-sans">
                SwCafe v5.5 delivers richer arrangements, sharper vocals, and more dynamic sound across every single genre. 
              </p>
              <p className="text-zinc-400 text-xs leading-relaxed font-medium font-sans">
                Experience four game-changing features: <strong>Voices</strong> to sing on your creations with your own uploaded reference audio; <strong>Custom Models</strong> trained directly on your catalog; and <strong>My Taste</strong> which automatically applies your aesthetic signature whenever you use the Magic Wand.
              </p>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => onNavigate('song-creator')} className="bg-gradient-to-r from-orange-500 to-red-600 hover:bg-orange-400 text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl active:scale-95">
                Explore SwCafe v5.5 Creator
              </button>
            </div>
          </div>
          <div className="w-full lg:w-auto flex justify-center">
             <div className="relative w-60 h-60">
                <div className="absolute inset-0 bg-[#ff5e00] blur-[80px] opacity-25 animate-pulse"></div>
                <div className="relative bg-white/5 border border-white/10 rounded-[3rem] w-full h-full flex items-center justify-center text-[9rem] animate-in zoom-in-50 duration-1000">🧬</div>
             </div>
          </div>
        </div>
      </section>

      {/* CarPlay & Android Auto Featured Banner */}
      <section className="relative rounded-[3rem] overflow-hidden bg-gradient-to-br from-[#1a1a1e] to-[#131316] border border-white/5 shadow-2xl p-1">
        <div className="bg-[#131316] backdrop-blur-xl rounded-[2.9rem] p-10 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="flex-1 space-y-6 text-left">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚗</span>
              <div className="bg-orange-500/10 text-orange-400 border border-orange-500/25 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Car Integration</div>
            </div>
            <h2 className="text-4xl font-semibold tracking-tight uppercase italic text-white font-sans">SwCafe on Apple CarPlay & <span className="text-orange-400">Android Auto</span></h2>
            <p className="text-zinc-300 text-sm leading-relaxed max-w-2xl font-semibold font-sans">
              Stream songs directly from your in-car dashboard, browse your saved music library, and control playback inside your vehicle's native interface. We made a special drive playlist for your next cruise!
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => onNavigate('carplay')}
                className="bg-white hover:bg-neutral-200 text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                Launch CarPlay Simulator
              </button>
            </div>
          </div>
          <div className="hidden lg:flex gap-4">
             <div className="w-48 h-64 bg-[#1a1a1e] border border-white/5 shadow-inner rounded-3xl flex flex-col p-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent"></div>
                <span className="text-4xl mt-4">🗺️</span>
                <p className="text-xs font-black uppercase text-white mt-auto tracking-wider">HUD Maps Sync</p>
             </div>
             <div className="w-48 h-64 bg-[#1a1a1e] border border-white/5 shadow-inner rounded-3xl flex flex-col p-4 relative overflow-hidden group translate-y-6">
                <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent"></div>
                <span className="text-4xl mt-4">🎵</span>
                <p className="text-xs font-black uppercase text-white mt-auto tracking-wider font-sans">Direct Streaming</p>
             </div>
          </div>
        </div>
      </section>

      {/* Explore Refresh: Curated Playlists */}
      <section className="space-y-6 text-left">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧭</span>
            <div className="space-y-0.5">
              <h2 className="text-2xl font-semibold uppercase tracking-tight text-white font-sans">Explore Refresh</h2>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Discover personalized songs and curated drive mixes</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[#131316]/40 border border-white/5 rounded-3xl p-6 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start">
              <span className="text-3xl">🚘</span>
              <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">Drive Choice</span>
            </div>
            <h3 className="text-xl font-semibold uppercase tracking-tight text-white">Next Drive Mix</h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-semibold">Our premium, fine-tuned cruising compilation. Rich, spatial-audio arrangements built for the road.</p>
            <button onClick={() => onNavigate('carplay')} className="w-full bg-white/5 hover:bg-orange-500/15 text-orange-400 border border-white/5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">Test in CarPlay</button>
          </div>

          <div className="bg-[#131316]/40 border border-white/5 rounded-3xl p-6 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start">
              <span className="text-3xl">☕</span>
              <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">Trending</span>
            </div>
            <h3 className="text-xl font-semibold uppercase tracking-tight text-white">Sunday Coffee Lo-Fi</h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-semibold">Chilled loops, relaxed jazz progressions, and dusty drum matrixes for absolute calming comfort.</p>
            <button onClick={() => {
              alert('Streaming Sunday Coffee Lo-Fi...');
            }} className="w-full bg-white/5 hover:bg-orange-500/15 text-orange-400 border border-white/5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">Stream Mix</button>
          </div>

          <div className="bg-[#131316]/40 border border-white/5 rounded-3xl p-6 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start">
              <span className="text-3xl">🌌</span>
              <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">New Release</span>
            </div>
            <h3 className="text-xl font-semibold uppercase tracking-tight text-white">Synthwave Highway</h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-semibold">Retro-futuristic analog baselines, sweeping filters, and punching vocal textures from SwCafe v5.5.</p>
            <button onClick={() => {
              alert('Streaming Synthwave Highway...');
            }} className="w-full bg-white/5 hover:bg-orange-500/15 text-orange-400 border border-white/5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">Stream Mix</button>
          </div>
        </div>
      </section>

      {/* Supercharged v5.5 Tool Grid */}
      <section className="space-y-8 text-left">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <h2 className="text-2xl font-semibold uppercase tracking-tight text-white">Supercharged by v5.5</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Remaster Card */}
          <div onClick={() => onNavigate('remaster')} className="bg-[#131316]/40 rounded-[2.5rem] border border-white/5 p-8 space-y-4 hover:border-orange-500/30 transition-all cursor-pointer group shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-xl text-orange-400 group-hover:scale-110 transition-transform">✨</div>
            <h3 className="text-lg font-semibold uppercase tracking-tight text-white">Remaster</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Upgrade your existing tracks to professional v5.5 neural quality instantly.</p>
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest pt-2">v5.5 Ready</div>
          </div>

          {/* Lyrics by Chujai Card */}
          <div onClick={() => onNavigate('lyrics-chujai')} className="bg-[#131316]/40 rounded-[2.5rem] border border-white/5 p-8 space-y-4 hover:border-orange-500/30 transition-all cursor-pointer group shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform text-orange-400">📝</div>
            <h3 className="text-lg font-semibold uppercase tracking-tight text-white">Lyrics by Chujai</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Creative, higher-quality lyrics powered by our v5.5 creative writing engine.</p>
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest pt-2">v5.5 Optimized</div>
          </div>

          {/* Cover Art Card */}
          <div onClick={() => onNavigate('album-creator')} className="bg-[#131316]/40 rounded-[2.5rem] border border-white/5 p-8 space-y-4 hover:border-orange-500/30 transition-all cursor-pointer group shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform text-orange-400">🎨</div>
            <h3 className="text-lg font-semibold uppercase tracking-tight text-white">Cover Art</h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-sans">Fresh v5.5 neural designs to perfectly match your music’s aesthetic vibe.</p>
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest pt-2">Enhanced</div>
          </div>

          {/* Personas v4 Card */}
          <div onClick={onOpenVoice} className="bg-[#131316]/40 rounded-[2.5rem] border border-white/5 p-8 space-y-4 hover:border-orange-500/30 transition-all cursor-pointer group shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform text-orange-400">🎭</div>
            <h3 className="text-lg font-semibold uppercase tracking-tight text-white font-sans">Personas v5.5</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Capture a track’s voice and carry it into future SwCafe v5.5 projects.</p>
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest pt-2">v5.5 Match</div>
          </div>
        </div>
      </section>

      {/* Main Studio Access */}
      <section className="relative rounded-[2rem] overflow-hidden p-12 bg-gradient-to-br from-[#1a1a1e] to-[#0a0a0b] border border-white/5 shadow-2xl text-left">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-r from-orange-500 to-red-600 opacity-[0.03] blur-[100px] -mr-[200px] -mt-[200px]"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="space-y-6 max-w-xl">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Generative Audio Workstation</span>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight uppercase italic text-white font-sans">SwCafe Studio v5.5</h1>
            <p className="text-base text-zinc-400 leading-relaxed font-sans">
              Built for real experimentation, fast iteration, and pure fun. Whether starting from a prompt or building on existing songs.
            </p>
            <div className="flex gap-4">
              <button onClick={() => onNavigate('studio')} className="bg-gradient-to-r from-orange-500 to-red-600 text-black px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-xl active:scale-95">Launch DAW</button>
              <button onClick={() => onNavigate('covers')} className="bg-white/10 text-white px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest hover:scale-105 transition-all outline-none border border-white/5 active:scale-95">Covers (v5.5)</button>
            </div>
          </div>
          <div className="hidden lg:block w-[300px] h-[300px] relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-red-500 rounded-[3rem] rotate-6 opacity-20 blur-2xl font-sans"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-red-500 rounded-[3rem] animate-pulse shadow-2xl"></div>
          </div>
        </div>
      </section>

      {/* AI Voice Generators Preview */}
      <section>
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white font-sans">AI Voice Generators</h2>
          <button onClick={onOpenVoice} className="text-xs font-black uppercase tracking-widest text-orange-400 hover:opacity-80 font-sans">View Library</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {AI_GENERATORS.slice(0, 12).map((gen, i) => (
            <div key={gen} className="group cursor-pointer text-left">
              <div className="aspect-square bg-[#131316]/80 rounded-2xl border border-white/5 overflow-hidden mb-3 relative transition-all group-hover:border-orange-500/30 group-hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <img src={`https://picsum.photos/seed/${gen}/400/400`} alt={gen} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                <button className="absolute bottom-4 right-4 w-10 h-10 bg-gradient-to-r from-orange-500 to-red-600 text-black rounded-full flex items-center justify-center translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all shadow-xl">▶</button>
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-tight truncate px-1 text-zinc-200">{gen}</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-1 mt-0.5">V4 Engine</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomeView;
