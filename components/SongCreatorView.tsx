import React, { useState, useEffect, useRef } from 'react';
import { suggestLyricsChujai, continueLyricsWithAI, polishLyricsWithAI } from '../geminiService';
import { autoSaveSongToLibrary, getSavedSongsWithRecalled, SavedSong } from '../songs';

interface SongCreatorViewProps {
  initialData?: {
    lyrics: string;
    title: string;
    genre: string;
  };
  onPlay?: (title: string, artist: string, cover: string, audioUrl?: string) => void;
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
  const [genre, setGenre] = useState(initialData?.genre || 'alternative, metalcore, atmospheric');
  const [lyrics, setLyrics] = useState(initialData?.lyrics || '');
  const [isCustom, setIsCustom] = useState(Boolean(initialData?.lyrics));
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isContinuingLyrics, setIsContinuingLyrics] = useState(false);

  // Track length for the next generation (seconds). MusicGen bills by time,
  // and longer tracks take proportionally longer to compose.
  const [duration, setDuration] = useState(30);
  const DURATION_OPTIONS = [15, 30, 60, 120];

  // --- Sounds mode: one-shot samples and loops from scratch ---
  const [createMode, setCreateMode] = useState<'song' | 'sounds'>('song');
  const [soundKind, setSoundKind] = useState<'one-shot' | 'loop'>('one-shot');
  const [soundPrompt, setSoundPrompt] = useState('');
  const [soundKey, setSoundKey] = useState('C');
  const [soundScale, setSoundScale] = useState<'major' | 'minor'>('minor');
  const [soundBpm, setSoundBpm] = useState(120);
  const [soundDuration, setSoundDuration] = useState(15);
  const [isGeneratingSound, setIsGeneratingSound] = useState(false);
  const SOUND_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Cancellation for the in-flight generation. Refs so the queue's Cancel
  // button can signal the polling loop without re-rendering it.
  const cancelRequestedRef = useRef(false);
  const activePredictionIdRef = useRef<string | null>(null);

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

  // Cancel the in-flight generation. Sets the flag the polling loop checks
  // and best-effort stops the prediction server-side if it has started.
  const handleCancelGeneration = () => {
    cancelRequestedRef.current = true;
    const id = activePredictionIdRef.current;
    if (id) {
      fetch('/.netlify/functions/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', id }),
      }).catch(() => {});
    }
  };

  // Real AI generation: browser -> Netlify function -> Replicate MusicGen.
  // The REPLICATE_API_TOKEN lives only in the Netlify function env; the
  // browser never sees it. Progress shown below is real (create + poll).
  const handleGenerate = async () => {
    const finalTheme = theme.trim() || 'A heavy metalcore atmospheric anthem about memories fading';
    const finalTitle = title.trim() || 'Hurts Like Hell';
    const finalGenre = genre || 'alternative, metalcore, atmospheric';
    const finalDuration = duration;

    setIsProcessing(true);
    cancelRequestedRef.current = false;
    activePredictionIdRef.current = null;

    const itemId = Math.random().toString();
    const coverId = Math.floor(Math.random() * 1000);

    setActiveQueueItems([
      { id: itemId, title: finalTitle, progress: 4, stage: 'Sending to AI engine…', genre: finalGenre, coverId }
    ]);

    const setQueueStage = (progress: number, stage: string) => {
      setActiveQueueItems(prev =>
        prev.map(item => (item.id === itemId ? { ...item, progress, stage } : item))
      );
    };

    const failGeneration = (message: string) => {
      setActiveQueueItems([]);
      setIsProcessing(false);
      setAutoSaveToast(`⚠️ ${message}`);
      setTimeout(() => setAutoSaveToast(null), 7000);
    };

    const cancelGeneration = () => {
      setActiveQueueItems([]);
      setIsProcessing(false);
      setAutoSaveToast('Generation cancelled.');
      setTimeout(() => setAutoSaveToast(null), 5000);
    };

    const ENGINE_URL = '/.netlify/functions/generate-music';

    try {
      // Lyrics AI (text) stays exactly as before; a lyrics failure must not
      // block the music itself.
      let gLyrics: string;
      try {
        gLyrics = isCustom && lyrics.trim() ? lyrics : await suggestLyricsChujai(finalTheme, finalGenre);
      } catch {
        gLyrics = lyrics.trim() || '[Instrumental Track - Synthesized by SwCafe]';
      }
      setLyrics(gLyrics);
      if (!title) setTitle(finalTitle);

      // Build the music prompt: genre first (MusicGen keys on style), then
      // the description and title, then a short mood excerpt from the
      // lyrics. MusicGen is instrumental-only, so lyrics are mood input
      // here, not vocals — raw lyric lines are kept short on purpose.
      const lyricExcerpt = (isCustom && lyrics.trim() ? lyrics : gLyrics)
        .split('\n')
        .filter(l => l.trim() && !l.trim().startsWith('['))
        .slice(0, 2)
        .join(' ')
        .slice(0, 200);
      const musicPrompt = `${finalGenre} instrumental track: ${finalTheme}. Titled "${finalTitle}".${lyricExcerpt ? ` Mood: ${lyricExcerpt}` : ''}`.slice(0, 900);

      // 1) Ask the function to start a MusicGen prediction.
      setQueueStage(10, 'Sending to AI engine…');
      let createRes: Response;
      try {
        createRes = await fetch(ENGINE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', prompt: musicPrompt, duration: finalDuration }),
        });
      } catch {
        failGeneration('AI engine not connected — deploy to Netlify first (see DEPLOY.md)');
        return;
      }
      if (createRes.status === 404) {
        failGeneration('AI engine not connected — deploy to Netlify first (see DEPLOY.md)');
        return;
      }
      const created = await createRes.json().catch(() => null);
      if (!createRes.ok || !created?.id) {
        failGeneration(created?.error || `AI engine error (${createRes.status}). Check REPLICATE_API_TOKEN in Netlify.`);
        return;
      }
      activePredictionIdRef.current = created.id;
      if (cancelRequestedRef.current) {
        cancelGeneration();
        return;
      }

      // 2) Poll for completion: every 4s. The deadline scales with track
      // length (longer tracks take longer to compose) with a 5-min floor.
      // A few consecutive poll hiccups are tolerated before giving up.
      const timeHint = finalDuration <= 30 ? '~1–2 min' : finalDuration <= 60 ? '~2–4 min' : '~4–8 min';
      const timeoutMinutes = Math.max(5, Math.ceil((finalDuration * 4) / 60));
      setQueueStage(22, `Composing your track… (this takes ${timeHint})`);
      const deadline = Date.now() + Math.max(5 * 60 * 1000, finalDuration * 4 * 1000);
      let pollCount = 0;
      let consecutivePollErrors = 0;
      let audioUrl: string | null = null;

      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 4000));
        if (cancelRequestedRef.current) {
          cancelGeneration();
          return;
        }
        pollCount += 1;
        setQueueStage(Math.min(24 + pollCount * 2, 92), `Composing your track… (this takes ${timeHint})`);

        let statusRes: Response;
        try {
          statusRes = await fetch(ENGINE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', id: created.id }),
          });
        } catch {
          consecutivePollErrors += 1;
          if (consecutivePollErrors >= 3) {
            failGeneration('Lost connection to the AI engine. Please try again.');
            return;
          }
          setQueueStage(Math.min(24 + pollCount * 2, 92), 'Reconnecting to AI engine…');
          continue;
        }
        const statusData = await statusRes.json().catch(() => null);
        if (!statusRes.ok) {
          consecutivePollErrors += 1;
          if (consecutivePollErrors >= 3) {
            failGeneration(statusData?.error || `AI engine error (${statusRes.status}).`);
            return;
          }
          setQueueStage(Math.min(24 + pollCount * 2, 92), 'Reconnecting to AI engine…');
          continue;
        }
        consecutivePollErrors = 0;

        const st = statusData?.status;
        if (st === 'succeeded') {
          const out = statusData?.output;
          audioUrl = Array.isArray(out) ? out[0] : out;
          if (audioUrl) break;
          failGeneration('The AI engine finished but returned no audio. Please try again.');
          return;
        }
        if (st === 'failed' || st === 'canceled') {
          failGeneration(statusData?.error || 'The AI engine could not finish this track. Try a different description.');
          return;
        }
        // "starting" / "processing" — keep polling.
      }

      if (!audioUrl) {
        failGeneration(`Generation timed out after ${timeoutMinutes} minutes. Please try again.`);
        return;
      }

      // 3) Save the real track (with audio) and auto-play it in the Player.
      setQueueStage(100, 'Finalizing…');
      const track = autoSaveSongToLibrary({
        title: finalTitle,
        genre: finalGenre,
        lyrics: gLyrics,
        theme: finalTheme,
        engine: 'MusicGen',
        coverId,
        audioUrl,
      });

      setLocalLibrary(prev => [track, ...prev.filter(x => x.id !== track.id)]);
      setSelectedTrackId(track.id);

      setActiveQueueItems([]);
      setIsProcessing(false);

      setAutoSaveToast(`💾 Auto-saved: "${finalTitle}" vaulted to Library!`);
      setTimeout(() => setAutoSaveToast(null), 5500);

      if (onPlay) {
        onPlay(track.title, 'MusicGen', `https://picsum.photos/seed/${track.coverId}/200/200`, audioUrl);
      }
    } catch (e) {
      console.error('Generation error:', e);
      failGeneration('Something went wrong while generating. Please try again.');
    }
  };

  // --- Sounds: generate a one-shot sample or a loop via the same
  // MusicGen backend as songs, with short durations. Loops carry their
  // BPM as metadata so Studio can time them to the project tempo.
  // Honest limit (labeled in the UI): MusicGen does not cut on a clean
  // loop point, so a loop may click on repeat — trim in Studio if needed.
  const handleGenerateSound = async () => {
    if (!soundPrompt.trim()) {
      setAutoSaveToast('Describe the sound you want first — e.g. "glass smash" or "moody guitar riff".');
      setTimeout(() => setAutoSaveToast(null), 5000);
      return;
    }
    const isLoop = soundKind === 'loop';
    const finalDuration = isLoop ? soundDuration : 5; // one-shots are 5s (MusicGen minimum)
    const soundTitle = soundPrompt.trim().slice(0, 60);
    const musicPrompt = isLoop
      ? `Seamless ${soundKey} ${soundScale} loop at ${soundBpm} BPM: ${soundPrompt.trim()}. A clean repeating musical loop.`
      : `One-shot sound effect: ${soundPrompt.trim()}. A single isolated sound, no music bed, no talking.`;
    const ENGINE_URL = '/.netlify/functions/generate-music';

    setIsGeneratingSound(true);
    cancelRequestedRef.current = false;
    activePredictionIdRef.current = null;
    const itemId = Math.random().toString();
    const coverId = Math.floor(Math.random() * 1000);
    setActiveQueueItems([
      { id: itemId, title: soundTitle, progress: 4, stage: isLoop ? 'Composing your loop…' : 'Creating your one-shot…', genre: `Sound · ${soundKind}`, coverId }
    ]);
    const setQueueStage = (progress: number, stage: string) => {
      setActiveQueueItems(prev => prev.map(item => (item.id === itemId ? { ...item, progress, stage } : item)));
    };
    const failSound = (message: string) => {
      setActiveQueueItems([]);
      setIsGeneratingSound(false);
      setAutoSaveToast(`⚠️ ${message}`);
      setTimeout(() => setAutoSaveToast(null), 7000);
    };

    try {
      setQueueStage(10, 'Sending to AI engine…');
      let createRes: Response;
      try {
        createRes = await fetch(ENGINE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', prompt: musicPrompt.slice(0, 900), duration: finalDuration }),
        });
      } catch {
        failSound('AI engine not connected — deploy to Netlify first (see DEPLOY.md)');
        return;
      }
      if (createRes.status === 404) {
        failSound('AI engine not connected — deploy to Netlify first (see DEPLOY.md)');
        return;
      }
      const created = await createRes.json().catch(() => null);
      if (!createRes.ok || !created?.id) {
        failSound(created?.error || `AI engine error (${createRes.status}). Check REPLICATE_API_TOKEN in Netlify.`);
        return;
      }
      activePredictionIdRef.current = created.id;
      if (cancelRequestedRef.current) {
        setActiveQueueItems([]);
        setIsGeneratingSound(false);
        return;
      }
      setQueueStage(22, isLoop ? 'Composing your loop… (~1–2 min)' : 'Creating your one-shot… (~1 min)');
      const deadline = Date.now() + 5 * 60 * 1000;
      let pollCount = 0;
      let consecutivePollErrors = 0;
      let audioUrl: string | null = null;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 4000));
        if (cancelRequestedRef.current) {
          setActiveQueueItems([]);
          setIsGeneratingSound(false);
          setAutoSaveToast('Generation cancelled.');
          setTimeout(() => setAutoSaveToast(null), 5000);
          return;
        }
        pollCount += 1;
        setQueueStage(Math.min(24 + pollCount * 2, 92), isLoop ? 'Composing your loop…' : 'Creating your one-shot…');
        let statusRes: Response;
        try {
          statusRes = await fetch(ENGINE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', id: created.id }),
          });
        } catch {
          consecutivePollErrors += 1;
          if (consecutivePollErrors >= 3) {
            failSound('Lost connection to the AI engine. Please try again.');
            return;
          }
          continue;
        }
        const statusData = await statusRes.json().catch(() => null);
        if (!statusRes.ok) {
          consecutivePollErrors += 1;
          if (consecutivePollErrors >= 3) {
            failSound(statusData?.error || `AI engine error (${statusRes.status}).`);
            return;
          }
          continue;
        }
        consecutivePollErrors = 0;
        const st = statusData?.status;
        if (st === 'succeeded') {
          const out = statusData?.output;
          audioUrl = Array.isArray(out) ? out[0] : out;
          if (!audioUrl) {
            failSound('The AI engine finished but returned no audio. Please try again.');
            return;
          }
          break;
        }
        if (st === 'failed' || st === 'canceled') {
          failSound(statusData?.error || 'The AI engine could not finish this sound. Try a different description.');
          return;
        }
      }
      if (!audioUrl) {
        failSound('Generation timed out after 5 minutes. Please try again.');
        return;
      }
      setQueueStage(100, 'Finalizing…');
      const track = autoSaveSongToLibrary({
        title: soundTitle,
        genre: `Sound · ${soundKind}`,
        lyrics: `[Sound]\n${soundPrompt.trim()}`,
        theme: soundPrompt.trim(),
        engine: 'MusicGen · Sounds',
        coverId,
        audioUrl,
        ...(isLoop ? { bpm: soundBpm } : {}),
      });
      setLocalLibrary(prev => [track, ...prev.filter(x => x.id !== track.id)]);
      setSelectedTrackId(track.id);
      setActiveQueueItems([]);
      setIsGeneratingSound(false);
      setAutoSaveToast(`💾 Sound saved: "${soundTitle}" vaulted to Library!${isLoop ? ` (${soundBpm} BPM — Studio can time it to your project tempo.)` : ''}`);
      setTimeout(() => setAutoSaveToast(null), 5500);
      if (onPlay) {
        onPlay(track.title, 'MusicGen · Sounds', `https://picsum.photos/seed/${track.coverId}/200/200`, audioUrl);
      }
    } catch (e) {
      console.error('Sounds generation error:', e);
      failSound('Something went wrong while generating. Please try again.');
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
          
          {/* Create mode: full songs, or one-shot samples & loops (Sounds) */}
          <div className="p-4 pb-0 flex gap-2">
            {(['song', 'sounds'] as const).map(m => (
              <button
                key={m}
                onClick={() => setCreateMode(m)}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  createMode === m
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white border-orange-500 shadow-lg'
                    : 'bg-[#1a1a1e]/50 text-zinc-400 hover:text-white border-white/5'
                }`}
                title={m === 'sounds' ? 'Create individual one-shot samples and loops from scratch' : 'Create a full song'}
              >
                {m === 'song' ? '🎵 Song' : '🔊 Sounds'}
              </button>
            ))}
          </div>

          {/* Subtab selection headers (Simple vs Custom toggle) */}
          <div className={`p-4 border-b border-zinc-950 flex gap-2 ${createMode === 'sounds' ? 'hidden' : ''}`}>
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

          {/* Sounds panel (one-shots & loops) */}
          {createMode === 'sounds' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 text-left animate-in fade-in duration-300">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Make individual one-shot samples and loops from scratch — a sound for your track, or a loop to start an idea and drop into Studio.
              </p>
              <div className="flex gap-2">
                {(['one-shot', 'loop'] as const).map(kind => (
                  <button
                    key={kind}
                    onClick={() => setSoundKind(kind)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                      soundKind === kind
                        ? 'bg-white/10 text-orange-400 border-orange-500/25'
                        : 'bg-[#1a1a1e]/50 text-zinc-400 hover:text-white border-white/5'
                    }`}
                  >
                    {kind === 'one-shot' ? '⚡ One-Shot' : '🔁 Loop'}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">
                  {soundKind === 'one-shot' ? 'What sound do you hear in your head?' : 'Describe the loop'}
                </label>
                <textarea
                  value={soundPrompt}
                  onChange={(e) => setSoundPrompt(e.target.value)}
                  placeholder={soundKind === 'one-shot' ? 'e.g. airhorn blast, glass smash, footsteps on gravel for a foley scene…' : 'e.g. moody guitar riff, deep bassline, bright synth lick…'}
                  className="w-full h-24 bg-[#1a1a1e]/50 border border-white/5 hover:border-white/10 rounded-xl p-3 font-sans text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-all custom-scrollbar resize-none font-bold"
                />
              </div>
              {soundKind === 'loop' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Key</label>
                      <div className="flex gap-1">
                        <select
                          value={soundKey}
                          onChange={(e) => setSoundKey(e.target.value)}
                          className="flex-1 bg-[#1a1a1e] border border-white/10 rounded-xl px-2 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500/50"
                        >
                          {SOUND_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <select
                          value={soundScale}
                          onChange={(e) => setSoundScale(e.target.value as 'major' | 'minor')}
                          className="flex-1 bg-[#1a1a1e] border border-white/10 rounded-xl px-2 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500/50"
                        >
                          <option value="major">Major</option>
                          <option value="minor">Minor</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Tempo (BPM)</label>
                      <input
                        type="number"
                        min={40}
                        max={220}
                        value={soundBpm}
                        onChange={(e) => setSoundBpm(Math.max(40, Math.min(220, parseInt(e.target.value) || 120)))}
                        className="w-full bg-[#1a1a1e] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Loop Length</label>
                    <div className="flex gap-1.5">
                      {[15, 30].map(sec => (
                        <button
                          key={sec}
                          onClick={() => setSoundDuration(sec)}
                          disabled={isGeneratingSound}
                          className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all disabled:opacity-50 ${
                            soundDuration === sec
                              ? 'bg-white/10 text-orange-400 border-orange-500/25'
                              : 'bg-[#1a1a1e] text-zinc-400 hover:text-white border-white/5'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Loops save with their BPM, so Studio can time them to your project tempo. Honest limit: the engine does not cut on a clean loop point yet, so a loop may click on repeat — trim the start/end in Studio if needed.
                  </p>
                </>
              )}
              {soundKind === 'one-shot' && (
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  One-shots are 5 seconds — the shortest the engine makes. Download the audio from your library, or send it to Studio as a lane.
                </p>
              )}
            </div>
          )}

          {/* Workbench scrollable options */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 text-left ${createMode === 'sounds' ? 'hidden' : ''}`}>
            
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
                placeholder="alternative, metalcore, atmospheric"
                className="w-full bg-[#1a1a1e]/50 border border-white/5 hover:border-white/10 rounded-xl p-3 font-sans text-xs text-white focus:outline-none focus:border-orange-500/40 transition-all font-bold"
              />
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {['alternative', 'metalcore', 'lofi beats', 'synthwave', 'rock', 'atmospheric'].map(pill => (
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

            {/* Track Length (generation duration) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Track Length</label>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map(sec => (
                  <button
                    key={sec}
                    onClick={() => setDuration(sec)}
                    disabled={isProcessing}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all disabled:opacity-50 ${
                      duration === sec
                        ? 'bg-white/10 text-orange-400 border-orange-500/25'
                        : 'bg-[#1a1a1e] text-zinc-400 hover:text-white border-white/5'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-zinc-600 font-semibold">Longer tracks take longer to compose.</p>
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
            {createMode === 'song' ? (
              <>
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
              </>
            ) : (
              <>
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={() => setSoundPrompt('')}
                    className="p-3 rounded-xl bg-[#1a1a1e] hover:bg-white/10 text-zinc-400 hover:text-white transition-colors border border-white/5"
                    title="Clear sound description"
                  >
                    🗑️
                  </button>
                  <button 
                    onClick={() => void handleGenerateSound()}
                    disabled={isGeneratingSound || isProcessing}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-500 text-white font-black py-3 rounded-xl shadow-lg shadow-black/40 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingSound ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
                        {soundKind === 'loop' ? 'Composing loop…' : 'Creating sound…'}
                      </span>
                    ) : (
                      <>
                        <span>{soundKind === 'loop' ? 'Create Loop ♪' : 'Create Sound ⚡'}</span>
                        <span className="text-[10px] text-white/70 font-black">{soundKind === 'loop' ? `${soundBpm} BPM` : '5s'}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[9px] text-zinc-600 font-semibold text-center">
                  {soundKind === 'loop' ? `Loop in ${soundKey} ${soundScale} at ${soundBpm} BPM — saved with its BPM for Studio.` : 'One-shot sample — 5 seconds, saved to your library.'}
                </p>
              </>
            )}
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
                  <div className="text-right flex items-center gap-2">
                    <span className="text-xs font-black font-mono text-orange-400">{item.progress}%</span>
                    <button
                      onClick={handleCancelGeneration}
                      className="text-[9px] font-black uppercase tracking-wider text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-2 py-1 transition-colors"
                    >
                      ✕ Cancel
                    </button>
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
                              if (onPlay) onPlay(track.title, track.engine || 'SwCafe v5.5', `https://picsum.photos/seed/${track.coverId || 'art'}/200/200`, (track as SavedSong).audioUrl);
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
                    onPlay(activeSelectedTrack.title, `SwCafe v5.5`, `https://picsum.photos/seed/${activeSelectedTrack.coverId || 'metal'}/200/200`, (activeSelectedTrack as SavedSong).audioUrl);
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
