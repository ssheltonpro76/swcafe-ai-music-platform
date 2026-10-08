
import React, { useState, useEffect } from 'react';
import { RECALLED_SONGS, SavedSong } from '../songs';

const SongListView: React.FC = () => {
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSong, setSelectedSong] = useState<SavedSong | null>(null);

  useEffect(() => {
    const loadLibrary = () => {
      const saved = localStorage.getItem('swcafe_song_library');
      let currentSongs: SavedSong[] = [];
      if (saved) {
        try {
          currentSongs = JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
      
      // Add recalled songs if they aren't there yet
      const missingRecalled = RECALLED_SONGS.filter(rs => !currentSongs.some(s => s.id === rs.id));
      if (missingRecalled.length > 0) {
        const updated = [...missingRecalled, ...currentSongs];
        setSongs(updated);
        localStorage.setItem('swcafe_song_library', JSON.stringify(updated));
      } else {
        setSongs(currentSongs);
      }
    };

    loadLibrary();

    const handleUpdate = () => {
      loadLibrary();
    };
    window.addEventListener('swcafe_library_updated', handleUpdate);
    return () => window.removeEventListener('swcafe_library_updated', handleUpdate);
  }, []);

  const filteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.engine.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.genre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">Song <span className="text-blue-500">List</span></h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Integrated Recall System v4.0</p>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Auto-Save Active</span>
            </div>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <input 
            type="text" 
            placeholder="Search generations..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:border-blue-500 transition-all"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
        </div>
      </header>

      <div className="bg-[#111] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/5">
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Track Details</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Genre</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Engine</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-12">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSongs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center">
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">No songs found in the vault.</p>
                </td>
              </tr>
            ) : (
              filteredSongs.map((song) => (
                <tr key={song.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                        <img src={`https://picsum.photos/seed/${song.coverId}/100/100`} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase tracking-tight text-white truncate">{song.title}</p>
                        <p className="text-[9px] text-slate-500 font-bold truncate max-w-[200px]">{song.theme || 'No theme specified'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-3 py-1 rounded-md">{song.genre}</span>
                  </td>
                  <td className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-blue-400">
                    <div className="flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                       {song.engine}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right pr-12">
                    <button 
                      onClick={() => setSelectedSong(song)}
                      className="px-6 py-2 bg-white text-black rounded-lg text-[9px] font-black uppercase tracking-widest transition-all opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 shadow-xl"
                    >
                      Recall Asset
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recall Modal */}
      {selectedSong && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#111] w-full max-w-2xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <header className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase tracking-tighter text-blue-500">{selectedSong.title}</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic">{selectedSong.engine} • {selectedSong.genre}</p>
              </div>
              <button 
                onClick={() => setSelectedSong(null)} 
                className="text-slate-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                {selectedSong.theme && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Theme Intelligence</p>
                    <p className="text-xs italic text-slate-300">"{selectedSong.theme}"</p>
                  </div>
                )}
                <div className="text-base leading-relaxed text-slate-300 italic whitespace-pre-wrap font-medium">
                  {selectedSong.lyrics}
                </div>
              </div>
            </div>
            <footer className="p-6 border-t border-white/5 bg-white/[0.02] flex gap-4">
               <button 
                 onClick={() => {
                   navigator.clipboard.writeText(selectedSong.lyrics);
                   setSelectedSong(null);
                 }}
                 className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
               >
                 Copy Lyrics
               </button>
               <button 
                onClick={() => setSelectedSong(null)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg"
               >
                 Close Archive
               </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongListView;
