import React, { useState, useEffect } from 'react';
import { suggestLyricsChujai, continueLyricsWithAI, polishLyricsWithAI } from '../geminiService';
import { autoSaveMultipleSongsToLibrary, autoSaveSongToLibrary, getSavedSongsWithRecalled, SavedSong } from '../songs';

interface SongCreatorViewProps {
  initialData?: {
    lyrics: string;
    title: string;
    genre: string;
  };
  onPlay?: (title: string, artist: string, cover: string) => void;
  onOpenLyricStudio?: () => void;
}

const SECTION_CHIPS = ['[Intro]', '[Verse 1]', '[Chorus]', '[Verse 2]', '[Bridge]', '[Drop]', '[Outro]'];

const SongCreatorView: React.FC<SongCreatorViewProps> = ({ initialData, onPlay, onOpenLyricStudio }) => {
  // Live Active Queue of Generations & Saved Library Items
  const [localLibrary, setLocalLibrary] = useState<SavedSong[]>([]);
  const [activeQueueItems, setActiveQueueItems] = useState<any[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);

  // Core Data State
  const [title, setTitle] = useState(initialData?.title || '');
  const [theme, setTheme] = useState('');
  const [genre, setGenre] = useState(initialData?.genre || 'alternativ, metalcore, atmospheric');
  const [lyrics, setLyrics] = useState(initialData?.lyrics || '');
  const [isCustom, setIsCustom] = useState(Boolean(initialData?.lyrics));
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isContinuingLyrics, setIsContinuingLyrics] = useState(false);

  // Search and Filter states for Center Workspace
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'liked'>('all');
  const [likedSongIds, setLikedSongIds] = useState<string[]>([]);

  // If initialData changes, update state
  useEffect(() => {
    if (initialData) {
      if (initialData.title) setTitle(initialData.title);
      if (initialData.genre) setGenre(initialData.genre);
      if (initialData.lyrics) {
        setLyrics(initialData.lyrics);
        setIsCustom(true);
      }
    }
  }, [initialData]);

  // Load local library on component mount
  const loadLocalLibrary = () => {
    const library = getSavedSongsWithRecalled();
    setLocalLibrary(library);
    if (library.length > 0 && !selectedTrackId) {
      setSelectedTrackId(library[0].id);
    }
  };

  useEffect(() => {
    loadLocalLibrary();

    const handleUpdate = () => {
      loadLocalLibrary();
    };
    window.addEventListener('swcafe_library_updated', handleUpdate);
    return () => window.removeEventListener('swcafe_library_updated', handleUpdate);
  }, []);

  // Sync memory on load
  useEffect(() => {
    const lastSession = localStorage.getItem('swcafe_song_creator_memory');
    if (lastSession && !initialData) {
      try {
        const parsed = JSON.parse(lastSession);
        if (parsed.theme && !theme) setTheme(parsed.theme);
        if (parsed.genre && !genre) setGenre(parsed.genre);
        if (parsed.title && !title) setTitle(parsed.title);
        if (parsed.lyrics && !lyrics) setLyrics(parsed.lyrics);
        if (parsed.isCustom !== undefined) setIsCustom(parsed.isCustom);
      } catch (err) {
        console.error("Memory parsing failed", err);
      }
    }
  }, []);

  // Save session state to localStorage
  useEffect(() => {
    const sessionData = {
      theme,
      genre,
      title,
      lyrics,
      isCustom
    };
    localStorage.setItem('swcafe_song_creator_memory', JSON.stringify(sessionData));
  }, [theme, genre, title, lyrics, isCustom]);

  const handleSaveToLibrary = (lyricsToSave?: string, titleToSave?: string, customGenre?: string) => {
    const finalLyrics = lyricsToSave || lyrics || "[Verse 1]\nI'm staring through a fractured glass again\nThe shadows outline paths of quiet pain\n\n[Chorus]\nIt hurts like hell to let you go";
    const finalTitle = titleToSave || title.trim() || 'Hurts Like Hell';
    const finalGenre = customGenre || genre;
    
    const saved = autoSaveSongToLibrary({
      title: finalTitle,
      genre: finalGenre,
      lyrics: finalLyrics,
      theme: theme || 'Created with SwCafe v5.5',
      engine: 'SwCafe v5.5'
    });

    setLocalLibrary(prev => [saved, ...prev.filter(x => x.id !== saved.id)]);
    setSelectedTrackId(saved.id);
    return saved;
  };

  const handleGenerate = async () => {
    const finalTheme = theme.trim() || 'A heavy metalcore atmospheric anthem about memories fading';
    const finalTitle = title.trim() || 'Hurts Like Hell';
    const finalGenre = genre || 'alternativ, metalcore, atmospheric';

    setIsProcessing(true);

    const itemId1 = Math.random().toString();
    const itemId2 = Math.random().toString();

    const displayTitle1 = `${finalTitle} (Mix Alpha)`;
    const displayTitle2 = `${finalTitle} (Mix Beta)`;

    setActiveQueueItems([
      { id: itemId1, title: displayTitle1, progress: 12, stage: 'Voicing acoustic backing...', genre: finalGenre, coverId: Math.floor(Math.random() * 1000) },
      { id: itemId2, title: displayTitle2, progress: 8, stage: 'Warming neural synthesizers...', genre: finalGenre, coverId: Math.floor(Math.random() * 1000) }
    ]);

    const progInt = setInterval(() => {
      setActiveQueueItems(prev => prev.map(item => ({
        ...item,
        progress: Math.min(item.progress + Math.floor(Math.random() * 15) + 8, 95),
        stage: item.progress > 75 ? 'Polishing vocal harmonics...' : item.progress > 40 ? 'Calibrating guitar stems...' : item.stage
      })));
    }, 600);

    try {
      const gLyrics = isCustom && lyrics.trim() ? lyrics : await suggestLyricsChujai(finalTheme, finalGenre);

      await new Promise(resolve => setTimeout(resolve, 2500));
      clearInterval(progInt);

      setLyrics(gLyrics);
      if (!title) setTitle(finalTitle);

      // Auto-save every generated track immediately to persistent Library & Archive
      const [track1, track2] = autoSaveMultipleSongsToLibrary([
        {
          title: displayTitle1,
          genre: finalGenre,
          lyrics: gLyrics,
          theme: finalTheme,
          engine: 'SwCafe v5.5'
        },
        {
          title: displayTitle2,
          genre: finalGenre,
          lyrics: gLyrics,
          theme: finalTheme,
          engine: 'SwCafe v5.5'
        }
      ]);

      setLocalLibrary(prev => [track1, track2, ...prev.filter(x => x.id !== track1.id && x.id !== track2.id)]);
      setSelectedTrackId(track1.id);

      setActiveQueueItems([]);
      setIsProcessing(false);

      setAutoSaveToast(`💾 Auto-saved: "${displayTitle1}" and "${displayTitle2}" vaulted to Library!`);
      setTimeout(() => setAutoSaveToast(null), 5500);

      if (track1 && onPlay) {
        onPlay(track1.title, 'SwCafe v5.5', `https://picsum.photos/seed/${track1.coverId}/200/200`);
      }
    } catch (e) {
      clearInterval(progInt);
      setActiveQueueItems([]);
      setIsProcessing(false);
      alert('Neural synthesis timed out. Reconnecting SwCafe servers...');
    }
  };

  // Quick tag insertion
  const handleInsertTag = (tag: string) => {
    setLyrics(prev => {
      if (!prev.trim()) return `${tag}\n`;
      return `${prev.trimEnd()}\n\n${tag}\n`;
    });
  };

  // AI Lyrics Auto-generate
  const handleAILyricsGen = async () => {
    const promptTopic = theme.trim() || title.trim() || 'Searching for hope in the dark';
    setIsGeneratingLyrics(true);
    try {
      const generated = await suggestLyricsChujai(promptTopic, genre, 'High');
      setLyrics(generated);
      if (!title.trim() && theme.trim()) {
        setTitle(theme.slice(0, 20));
      }
    } catch (err) {
      alert('AI lyric generator busy. Please try again.');
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  // AI Continue writing next section
  const handleAIContinue = async (section = 'Next Section') => {
    if (!lyrics.trim()) {
      alert('Write a few lines first for the AI to continue from!');
      return;
    }
    setIsContinuingLyrics(true);
    try {
      const continuation = await continueLyricsWithAI(lyrics, theme, genre, section);
      setLyrics(prev => `${prev.trimEnd()}\n\n${continuation.trim()}`);
    } catch (err) {
      alert('Co-writing node busy.');
    } finally {
      setIsContinuingLyrics(false);
    }
  };

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedSongIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Static fallback tracks lists if the library is empty
  const defaultTracks = [
    {
      id: 'def-1',
      title: 'Hurts Like Hell',
      genre: 'alternativ, metalcore, atmospheric',
      lyrics: `[Verse 1]\nI'm staring through a fractured glass again\nThe shadows outline paths of quiet pain\nOur heavy hearts they carry what remains\nUntil the silence washes out the stains\n\n[Chorus]\nIt hurts like hell to let you go\nInto the drafty, silent snow\nAnd hear the echo of a song\nWe tried to play, we got it wrong\n\n[Bridge]\nBut does the fire still burn inside your mind?\nOr is it ash, the kind we left behind?`,
      createdAt: new Date().toISOString(),
      coverId: 'metalcore',
      likesCount: 15,
      remixCount: 3,
      playCount: 104,
      engine: 'SwCafe v5.5'
    },
    {
      id: 'def-2',
      title: 'Neon Starlight',
      genre: 'cyberpunk, outrun, synthwave',
      lyrics: `[Intro]\n(Synthesizer arpeggio loop, 115bpm)\n\n[Verse 1]\nCruising down the grid at midnight glow\nChasing frequencies I used to know\nYour ghost is in the code of every street\nOur digital illusions incomplete\n\n[Chorus]\nNeon starlight, wash away the night\nPower up the grid, ignite the light\nAcross the neon skyscrapers we fly\nTwo electronic particles in the sky`,
      createdAt: new Date().toISOString(),
      coverId: 'synth',
      likesCount: 22,
      remixCount: 1,
      playCount: 140,
      engine: 'SwCafe v5.5'
    },
    {
      id: 'def-3',
      title: 'Campfire Harmonies',
      genre: 'organic, acoustic folk, cozy',
      lyrics: `[Verse 1]\nThe cedar logs are crackling warm and bright\nWe wear our woolen blankets in the night\nOne guitar playing keys of golden sun\nReminding us of days before we are done\n\n[Chorus]\nOoh, sing along under pine trees\nWhispering secrets to the cool breeze\nWe will hold this moment in our hands\nBefore the winter freezes up the lands`,
      createdAt: new Date().toISOString(),
      coverId: 'campfire',
      likesCount: 18,
      remixCount: 4,
      playCount: 92,
      engine: 'SwCafe v5.5'
    }
  ];

  const tracksToDisplay = localLibrary.length > 0 ? localLibrary : defaultTracks;

  // Search filter matching
  const filteredTracks = tracksToDisplay.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          track.genre.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeFilter === 'liked') {
      return matchesSearch && likedSongIds.includes(track.id);
    }
    return matchesSearch;
  });

  const activeSelectedTrack = filteredTracks.find(t => t.id === selectedTrackId) || filteredTracks[0] || defaultTracks[0];

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0b] text-white relative">
      
      {/* Real-time Auto-Save Toast Alert */}
      {autoSaveToast && (
        <div className="fixed top-5 right-6 z-50 bg-[#131316] border border-orange-500/50 text-orange-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-3 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"></span>
          <span>{autoSaveToast}</span>
          <button 
            onClick={() => setAutoSaveToast(null)} 
            className="ml-2 text-zinc-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dynamic 3-Column Studio layout wrapper */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        
        {/* ========================================================= */}
        {/* COLUMN 1: LEFT WORKBENCH PANEL                            */}
        {/* ========================================================= */}
        <div className="lg:col-span-3 border-r border-white/5 bg-[#131316] flex flex-col min-h-0">
          
          {/* Subtab selection headers (Simple vs Custom toggle) */}
          <div className="p-4 border-b border-zinc-950 flex gap-2">
            <button 
              onClick={() => setIsCustom(false)} 
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                !isCustom 
                  ? 'bg-white/10 text-orange-400 border border-orange-500/25' 
                  : 'bg-[#1a1a1e]/50 text-zinc-400 hover:text-white'
              }`}
            >
              Simple
            </button>
            <button 
              onClick={() => setIsCustom(true)} 
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                isCustom 
                  ? 'bg-white/10 text-orange-400 border border-orange-500/25' 
                  : 'bg-[#1a1a1e]/50 text-zinc-400 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Workbench scrollable options */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 text-left">
            
            {/* Auto-Save Persistence Status Indicator */}
            <div className="px-3 py-2 bg-orange-950/25 border border-orange-500/20 rounded-xl flex items-center justify-between text-left">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-300">Auto-Save: Active</span>
              </div>
              <span className="text-[9px] font-semibold text-orange-400/80">Every generation vaulted</span>
            </div>
            
            {/* Simple Prompt Input Or Custom Prompt theme */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Song Description</label>
              <textarea 
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. atmospheric alternative metalcore song backings with deep drums..."
                className="w-full h-28 bg-[#1a1a1e]/50 border border-white/5 hover:border-white/10 rounded-xl p-3 font-sans text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-all custom-scrollbar resize-none font-bold"
              />
            </div>

            {/* Style input & Quick Badges */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Styles of Music</label>
              <input 
                type="text" 
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="alternativ, metalcore, atmospheric"
                className="w-full bg-[#1a1a1e]/50 border border-white/5 hover:border-white/10 rounded-xl p-3 font-sans text-xs text-white focus:outline-none focus:border-orange-500/40 transition-all font-bold"
              />
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {['alternativ', 'metalcore', 'lofi beats', 'synthwave', 'rock', 'atmospheric'].map(pill => (
                  <button 
                    key={pill} 
                    onClick={() => {
                      if (genre.includes(pill)) return;
                      setGenre(genre ? `${genre}, ${pill}` : pill);
                    }}
                    className="bg-[#1a1a1e] text-zinc-400 hover:bg-white/10 hover:text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-white/5 transition-all"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>

            {/* Lyrics Editor Box (Only shown if Custom Mode is Active) */}
            {isCustom && (
              <div className="space-y-2.5 animate-in slide-in-from-bottom-2 bg-[#131316]/70 p-3 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>✍️</span> Custom Lyrics
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleAILyricsGen}
                      disabled={isGeneratingLyrics}
                      className="text-[9px] text-orange-400 hover:text-orange-300 font-black uppercase flex items-center gap-1 transition-all disabled:opacity-50"
                      title="Generate full lyrics using AI based on description and genre"
                    >
                      {isGeneratingLyrics ? '✨ Drafting...' : '✨ AI Generate'}
                    </button>
                    {onOpenLyricStudio && (
                      <button
                        onClick={onOpenLyricStudio}
                        className="text-[9px] text-zinc-400 hover:text-white font-bold uppercase transition-colors"
                        title="Open in full-screen Lyrics Studio"
                      >
                        Studio ↗
                      </button>
                    )}
                  </div>
                </div>

                {/* Section Tag Chips */}
                <div className="flex flex-wrap gap-1">
                  {SECTION_CHIPS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleInsertTag(tag)}
                      className="px-1.5 py-0.5 rounded bg-[#1a1a1e] hover:bg-gradient-to-r from-orange-500 to-red-600 text-zinc-400 hover:text-white text-[8px] font-black uppercase transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <textarea 
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="[Intro]\n(Pads building slowly...)\n\n[Verse 1]\nOur broken shadows meet again...\n\n[Chorus]\nIt hurts like hell to let you go..."
                  className="w-full h-44 bg-[#1a1a1e]/80 border border-white/10 hover:border-white/20 rounded-xl p-3 font-mono text-[10px] leading-relaxed text-zinc-200 focus:outline-none focus:border-orange-500/50 resize-none custom-scrollbar"
                />

                {/* Co-Writing & Extension Tools */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => handleAIContinue('Chorus')}
                    disabled={isContinuingLyrics}
                    className="flex-1 py-1.5 bg-[#1a1a1e] hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-wider border border-white/5 transition-all disabled:opacity-50"
                  >
                    + AI Chorus
                  </button>
                  <button
                    onClick={() => handleAIContinue('Verse 2')}
                    disabled={isContinuingLyrics}
                    className="flex-1 py-1.5 bg-[#1a1a1e] hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-wider border border-white/5 transition-all disabled:opacity-50"
                  >
                    + AI Verse 2
                  </button>
                  <button
                    onClick={() => handleAIContinue('Bridge')}
                    disabled={isContinuingLyrics}
                    className="flex-1 py-1.5 bg-[#1a1a1e] hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-wider border border-white/5 transition-all disabled:opacity-50"
                  >
                    + AI Bridge
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Workbench Title input & Create trigger footer */}
          <div className="p-4 bg-[#131316]/50 border-t border-white/5 space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-left block">Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Hurts Like Hell"
                className="w-full bg-[#1a1a1e] border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex gap-2 items-center">
              <button 
                onClick={() => {
                  setTitle('');
                  setLyrics('');
                  setTheme('');
                }}
                className="p-3 rounded-xl bg-[#1a1a1e] hover:bg-white/10 text-zinc-400 hover:text-white transition-colors border border-white/5"
                title="Reset active form"
              >
                🗑️
              </button>
              
              <button 
                onClick={handleGenerate}
                disabled={isProcessing}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-500 text-white font-black py-3 rounded-xl shadow-lg shadow-black/40 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
                    Synthesizing...
                  </span>
                ) : (
                  <>
                    <span>Create ♪</span>
                    <span className="text-[10px] text-white/70 font-black">10 🪙</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: CENTER BOARD (WORKSPACES LIST)                 */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 bg-[#1a1a1e] flex flex-col min-h-0">
          
          {/* Header Workspace Navigator */}
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#131316]/60">
            <div className="flex items-center gap-2 text-left">
              <span className="text-xs text-zinc-500 font-extrabold uppercase tracking-wider">Workspaces</span>
              <span className="text-xs text-zinc-400">/</span>
              <span className="text-xs text-white font-black uppercase tracking-wider">My Workspace</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-orange-400 bg-orange-950/40 border border-orange-500/25 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                <span>Auto-Saved Library ({localLibrary.length})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                <span>● v5.5 Neural</span>
              </div>
            </div>
          </div>

          {/* Quick search and view controls */}
          <div className="p-4 bg-[#131316]/20 flex flex-wrap gap-3 items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-zinc-500 text-sm">🔍</span>
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search songs or genres..."
                className="bg-transparent border-none text-xs text-zinc-200 outline-none w-full focus:ring-0 placeholder-zinc-600"
              />
            </div>

            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setActiveFilter('all')} 
                className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                  activeFilter === 'all' 
                    ? 'bg-white/10 text-white border border-white/5' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setActiveFilter('liked')} 
                className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                  activeFilter === 'liked' 
                    ? 'bg-white/10 text-orange-400 border border-orange-500/25' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Liked
              </button>
              
              <span className="h-4 w-px bg-white/10 mx-1"></span>
              
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Newest</span>
            </div>
          </div>

          {/* Generation Queue & Archived Track Feed box */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            
            {/* Live Synthesis / Generating State in Center panel */}
            {activeQueueItems.map(item => (
              <div key={item.id} className="bg-[#1a1a1e] border border-orange-500/20 rounded-xl p-4 relative overflow-hidden animate-in zoom-in-95 text-left">
                <div className="absolute top-0 left-0 bottom-0 bg-orange-500/5 transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#131316] border border-orange-500/20 rounded-lg flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin"></div>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{item.title}</h4>
                      <p className="text-[9px] text-orange-400 uppercase font-black tracking-widest mt-0.5">{item.stage}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black font-mono text-orange-400">{item.progress}%</span>
                  </div>
                </div>
                <div className="h-1 bg-[#131316] rounded-full overflow-hidden mt-3 border border-white/5 relative z-10">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-red-600 rounded-full transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                </div>
              </div>
            ))}

            {/* Empty Vault notification check */}
            {filteredTracks.length === 0 && (
              <div className="py-24 text-center space-y-3 opacity-30">
                <span className="text-4xl text-zinc-500 block">🎧</span>
                <p className="text-xs font-black uppercase text-zinc-400">Workspace Empty or No search match</p>
              </div>
            )}

            {/* List of track components */}
            <div className="space-y-3">
              {filteredTracks.map((track) => {
                const isActiveSel = track.id === activeSelectedTrack.id;
                const isLiked = likedSongIds.includes(track.id);
                
                return (
                  <div 
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`p-3.5 rounded-xl border flex flex-col cursor-pointer group transition-all text-left relative ${
                      isActiveSel 
                        ? 'bg-[#1a1a1e] border-orange-500/30 shadow-md shadow-black/40' 
                        : 'bg-[#0f0f12]/50 hover:bg-[#0f0f12]/90 border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Playable Cover */}
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#1a1a1e] border border-white/15 flex-shrink-0">
                          <img 
                            src={`https://picsum.photos/seed/${track.coverId || 'art'}/150/150`} 
                            alt="art" 
                            className="w-full h-full object-cover opacity-80"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onPlay) onPlay(track.title, track.engine || 'SwCafe v5.5', `https://picsum.photos/seed/${track.coverId || 'art'}/200/200`);
                            }}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="text-white text-xs">▶</span>
                          </button>
                        </div>

                        {/* Title & Styles details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-black text-white truncate max-w-[170px] sm:max-w-xs">{track.title}</h4>
                            <span className="text-[8px] bg-[#131316] text-zinc-400 px-1 py-0.5 rounded font-black uppercase italic whitespace-nowrap">
                              {track.engine || 'v5.5'}
                            </span>
                            <span className="text-[7.5px] bg-orange-950/80 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                              ✓ Auto-Saved
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-zinc-500 truncate mt-1">
                            {track.genre || 'alternativ, atmospheric'}
                          </p>
                        </div>
                      </div>

                      {/* Right side interactions */}
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0 select-none">
                        <button 
                          onClick={(e) => toggleLike(track.id, e)}
                          className={`text-sm py-1 px-1.5 rounded-md hover:bg-white/10 transition-colors ${
                            isLiked ? 'text-orange-400' : 'text-zinc-500'
                          }`}
                        >
                          {isLiked ? '❤️' : '🤍'}
                        </button>

                        <span className="text-[10px] text-zinc-500 font-bold font-mono min-w-[30px] text-right">
                          ▶ {track.playCount || Math.floor(Math.random() * 4) + 1}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Delete this track?")) {
                              const updated = localLibrary.filter(x => x.id !== track.id);
                              localStorage.setItem('swcafe_song_library', JSON.stringify(updated));
                              setLocalLibrary(updated);
                              if (selectedTrackId === track.id) setSelectedTrackId(updated[0]?.id || null);
                            }
                          }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors text-xs"
                          title="Delete track"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>

        {/* ========================================================= */}
        {/* COLUMN 3: RIGHT DETAIL BOARD (PLAYER & SCROLLING LYRICS)  */}
        {/* ========================================================= */}
        <div className="lg:col-span-3 bg-[#131316] border-l border-white/5 flex flex-col min-h-0 text-left">
          
          {/* Cover Art Banner with overlay statistics */}
          <div className="p-4 flex-shrink-0">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#1a1a1e] border border-white/5 shadow-2xl">
              <img 
                src={`https://picsum.photos/seed/${activeSelectedTrack?.coverId || 'metal'}/380/220`}
                alt="Selected cover" 
                className="w-full h-full object-cover opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10"></div>
              
              {/* Overlay play badges */}
              <div className="absolute bottom-3 left-3 flex gap-2">
                <span className="text-[8px] bg-black/60 backdrop-blur text-zinc-300 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  ▶ {activeSelectedTrack?.playCount || 104} Plays
                </span>
                <span className="text-[8px] bg-orange-500/25 backdrop-blur text-orange-400 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  👍 {activeSelectedTrack?.likesCount || 15} Likes
                </span>
              </div>

              {/* Central quick stream player control */}
              <button 
                onClick={() => {
                  if (onPlay && activeSelectedTrack) {
                    onPlay(activeSelectedTrack.title, `SwCafe v5.5`, `https://picsum.photos/seed/${activeSelectedTrack.coverId || 'metal'}/200/200`);
                  }
                }}
                className="absolute inset-0 m-auto h-12 w-12 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-xs scale-90 opacity-0 group-hover:opacity-100 transition-all hover:scale-100 flex items-center justify-center shadow-lg"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Heading Info */}
          <div className="px-4 pb-2 border-b border-white/5">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h2 className="text-base font-black text-white leading-snug uppercase tracking-tight">
                  {activeSelectedTrack?.title || 'Hurts Like Hell'}
                </h2>
                <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mt-0.5">
                  {activeSelectedTrack?.genre || 'alternativ, metalcore, atmospheric'}
                </p>
              </div>
              <button 
                onClick={() => {
                  if (activeSelectedTrack) {
                    setLyrics(activeSelectedTrack.lyrics);
                    setGenre(activeSelectedTrack.genre);
                    setTitle(`Remix - ${activeSelectedTrack.title}`);
                    alert(`Remix mapped to workbench!`);
                  }
                }}
                className="bg-[#1a1a1e] hover:bg-white/10 text-zinc-300 px-2 py-1.5 rounded-lg border border-white/5 text-[9px] font-black uppercase tracking-wider transition-all"
              >
                Remix
              </button>
            </div>
            
            {/* Style Influence stats block */}
            <div className="mt-3 bg-[#131316]/80 rounded-xl p-2.5 border border-white/5 space-y-2">
              <div className="flex justify-between text-[8px] font-black text-zinc-500 uppercase tracking-wide">
                <span>Influence Metrics</span>
                <span className="text-orange-400">v5.5 Calibrated</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#1a1a1e]/60 p-1 rounded border border-white/5">
                  <p className="text-[8px] text-zinc-500 uppercase">Style</p>
                  <p className="text-[9px] font-mono font-black text-white">86%</p>
                </div>
                <div className="bg-[#1a1a1e]/60 p-1 rounded border border-white/5">
                  <p className="text-[8px] text-zinc-500 uppercase">Audio</p>
                  <p className="text-[9px] font-mono font-black text-white">15%</p>
                </div>
                <div className="bg-[#1a1a1e]/60 p-1 rounded border border-white/5">
                  <p className="text-[8px] text-zinc-500 uppercase">Weird</p>
                  <p className="text-[9px] font-mono font-black text-white">9%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formatted Scrolling lyric sheet */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 text-xs leading-relaxed italic text-zinc-300 font-sans space-y-4">
            <div className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] not-italic mb-2">Lyric Feed</div>
            {activeSelectedTrack?.lyrics ? (
              activeSelectedTrack.lyrics.split('\n').map((line: string, i: number) => {
                const isHeading = line.startsWith('[');
                return (
                  <p 
                    key={i} 
                    className={`${
                      isHeading 
                        ? 'text-orange-400 font-black not-italic text-[10px] uppercase tracking-wider mt-4 mb-2' 
                        : 'text-zinc-300/90 hover:text-white transition-colors duration-200'
                    }`}
                  >
                    {line}
                  </p>
                );
              })
            ) : (
              <p className="text-zinc-600 italic">No lyrics mapped for this track.</p>
            )}
          </div>

        </div>

      </div>
      
    </div>
  );
};

export default SongCreatorView;
