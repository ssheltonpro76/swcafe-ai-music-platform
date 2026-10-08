
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
    <footer className="fixed bottom-0 left-0 right-0 h-20 bg-[#0a0a0b]/95 backdrop-blur-md border-t border-white/5 px-6 flex items-center justify-between z-50 shadow-2xl select-none text-zinc-200">
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
          <h4 className="text-sm font-semibold tracking-tight truncate text-white hover:text-orange-400 cursor-pointer transition-colors">
            {track.title}
          </h4>
          <p className="text-xs font-medium text-zinc-400 hover:text-zinc-300 cursor-pointer truncate mt-0.5">
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
      <div className="flex flex-col items-center gap-2 w-1/3">
        <div className="flex items-center gap-6">
          <button className="text-zinc-500 hover:text-white text-sm transition-colors" title="Shuffle">🔀</button>
          <button className="text-lg text-zinc-400 hover:text-white transition-colors" title="Previous">⏮</button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-11 h-11 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-all active:scale-95 shadow-lg relative group overflow-hidden"
          >
            <span className="text-sm font-black select-none -mr-0.5 z-10">
              {isPlaying ? '⏸' : '▶'}
            </span>
          </button>
          <button className="text-lg text-zinc-400 hover:text-white transition-colors" title="Next">⏭</button>
          <button className="text-zinc-500 hover:text-white text-sm transition-colors" title="Repeat">🔁</button>
        </div>
        <div className="w-full flex items-center gap-3">
          <span className="text-[10px] font-medium tracking-tight tabular-nums text-zinc-500">1:24</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer relative group">
            <div 
              className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-orange-500 to-red-500 w-[40%] rounded-full"
              style={{ transition: 'width 0.3s ease' }}
            ></div>
            <div className="absolute top-1/2 -translate-y-1/2 left-[40%] w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity"></div>
          </div>
          <span className="text-[10px] font-medium tracking-tight tabular-nums text-zinc-500">3:45</span>
        </div>
      </div>

      {/* Right section: Master Volume & Display Toggles */}
      <div className="flex items-center justify-end gap-5 w-1/3">
        <button className="text-zinc-400 hover:text-white transition-colors" title="Show Lyrics">🎙️ Lyrics</button>
        <button className="text-zinc-400 hover:text-white transition-colors" title="Remix and Variation">🎚️ Remix</button>
        <div className="flex items-center gap-2 w-28">
          <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 hover:text-white transition-colors">
            {isMuted ? '🔇' : '🔊'}
          </button>
          <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative">
            <div className={`h-full rounded-full bg-zinc-400 group-hover:bg-orange-500 transition-colors ${isMuted ? 'w-0' : 'w-[70%]'}`}></div>
            <div className={`absolute top-1/2 -translate-y-1/2 left-[70%] w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity ${isMuted && 'hidden'}`}></div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Player;
