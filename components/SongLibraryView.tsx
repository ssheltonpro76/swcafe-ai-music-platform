
import React, { useState, useEffect, useRef } from 'react';
import ReplaceSectionView from './ReplaceSectionView';
import { RECALLED_SONGS, SavedSong } from '../songs';

interface SongLibraryViewProps {
  onReplaceSection?: (song: SavedSong) => void;
}

const SongLibraryView: React.FC<SongLibraryViewProps> = ({ onReplaceSection }) => {
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSong, setSelectedSong] = useState<SavedSong | null>(null);
  const [editingSong, setEditingSong] = useState<SavedSong | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const saveToStorage = (updatedSongs: SavedSong[]) => {
    setSongs(updatedSongs);
    localStorage.setItem('swcafe_song_library', JSON.stringify(updatedSongs));
  };

  const deleteSong = (id: string) => {
    if (window.confirm('Are you sure you want to remove this song from your studio archive?')) {
      const updated = songs.filter(s => s.id !== id);
      saveToStorage(updated);
      setMenuOpenId(null);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSong) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Video file is too large. Please keep it under 15MB for optimal studio performance.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const updatedSongs = songs.map(s => 
        s.id === editingSong.id ? { ...s, videoArt: base64 } : s
      );
      saveToStorage(updatedSongs);
      setEditingSong({ ...editingSong, videoArt: base64 });
      alert('Video Art synchronized with track!');
    };
    reader.readAsDataURL(file);
  };

  const filteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.genre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 animate-in fade-in duration-700 pb-32 relative">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-black uppercase tracking-tighter italic">Studio <span className="text-[#4facfe]">Archive</span></h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Vaulting your SwCafe v5.5 Generations</p>
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Real-Time Auto-Save Active</span>
            </div>
          </div>
        </div>
        <div className="w-full md:w-96 relative">
          <input 
            type="text" 
            placeholder="Search your library..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold outline-none focus:ring-2 focus:ring-[#4facfe] transition-all"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
        </div>
      </header>

      {filteredSongs.length === 0 ? (
        <div className="h-[500px] flex flex-col items-center justify-center bg-white/[0.02] border-2 border-dashed border-white/5 rounded-[3rem] text-center gap-6">
          <span className="text-8xl grayscale opacity-20">🎼</span>
          <div className="space-y-2">
            <h3 className="text-xl font-black uppercase text-slate-500">Your archive is empty</h3>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Generate songs in the Studio or Chujai Lab to begin vaulting.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredSongs.map((song) => (
            <div 
              key={song.id} 
              className="group bg-[#111] border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-[#4facfe]/50 transition-all shadow-2xl flex flex-col relative"
            >
              {/* Context Menu Button */}
              <button 
                onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === song.id ? null : song.id); }}
                className="absolute top-6 right-6 z-30 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"
              >
                <span className="text-xl leading-none -mt-2">...</span>
              </button>

              {/* Context Dropdown */}
              {menuOpenId === song.id && (
                <div className="absolute top-16 right-6 z-40 w-48 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <button onClick={() => { setEditingSong(song); setMenuOpenId(null); }} className="w-full px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Song Details</button>
                  <button 
                    onClick={() => { 
                      if (onReplaceSection) onReplaceSection(song);
                      setMenuOpenId(null);
                    }} 
                    className="w-full px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest hover:bg-[#FFE66D]/10 hover:text-[#FFE66D] transition-all border-b border-white/5"
                  >
                    Edit {' > '} Replace Section
                  </button>
                  <button onClick={() => { setSelectedSong(song); setMenuOpenId(null); }} className="w-full px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">View Lyrics</button>
                  <button onClick={() => deleteSong(song.id)} className="w-full px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all">Delete track</button>
                </div>
              )}

              <div className="aspect-[9/12] relative overflow-hidden cursor-pointer" onClick={() => setSelectedSong(song)}>
                {song.videoArt ? (
                  <video 
                    src={song.videoArt} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <img 
                    src={`https://picsum.photos/seed/${song.coverId}/600/600`} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100" 
                    alt={song.title} 
                    referrerPolicy="no-referrer"
                  />
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
                
                {song.videoArt && (
                  <div className="absolute top-6 left-6 flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 px-3 py-1 rounded-lg">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">V4 VIDEO ART</span>
                  </div>
                )}

                <div className="absolute bottom-8 left-8 right-8">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="bg-[#4facfe] text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest inline-block shadow-lg">
                      {song.engine}
                    </span>
                    <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider inline-flex items-center gap-1 shadow-md">
                      ✓ Auto-Saved
                    </span>
                  </div>
                  <h3 className="text-2xl font-black uppercase truncate text-white tracking-tighter mb-1">{song.title}</h3>
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span>{song.genre}</span>
                    <span>{new Date(song.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lyrics View Modal */}
      {selectedSong && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[#0f0f0f] w-full max-w-3xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div className="space-y-1">
                 <h3 className="text-2xl font-black uppercase tracking-tighter text-[#4facfe]">{selectedSong.title}</h3>
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{selectedSong.genre} • {selectedSong.engine}</p>
              </div>
              <button 
                onClick={() => setSelectedSong(null)} 
                className="text-slate-500 hover:text-white bg-white/5 p-4 rounded-full transition-all"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
              <div className="space-y-8">
                {selectedSong.theme && (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Conceptual Theme</p>
                    <p className="text-sm font-medium italic text-slate-300">"{selectedSong.theme}"</p>
                  </div>
                )}
                <div className="text-lg leading-loose italic text-slate-300 font-medium whitespace-pre-wrap">
                  {selectedSong.lyrics}
                </div>
              </div>
            </div>
            <footer className="p-8 border-t border-white/5 flex gap-4 bg-white/5">
                <button 
                  onClick={() => navigator.clipboard.writeText(selectedSong.lyrics)}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Copy to Clipboard
                </button>
                <button className="flex-1 bg-white text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl">
                  Open in DAW
                </button>
            </footer>
          </div>
        </div>
      )}

      {/* Song Details / Video Upload Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-[#0f0f0f] w-full max-w-4xl rounded-[3.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <header className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-[#FFE66D]">Media Settings</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic">{editingSong.title}</p>
                 </div>
                 <button 
                  onClick={() => setEditingSong(null)} 
                  className="text-slate-500 hover:text-white bg-white/5 p-4 rounded-full transition-all"
                >
                  ✕
                </button>
              </header>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-12">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Visual Preview */}
                    <div className="space-y-6">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Looping Art Preview</label>
                       <div className="aspect-[9/16] bg-black rounded-[2.5rem] border border-white/10 overflow-hidden relative shadow-inner group">
                          {editingSong.videoArt ? (
                             <video 
                              src={editingSong.videoArt} 
                              autoPlay 
                              loop 
                              muted 
                              className="w-full h-full object-cover"
                             />
                          ) : (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 opacity-30">
                                <span className="text-6xl mb-4">📹</span>
                                <p className="text-[10px] font-black uppercase tracking-widest">No Video Art Linked</p>
                             </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <button 
                              onClick={() => fileInputRef.current?.click()}
                              className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                             >
                               Replace Video
                             </button>
                          </div>
                       </div>
                    </div>

                    {/* Metadata & Upload */}
                    <div className="space-y-10">
                       <div className="space-y-6">
                          <h4 className="text-sm font-black uppercase tracking-widest text-white">Visual Synthesis</h4>
                          <p className="text-xs text-slate-500 leading-relaxed italic">
                            "Make your track come to life on web and mobile. Upload a looping video art piece to replace static covers."
                          </p>
                          <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                             <p className="text-[9px] font-black text-[#FFE66D] uppercase tracking-widest">Requirement Checklist</p>
                             <ul className="space-y-2">
                                <li className="text-[10px] text-slate-400 flex items-center gap-2"><span>✅</span> MP4 Format</li>
                                <li className="text-[10px] text-slate-400 flex items-center gap-2"><span>✅</span> 10 seconds or less</li>
                                <li className="text-[10px] text-slate-400 flex items-center gap-2"><span>✅</span> 9:16 Aspect Ratio</li>
                                <li className="text-[10px] text-slate-400 flex items-center gap-2"><span>✅</span> 720px Minimum Height</li>
                             </ul>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleVideoUpload} 
                            accept="video/mp4" 
                            className="hidden" 
                          />
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-[#4facfe] text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-[#4facfe]/20 hover:scale-[1.01] active:scale-95 transition-all"
                          >
                            Upload Video Art
                          </button>
                          {editingSong.videoArt && (
                            <button 
                              onClick={() => {
                                const updated = songs.map(s => s.id === editingSong.id ? { ...s, videoArt: undefined } : s);
                                saveToStorage(updated);
                                setEditingSong({ ...editingSong, videoArt: undefined });
                              }}
                              className="w-full py-4 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-all"
                            >
                              Remove Media
                            </button>
                          )}
                       </div>

                       <div className="pt-8 border-t border-white/5 space-y-4">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Display Title</label>
                            <input 
                              type="text" 
                              value={editingSong.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = songs.map(s => s.id === editingSong.id ? { ...s, title: val } : s);
                                saveToStorage(updated);
                                setEditingSong({ ...editingSong, title: val });
                              }}
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-bold focus:ring-1 focus:ring-[#FFE66D] outline-none"
                            />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <footer className="p-8 border-t border-white/5 bg-white/5 flex justify-end">
                  <button 
                    onClick={() => setEditingSong(null)}
                    className="bg-white text-black px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl"
                  >
                    Close Settings
                  </button>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
};

export default SongLibraryView;
