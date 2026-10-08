
import React, { useState } from 'react';

interface PlayerProps {
  track: {
    title: string;
    artist: string;
    cover: string;
  };
}

const Player: React.FC<PlayerProps> = ({ track }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#07080c] border-t border-[#1e202b] px-8 flex items-center justify-between z-50 shadow-2xl select-none text-slate-200">
      {/* Left section: Track Info */}
      <div className="flex items-center gap-4 w-1/3">
        <div className="relative group cursor-pointer overflow-hidden rounded-xl">
          <img 
            src={track.cover} 
            alt="Cover" 
            className="w-14 h-14 object-cover shadow-md shadow-black/40 group-hover:scale-105 transition-transform duration-300" 
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <span className="text-xs">💿</span>
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-black tracking-tight truncate text-white hover:text-[#ff5e00] cursor-pointer transition-colors">
            {track.title}
          </h4>
          <p className="text-xs font-semibold text-slate-400 hover:text-slate-300 cursor-pointer truncate mt-0.5">
            {track.artist}
          </p>
        </div>
        <button 
          onClick={() => setIsLiked(!isLiked)} 
          className="ml-3 text-lg hover:scale-110 active:scale-90 transition-transform"
          title={isLiked ? 'Unlike' : 'Like'}
        >
          {isLiked ? '❤️' : '🤍'}
        </button>
      </div>

      {/* Middle section: Playback Controls */}
      <div className="flex flex-col items-center gap-2.5 w-1/3">
        <div className="flex items-center gap-6">
          <button className="text-slate-400 hover:text-white text-sm transition-colors" title="Shuffle">🔀</button>
          <button className="text-lg text-slate-400 hover:text-white transition-colors" title="Previous">⏮</button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-11 h-11 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 hover:bg-slate-100 transition-all active:scale-95 shadow-lg relative group overflow-hidden"
          >
            <span className="text-sm font-black select-none -mr-0.5 z-10">
              {isPlaying ? '⏸' : '▶'}
            </span>
            <div className="absolute inset-0 bg-gradient-to-tr from-[#ff5e00]/10 to-[#ffb700]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
          <button className="text-lg text-slate-400 hover:text-white transition-colors" title="Next">⏭</button>
          <button className="text-slate-400 hover:text-white text-sm transition-colors" title="Repeat">🔁</button>
        </div>
        <div className="w-full flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-tight tabular-nums text-slate-500">1:24</span>
          <div className="flex-1 h-1 bg-zinc-800 rounded-full cursor-pointer relative group">
            <div 
              className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#ff5e00] to-[#ff9100] w-[40%] rounded-full group-hover:shadow-[0_0_12px_rgba(255,94,0,0.6)]"
              style={{ transition: 'width 0.3s ease' }}
            ></div>
            <div className="absolute top-1/2 -translate-y-1/2 left-[40%] w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity"></div>
          </div>
          <span className="text-[10px] font-bold tracking-tight tabular-nums text-slate-500">3:45</span>
        </div>
      </div>

      {/* Right section: Master Volume & Display Toggles */}
      <div className="flex items-center justify-end gap-5 w-1/3">
        <button className="text-slate-400 hover:text-white transition-colors" title="Show Lyrics">🎙️ Lyrics</button>
        <button className="text-slate-400 hover:text-white transition-colors" title="Remix and Variation">🎚️ Remix</button>
        <div className="flex items-center gap-2 w-28">
          <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-white transition-colors">
            {isMuted ? '🔇' : '🔊'}
          </button>
          <div className="flex-1 h-1 bg-zinc-800 rounded-full cursor-pointer group relative">
            <div className={`h-full rounded-full bg-slate-400 group-hover:bg-[#ff5e00] transition-colors ${isMuted ? 'w-0' : 'w-[70%]'}`}></div>
            <div className={`absolute top-1/2 -translate-y-1/2 left-[70%] w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity ${isMuted && 'hidden'}`}></div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Player;
