import React, { useState, useEffect } from 'react';
import { SavedSong, getSavedSongsWithRecalled } from '../songs';

interface ProfileViewProps {
  onPlay: (title: string, artist: string, cover: string) => void;
  onNavigate: (tab: string) => void;
}

interface UserProfile {
  username: string;
  bio: string;
  avatar: string;
  banner: string;
  socials: {
    twitter: string;
    spotify: string;
    soundcloud: string;
  };
}

interface PinnedSong {
  songId: string;
  caption: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onPlay, onNavigate }) => {
  const [profile, setProfile] = useState<UserProfile>({
    username: 'SoundAlchemist',
    bio: 'Independent electronic producer and synthesis explorer. Forging cinematic soundscapes powered by Chujai v4 & v5 Neural Engines.',
    avatar: 'https://picsum.photos/seed/useravatar/300/300',
    banner: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?auto=format&fit=crop&w=1200&q=80',
    socials: {
      twitter: 'https://twitter.com/alchemy_sound',
      spotify: 'https://spotify.com/artist/alchemy',
      soundcloud: 'https://soundcloud.com/alchemy'
    }
  });

  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [pinned, setPinned] = useState<PinnedSong[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string, name: string, description: string, songIds: string[] }[]>([]);
  
  // Customization Modals
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPinSelectorOpen, setIsPinSelectorOpen] = useState(false);
  
  // Profile Form States
  const [editUsername, setEditUsername] = useState(profile.username);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editTwitter, setEditTwitter] = useState(profile.socials.twitter);
  const [editSpotify, setEditSpotify] = useState(profile.socials.spotify);
  const [editSoundcloud, setEditSoundcloud] = useState(profile.socials.soundcloud);
  const [editBanner, setEditBanner] = useState(profile.banner);
  const [editAvatar, setEditAvatar] = useState(profile.avatar);

  // Pin Form States
  const [selectedSongToPin, setSelectedSongToPin] = useState<string>('');
  const [pinCaption, setPinCaption] = useState<string>('');

  useEffect(() => {
    // Load profile
    const savedProfile = localStorage.getItem('swcafe_profile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfile(parsed);
      setEditUsername(parsed.username);
      setEditBio(parsed.bio);
      setEditTwitter(parsed.socials.twitter);
      setEditSpotify(parsed.socials.spotify);
      setEditSoundcloud(parsed.socials.soundcloud);
      setEditBanner(parsed.banner);
      setEditAvatar(parsed.avatar);
    }

    // Load songs using centralized helper
    setSongs(getSavedSongsWithRecalled());

    const handleLibraryUpdate = () => {
      setSongs(getSavedSongsWithRecalled());
    };
    window.addEventListener('swcafe_library_updated', handleLibraryUpdate);

    // Load pinned
    const savedPinned = localStorage.getItem('swcafe_profile_pinned');
    if (savedPinned) {
      setPinned(JSON.parse(savedPinned));
    } else {
      // Default empty or pre-populate if library has items
      const initialPinned = [
        { songId: '3kings-throne-hearts', caption: '🔥 Latest collaboration with Chujai v4.2! R&B royalty.' },
        { songId: '3kings-zenith-alignment', caption: '🌌 Soulful alignment of keys & synths. Check out the bridge!' }
      ];
      setPinned(initialPinned);
      localStorage.setItem('swcafe_profile_pinned', JSON.stringify(initialPinned));
    }

    // Load playlists
    const savedPlaylists = localStorage.getItem('swcafe_profile_playlists');
    if (savedPlaylists) {
      setPlaylists(JSON.parse(savedPlaylists));
    } else {
      const initialPlaylists = [
        {
          id: 'playlist-drive',
          name: 'Next Drive Mix 🚘',
          description: 'Curated blend of lo-fi chill and deep arrangements tailored perfectly for your next highway cruise.',
          songIds: ['3kings-throne-hearts', 'alpha-neon-anchor', '3kings-zenith-alignment']
        },
        {
          id: 'playlist-chill',
          name: 'Late Night Chill ☕',
          description: 'Cozy melodies & late-night coffee shop vibes.',
          songIds: ['alpha-neon-anchor']
        }
      ];
      setPlaylists(initialPlaylists);
      localStorage.setItem('swcafe_profile_playlists', JSON.stringify(initialPlaylists));
    }

    return () => {
      window.removeEventListener('swcafe_library_updated', handleLibraryUpdate);
    };
  }, []);

  const handleSaveProfile = () => {
    const updated = {
      username: editUsername,
      bio: editBio,
      banner: editBanner,
      avatar: editAvatar,
      socials: {
        twitter: editTwitter,
        spotify: editSpotify,
        soundcloud: editSoundcloud
      }
    };
    setProfile(updated);
    localStorage.setItem('swcafe_profile', JSON.stringify(updated));
    setIsEditProfileOpen(false);
  };

  const handlePinSong = () => {
    if (!selectedSongToPin) return alert('Select a song to pin.');
    if (pinned.length >= 5) {
      return alert('You can only pin up to 5 tracks on your profile.');
    }
    const updated = [...pinned, { songId: selectedSongToPin, caption: pinCaption || 'Check out my remix!' }];
    setPinned(updated);
    localStorage.setItem('swcafe_profile_pinned', JSON.stringify(updated));
    setIsPinSelectorOpen(false);
    setSelectedSongToPin('');
    setPinCaption('');
  };

  const handleUnpinSong = (songId: string) => {
    const updated = pinned.filter(p => p.songId !== songId);
    setPinned(updated);
    localStorage.setItem('swcafe_profile_pinned', JSON.stringify(updated));
  };

  const getSongById = (id: string) => {
    return songs.find(s => s.id === id);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 animate-in fade-in duration-500 pb-32">
      {/* Banner and Avatar section with glass styling */}
      <section className="relative rounded-[3rem] overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl">
        <div className="h-64 md:h-80 w-full overflow-hidden relative">
          <img src={profile.banner} alt="Banner" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
          
          {/* CarPlay Callout */}
          <div className="absolute top-6 right-6 flex items-center gap-3">
            <button 
              onClick={() => onNavigate('carplay')} 
              className="bg-black/80 hover:bg-black backdrop-blur-md text-white border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all hover:scale-105"
            >
              🚗 CarPlay Dashboard
            </button>
          </div>
        </div>

        <div className="p-8 md:p-12 relative flex flex-col md:flex-row items-start md:items-end md:gap-10 -mt-24 md:-mt-32 z-10 w-full">
          <img src={profile.avatar} alt="Avatar" className="w-40 h-40 rounded-[2.5rem] border-[6px] border-zinc-950 object-cover shadow-2xl" />
          
          <div className="flex-1 space-y-4 pt-6 md:pt-0 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
              <div className="space-y-1">
                <h2 className="text-4xl font-black tracking-tighter uppercase italic">{profile.username}</h2>
                <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-400">
                  {profile.socials.twitter && <a href={profile.socials.twitter} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">🕊️ Twitter</a>}
                  {profile.socials.spotify && <a href={profile.socials.spotify} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">🎵 Spotify</a>}
                  {profile.socials.soundcloud && <a href={profile.socials.soundcloud} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">🔥 SoundCloud</a>}
                </div>
              </div>
              <button 
                onClick={() => setIsEditProfileOpen(true)}
                className="bg-white/10 hover:bg-white text-white hover:text-black border border-white/10 py-3 px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95"
              >
                Manage Profile
              </button>
            </div>
            
            <p className="text-slate-300 text-sm md:text-base leading-relaxed font-medium max-w-3xl">
              {profile.bio}
            </p>
          </div>
        </div>
      </section>

      {/* Grid of Pinned Favs & Playlists */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Pinned Favorites - Up to 5 tracks with captions */}
        <section className="lg:col-span-12 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📌</span>
              <div className="space-y-0.5">
                <h3 className="text-xl font-black uppercase tracking-tight">Pinned Favorites</h3>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Showcase & Remix Catalog (Max 5)</p>
              </div>
            </div>
            {pinned.length < 5 && (
              <button 
                onClick={() => setIsPinSelectorOpen(true)}
                className="bg-[#FF6B6B] hover:bg-[#ff5555] text-black px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
              >
                Pin Track
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {pinned.length === 0 ? (
              <div className="col-span-full h-44 flex flex-col items-center justify-center bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[2rem] text-slate-500 text-sm font-semibold uppercase tracking-widest p-6">
                No pinned favorites yet. Pin up to 5 tracks!
              </div>
            ) : (
              pinned.map((pin) => {
                const song = getSongById(pin.songId);
                if (!song) return null;
                return (
                  <div key={pin.songId} className="group bg-[#111] border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-[#FF6B6B]/40 transition-all shadow-xl flex flex-col relative h-[380px]">
                    <div className="flex-1 relative overflow-hidden group">
                      <img src={`https://picsum.photos/seed/${song.coverId}/400/400`} alt={song.title} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                      
                      {/* Play button */}
                      <button 
                        onClick={() => onPlay(song.title, 'SwCafe AI', `https://picsum.photos/seed/${song.coverId}/200/200`)}
                        className="absolute inset-0 m-auto w-14 h-14 bg-white text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-2xl"
                      >
                        <span className="text-xl">▶</span>
                      </button>

                      <button 
                        onClick={() => handleUnpinSong(pin.songId)}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 text-xs transition-colors"
                        title="Unpin track"
                      >
                        ✕
                      </button>

                      <div className="absolute bottom-4 left-4 right-4">
                        <span className="bg-white/10 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-[#FF6B6B] border border-white/10 mb-2 inline-block">
                          {song.engine}
                        </span>
                        <h4 className="text-sm font-black uppercase truncate text-white">{song.title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{song.genre}</p>
                      </div>
                    </div>

                    {/* Shared Caption / Remix Zone */}
                    <div className="p-5 bg-black/40 border-t border-white/5 h-24 flex flex-col justify-between">
                      <p className="text-xs italic text-slate-300 font-bold leading-normal line-clamp-2">
                        "{pin.caption}"
                      </p>
                      <button 
                        onClick={() => {
                          alert(`Remix engine initiated for track "${song.title}"`);
                          onNavigate('song-creator');
                        }}
                        className="w-full bg-white/5 hover:bg-[#FF6B6B]/20 text-[#FF6B6B] hover:text-white border border-[#FF6B6B]/20 rounded-xl py-1 px-3 text-[8px] font-black uppercase tracking-widest transition-all"
                      >
                        ⚡ Remix Track
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Playlists in Profile */}
        <section className="lg:col-span-12 space-y-6">
          <div className="flex items-center gap-3 px-2">
            <span className="text-2xl">💿</span>
            <div className="space-y-0.5">
              <h3 className="text-xl font-black uppercase tracking-tight">Profile Playlists</h3>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Next Drive Series & Curated Playlists</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {playlists.map((pl) => (
              <div key={pl.id} className="relative rounded-[2.5rem] bg-[#111] overflow-hidden border border-white/5 p-8 flex flex-col justify-between min-h-[220px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#4facfe]/10 border border-[#4facfe]/20 text-[#4facfe] px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                      {pl.songIds.length} Tracks
                    </span>
                    <span className="text-xs opacity-40">🎵 Playlist</span>
                  </div>
                  <h4 className="text-3xl font-black tracking-tighter uppercase italic text-white">{pl.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">{pl.description}</p>
                </div>

                <div className="pt-6 border-t border-white/5 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex -space-x-3">
                    {pl.songIds.slice(0, 3).map((sId, pathIdx) => {
                      const songObj = getSongById(sId);
                      const coverSeed = songObj ? songObj.coverId : Math.floor(Math.random() * 50);
                      return (
                        <div key={sId} className="w-8 h-8 rounded-full border-2 border-zinc-950 overflow-hidden shadow-lg bg-zinc-800">
                          <img src={`https://picsum.photos/seed/${coverSeed}/64/64`} alt="C" className="w-full h-full object-cover" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-4">
                    {pl.id === 'playlist-drive' && (
                      <button 
                        onClick={() => onNavigate('carplay')} 
                        className="bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        🚗 CarPlay Test
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        if (pl.songIds.length > 0) {
                          const firstSong = getSongById(pl.songIds[0]);
                          if (firstSong) {
                            onPlay(firstSong.title, 'SwCafe AI', `https://picsum.photos/seed/${firstSong.coverId}/200/200`);
                            alert(`Streaming playlist "${pl.name}" directly from dashboard...`);
                          }
                        }
                      }}
                      className="bg-white hover:bg-slate-100 text-black px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                      ▶ Stream Playlist
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[#0f0f0f] w-full max-w-2xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div className="space-y-1">
                 <h3 className="text-2xl font-black uppercase tracking-tighter text-[#4facfe]">Manage Profile</h3>
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Customize your SwCafe Presence</p>
              </div>
              <button 
                onClick={() => setIsEditProfileOpen(false)} 
                className="text-slate-500 hover:text-white bg-white/5 p-4 rounded-full transition-all"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Display Username</label>
                <input 
                  type="text" 
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-xs font-bold focus:ring-1 focus:ring-[#4facfe] outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Biography</label>
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full h-24 bg-black border border-white/10 rounded-xl p-4 text-xs font-bold focus:ring-1 focus:ring-[#4facfe] outline-none resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Avatar Image URL</label>
                <input 
                  type="text" 
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-xs font-bold focus:ring-1 focus:ring-[#4facfe] outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Cover Image URL</label>
                <input 
                  type="text" 
                  value={editBanner}
                  onChange={(e) => setEditBanner(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-xs font-bold focus:ring-1 focus:ring-[#4facfe] outline-none"
                />
              </div>

              <div className="pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-3"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Social Links</span></div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Twitter URL</label>
                  <input 
                    type="text" 
                    value={editTwitter}
                    placeholder="https://twitter.com/..."
                    onChange={(e) => setEditTwitter(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-[10px] font-bold outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">Spotify Artist URL</label>
                  <input 
                    type="text" 
                    value={editSpotify}
                    placeholder="https://spotify.com/artist/..."
                    onChange={(e) => setEditSpotify(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-[10px] font-bold outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">SoundCloud URL</label>
                  <input 
                    type="text" 
                    value={editSoundcloud}
                    placeholder="https://soundcloud.com/..."
                    onChange={(e) => setEditSoundcloud(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-[10px] font-bold outline-none"
                  />
                </div>
              </div>
            </div>
            <footer className="p-6 border-t border-white/5 bg-white/5 flex gap-4">
              <button 
                onClick={() => setIsEditProfileOpen(false)}
                className="flex-1 bg-white/10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile}
                className="flex-1 bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl"
              >
                Save Changes
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Pin Selector Modal */}
      {isPinSelectorOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[#0f0f0f] w-full max-w-lg rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div className="space-y-1">
                 <h3 className="text-2xl font-black uppercase tracking-tighter text-[#FF6B6B]">Pin Favorite Song</h3>
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Pin with static or custom caption</p>
              </div>
              <button 
                onClick={() => setIsPinSelectorOpen(false)} 
                className="text-slate-500 hover:text-white bg-white/5 p-4 rounded-full transition-all"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Select Track</label>
                <select 
                  value={selectedSongToPin}
                  onChange={(e) => setSelectedSongToPin(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-xs font-bold focus:ring-1 focus:ring-[#FF6B6B] outline-none"
                >
                  <option value="">-- Choose a Track --</option>
                  {songs.filter(s => !pinned.some(pin => pin.songId === s.id)).map(s => (
                    <option key={s.id} value={s.id}>{s.title} ({s.genre})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Caption / Notes</label>
                <input 
                  type="text" 
                  placeholder="e.g. 🔥 My favorite generation yet. Incredible vocal delivery!"
                  value={pinCaption}
                  onChange={(e) => setPinCaption(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-xs font-bold focus:ring-1 focus:ring-[#FF6B6B] outline-none"
                />
              </div>
            </div>
            <footer className="p-6 border-t border-white/5 bg-white/5 flex gap-4">
              <button 
                onClick={() => setIsPinSelectorOpen(false)}
                className="flex-1 bg-white/10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={handlePinSong}
                className="flex-1 bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl"
              >
                Pin to Profile
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
