import React, { useState, useEffect } from 'react';
import { SavedSong } from '../songs';

interface CarPlayViewProps {
  onPlay: (title: string, artist: string, cover: string) => void;
}

export const CarPlayView: React.FC<CarPlayViewProps> = ({ onPlay }) => {
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [activeCarTab, setActiveCarTab] = useState<'dashboard' | 'music' | 'maps' | 'settings'>('dashboard');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCarTrack, setCurrentCarTrack] = useState<SavedSong | null>(null);
  const [systemLogs, setSystemLogs] = useState<string[]>(['CarPlay Engine initialized.', 'Bluetooth synced with SwCafe iOS.']);

  useEffect(() => {
    const saved = localStorage.getItem('swcafe_song_library');
    if (saved) {
      const parsed: SavedSong[] = JSON.parse(saved);
      setSongs(parsed);
      if (parsed.length > 0) {
        setCurrentCarTrack(parsed[0]);
      }
    }
  }, []);

  const addLog = (msg: string) => {
    setSystemLogs(prev => [msg, ...prev.slice(0, 4)]);
  };

  const handlePlaySong = (song: SavedSong) => {
    setCurrentCarTrack(song);
    setIsPlaying(true);
    onPlay(song.title, 'SwCafe Studio', `https://picsum.photos/seed/${song.coverId}/200/200`);
    addLog(`Streaming "${song.title}" directly from CarPlay Dashboard.`);
  };

  const handleTogglePlay = () => {
    if (!currentCarTrack) return;
    setIsPlaying(!isPlaying);
    addLog(isPlaying ? 'Playback paused via car console.' : `Stream resumed: "${currentCarTrack.title}".`);
  };

  const formattedTime = () => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-10 animate-in fade-in duration-500 pb-32">
      <header className="space-y-4 text-left">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🚗</span>
          <h1 className="text-4xl font-semibold uppercase tracking-tight italic">
            Dashboard <span className="text-orange-400">Sync</span>
          </h1>
        </div>
        <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
          SwCafe is now fully compatible with <strong>Apple CarPlay</strong> and <strong>Android Auto</strong>. Try our interactive dashboard simulator below to preview your drive in real time.
        </p>
      </header>

      {/* Actual CarPlay Screen Simulator Frame */}
      <div className="rounded-[4rem] bg-[#0a0a0b] border-[14px] border-white/10 shadow-black/40 aspect-[16/9] w-full overflow-hidden flex relative select-none font-sans text-white">
        
        {/* Left Hand CarPlay Quick Selector Rail */}
        <div className="w-20 bg-[#131316] border-r border-white/5 flex flex-col justify-between items-center py-6 shrink-0 h-full">
          <div className="space-y-6 flex flex-col items-center">
            {/* Status Icons */}
            <span className="text-xs font-black tracking-tighter tabular-nums text-orange-400">{formattedTime()}</span>
            <div className="flex flex-col gap-1 items-center opacity-40">
              <span className="text-[10px]">📶</span>
              <span className="text-[10px]">🔋</span>
            </div>
          </div>

          {/* Core App Shortcuts */}
          <div className="flex flex-col gap-6 items-center flex-1 justify-center">
            <button 
              onClick={() => setActiveCarTab('dashboard')} 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${activeCarTab === 'dashboard' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-zinc-500'}`}
              title="Dashboard"
            >
              🔳
            </button>
            <button 
              onClick={() => setActiveCarTab('music')} 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${activeCarTab === 'music' ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-white/5 text-zinc-500'}`}
              title="Music"
            >
              🎵
            </button>
            <button 
              onClick={() => setActiveCarTab('maps')} 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${activeCarTab === 'maps' ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-white/5 text-zinc-500'}`}
              title="Navigation Map"
            >
              🗺️
            </button>
          </div>

          {/* CarPlay Home Button */}
          <button 
            onClick={() => setActiveCarTab('dashboard')} 
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-[8px] active:scale-95 transition-transform"
            title="Siri / Home"
          >
            ⚪
          </button>
        </div>

        {/* CarPlay Right Screen Container */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0a0b]">
          
          {/* CarPlay Dashboard Tab View */}
          {activeCarTab === 'dashboard' && (
            <div className="p-8 flex gap-6 h-full items-stretch animate-in zoom-in-95 duration-200">
              {/* Left Widget: Sleek Road Map */}
              <div className="flex-1 bg-[#1a1a1e]/60 rounded-[2rem] overflow-hidden border border-white/5 flex flex-col relative">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#131316]/20">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Roadmap GPS</span>
                  <span className="text-[10px] font-mono text-orange-400">SWCAFE HIGHWAY</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center bg-[#131316] relative overflow-hidden p-6 text-center">
                  {/* Grid Graphic simulation */}
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                  <div className="w-1 bg-white/10 h-full absolute left-1/2"></div>
                  <div className="w-4 h-4 bg-orange-500 rounded-full absolute top-1/2 left-[calc(50%-8px)] animate-ping"></div>
                  <div className="w-3 h-3 bg-orange-400 border border-white rounded-full absolute top-1/2 left-[calc(50%-6px)] shadow-xl"></div>
                  
                  <div className="relative z-10 space-y-1 mt-auto bg-[#1a1a1e]/80 p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] font-bold text-zinc-300">Turn left in 300 yards</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">towards SwCafe Studio Drive</p>
                  </div>
                </div>
              </div>

              {/* Right Widget Cluster: Media + Siri Shortcut */}
              <div className="w-80 flex flex-col gap-6">
                {/* Media Playback Widget Card */}
                <div className="flex-1 bg-[#1a1a1e] rounded-[2rem] border border-white/5 p-6 flex flex-col justify-between">
                  {currentCarTrack ? (
                    <div className="space-y-4 flex flex-col h-full justify-between">
                      <div className="flex items-center gap-4">
                        <img 
                          src={`https://picsum.photos/seed/${currentCarTrack.coverId}/150/150`} 
                          alt="C" 
                          className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/5" 
                        />
                        <div className="min-w-0 flex-1 text-left">
                          <h4 className="text-sm font-black truncate">{currentCarTrack.title}</h4>
                          <p className="text-[10px] text-zinc-400 truncate uppercase mt-0.5">{currentCarTrack.genre}</p>
                        </div>
                      </div>

                      {/* Native interface control simulator */}
                      <div className="flex items-center justify-between gap-4 bg-[#131316]/40 p-3 rounded-xl border border-white/5">
                        <button className="text-slate-400 hover:text-white">⏮</button>
                        <button 
                          onClick={handleTogglePlay}
                          className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
                        >
                          {isPlaying ? '⏸' : '▶'}
                        </button>
                        <button className="text-slate-400 hover:text-white">⏭</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <span className="text-3xl mb-2">📁</span>
                      <p className="text-xs text-zinc-500 font-bold uppercase">No tracks loaded</p>
                    </div>
                  )}
                </div>

                {/* Driving Calendar / Drive Assist */}
                <div className="bg-[#1a1a1e] rounded-[2rem] border border-white/5 p-5 flex items-center gap-4 text-left">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center text-xl">
                    📅
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black uppercase text-zinc-300">SwCafe Drive Mode</h5>
                    <p className="text-[9px] text-zinc-500 uppercase mt-0.5">Indemnification Fully Active</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CarPlay Music Tab View */}
          {activeCarTab === 'music' && (
            <div className="p-8 flex flex-col gap-6 h-full items-stretch animate-in slide-in-from-right-4 duration-200">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Library Sync</span>
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{songs.length} Tracks Available</span>
              </div>

              {/* Music Hub: Left is Playlist Selector, right is Active Song List to Browse */}
              <div className="flex gap-6 flex-1 overflow-hidden">
                
                {/* Left: drive playlist selector */}
                <div className="w-64 space-y-3 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-left px-1">Drive Curations</span>
                  
                  <div className="bg-[#1a1a1e] p-5 rounded-2xl border border-white/5 text-left space-y-2 flex-1 flex flex-col justify-between">
                     <div className="space-y-1">
                       <h5 className="text-lg font-black text-white italic">NEXT DRIVE PLAYLIST 🚘</h5>
                       <p className="text-[9px] text-zinc-400 leading-relaxed">Made specifically for your highway test run.</p>
                     </div>
                     <button 
                       onClick={() => {
                         if (songs.length > 0) handlePlaySong(songs[0]);
                       }}
                       className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-2 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest"
                     >
                       Stream Playlist
                     </button>
                  </div>
                </div>

                {/* Right: scrollable active library tracks */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[#131316] rounded-2xl border border-white/5 p-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 text-left px-1 mb-2">My Vault Stems</span>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {songs.length === 0 ? (
                      <p className="text-xs text-zinc-600 uppercase text-center py-10 font-bold">Generate songs on profile/studio first.</p>
                    ) : (
                      songs.map(song => (
                        <div 
                          key={song.id} 
                          onClick={() => handlePlaySong(song)}
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${currentCarTrack?.id === song.id ? 'bg-orange-500/10 border-orange-500/30 text-white' : 'bg-transparent border-transparent hover:bg-white/5 text-zinc-400'}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs">▶</span>
                            <div className="text-left min-w-0">
                              <h5 className="text-[11px] font-black truncate">{song.title}</h5>
                              <p className="text-[8px] uppercase font-bold text-slate-500 mt-0.5">{song.genre}</p>
                            </div>
                          </div>
                          <span className="text-[8px] font-black px-1.5 py-0.5 bg-white/10 rounded font-mono text-zinc-400 uppercase">{song.engine}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CarPlay Sleek Wireframe Road Maps Tab View */}
          {activeCarTab === 'maps' && (
            <div className="h-full relative overflow-hidden bg-[#0a0a0b] animate-in slide-in-from-right-4 duration-200">
               <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.06) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(16,185,129,0.06) 1.5px, transparent 1.5px)', backgroundSize: '25px 25px' }}></div>
               <div className="w-1.5 bg-slate-800 h-full absolute left-1/3"></div>
               <div className="h-1.5 bg-slate-800 w-full absolute top-2/3"></div>
               <div className="w-1 bg-[#a3e635] h-full absolute left-1/3 shadow-[0_0_10px_#a3e635]"></div>
               <div className="h-1 bg-[#a3e635] w-full absolute top-2/3 shadow-[0_0_10px_#a3e635]"></div>
               
               {/* Custom GPS marker */}
               <div className="absolute left-[33%] top-[45%] w-10 h-10 -ml-5 flex flex-col items-center">
                  <div className="w-4 h-4 bg-lime-400 border border-white rounded-full flex items-center justify-center animate-pulse shadow-lg">
                     <div className="w-1.5 h-1.5 bg-zinc-950 rounded-full"></div>
                  </div>
                  <span className="text-[8px] font-black bg-zinc-900 border border-zinc-700 text-lime-400 px-1 py-0.5 rounded shadow mt-1">DRIVING</span>
               </div>

               {/* Map overlay controls */}
               <div className="absolute left-6 top-6 max-w-xs space-y-4 bg-[#1a1a1e]/90 border border-white/5 backdrop-blur-md p-5 rounded-2xl text-left shadow-2xl">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase text-lime-400 tracking-wider">SUNO NAVIGATION</span>
                    <h5 className="text-xl font-black text-white">Scenic Studio Route</h5>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-semibold">Continuous loop testing on CarPlay simulator. Enjoy the drive.</p>
               </div>
            </div>
          )}

        </div>
      </div>

      {/* CarPlay Diagnostics / Drive Control Panel */}
      <section className="bg-[#131316] rounded-[2.5rem] border border-white/5 p-8 flex flex-col md:flex-row justify-between gap-8 h-full">
         <div className="space-y-4 flex-1 text-left">
            <h4 className="text-lg font-semibold uppercase tracking-tight">Consoles & CarPlay Activity</h4>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed font-medium">
               The simulator tracks Bluetooth connection and Native control events. Clicking buttons above synchronizes playback directly with your browser speaker and updates trace logs.
            </p>
         </div>

         <div className="w-full md:w-96 rounded-2xl bg-[#131316] p-5 font-mono text-[10px] text-zinc-400/80 space-y-2 border border-white/5 min-h-36 flex flex-col text-left">
            <span className="text-orange-400 font-bold uppercase pointer-events-none mb-1 text-[8px] tracking-widest">Active Connection Status</span>
            {systemLogs.map((log, i) => (
              <div key={i} className="truncate select-text">
                <span className="text-zinc-600">[{formattedTime()}]</span> {log}
              </div>
            ))}
         </div>
      </section>
    </div>
  );
};
