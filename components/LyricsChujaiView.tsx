import React, { useState, useEffect } from 'react';
import { 
  suggestLyricsChujai, 
  continueLyricsWithAI, 
  polishLyricsWithAI, 
  suggestRhymesAndMetaphors 
} from '../geminiService';
import { autoSaveSongToLibrary } from '../songs';

interface LyricsChujaiViewProps {
  onNavigate?: (tab: string) => void;
  onSendToCreator?: (data: { lyrics: string; title: string; genre: string }) => void;
}

interface SavedLyricDraft {
  id: string;
  title: string;
  genre: string;
  mood: string;
  lyrics: string;
  theme: string;
  updatedAt: string;
}

const SECTION_TAGS = [
  '[Intro]',
  '[Verse 1]',
  '[Pre-Chorus]',
  '[Chorus]',
  '[Verse 2]',
  '[Bridge]',
  '[Drop]',
  '[Hook]',
  '[Guitar Solo]',
  '[Outro]'
];

const SONG_STRUCTURE_TEMPLATES = [
  {
    name: 'Pop / Rock Anthem',
    desc: 'Verse 1 → Pre-Chorus → Chorus → Verse 2 → Chorus → Bridge → Chorus → Outro',
    template: `[Intro]\n(Gentle acoustic intro, building atmosphere)\n\n[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]\n(Fade out with resonant harmonics)`
  },
  {
    name: 'Hip-Hop / Rap 16-Bar',
    desc: 'Intro → Hook → 16-Bar Verse 1 → Hook → 16-Bar Verse 2 → Bridge → Hook → Outro',
    template: `[Intro]\n(Hi-hat roll and 808 sub bass drop)\n\n[Hook]\n\n[Verse 1]\n\n[Hook]\n\n[Verse 2]\n\n[Bridge]\n\n[Hook]\n\n[Outro]`
  },
  {
    name: 'Acoustic / Storytelling Ballad',
    desc: 'Verse 1 → Verse 2 → Chorus → Verse 3 → Bridge → Chorus → Outro',
    template: `[Intro]\n(Fingerpicked guitar and soft ambient pad)\n\n[Verse 1]\n\n[Verse 2]\n\n[Chorus]\n\n[Verse 3]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]`
  },
  {
    name: 'EDM / Dance Anthem',
    desc: 'Intro → Build-up → Drop → Verse → Build-up → Drop → Outro',
    template: `[Intro]\n(Synthesizer arpeggio and rising filter)\n\n[Build-up]\n\n[Drop]\n\n[Verse]\n\n[Build-up]\n\n[Drop]\n\n[Outro]`
  }
];

const GENRES = [
  'Pop', 'Alternative Rock', 'Metalcore', 'Synthwave', 'R&B / Soul',
  'Hip-Hop / Trap', 'Indie Folk', 'EDM / Dance', 'Cyberpunk', 'Lo-fi Chill',
  'Cinematic Orchestral', 'Country', 'Reggae', 'Gospel'
];

const MOODS = [
  'Emotional & Melancholic', 'Energetic & Uplifting', 'Dark & Rebellious', 
  'Dreamy & Atmospheric', 'Romantic & Intimate', 'Nostalgic & Reflective',
  'Epic & Triumphant', 'Aggressive & Raw'
];

const LyricsChujaiView: React.FC<LyricsChujaiViewProps> = ({ onNavigate, onSendToCreator }) => {
  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'writer' | 'generator' | 'rhymes' | 'drafts'>('writer');

  // Song Data State
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [genre, setGenre] = useState('Alternative Rock');
  const [mood, setMood] = useState('Emotional & Melancholic');
  const [lyrics, setLyrics] = useState('');
  const [complexity, setComplexity] = useState('Metaphoric & Deep');
  
  // Loading and Notification States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCoWriting, setIsCoWriting] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isLookingUpRhymes, setIsLookingUpRhymes] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Rhyme & Muse Assistant State
  const [rhymeQuery, setRhymeQuery] = useState('');
  const [rhymeResults, setRhymeResults] = useState<{
    rhymes: string[];
    slantRhymes: string[];
    metaphors: string[];
    nextLines: string[];
  } | null>(null);

  // Local drafts state
  const [drafts, setDrafts] = useState<SavedLyricDraft[]>([]);

  // Load saved drafts on mount
  useEffect(() => {
    const saved = localStorage.getItem('swcafe_lyrics_drafts');
    if (saved) {
      try {
        setDrafts(JSON.parse(saved));
      } catch (err) {
        console.error('Error loading lyric drafts', err);
      }
    }

    // Default sample if empty
    if (!lyrics) {
      setLyrics(`[Verse 1]\nI'm staring through a fractured glass again\nThe shadows outline paths of quiet pain\nOur heavy hearts they carry what remains\nUntil the silence washes out the stains\n\n[Chorus]\nIt hurts like hell to let you go\nInto the drafty, silent snow\nAnd hear the echo of a song\nWe tried to play, we got it wrong\n\n[Bridge]\nBut does the fire still burn inside your mind?\nOr is it ash, the kind we left behind?`);
      setTitle('Hurts Like Hell');
    }
  }, []);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Insert a tag into lyrics at cursor or end
  const handleInsertTag = (tag: string) => {
    setLyrics(prev => {
      if (!prev.trim()) return `${tag}\n`;
      return `${prev.trimEnd()}\n\n${tag}\n`;
    });
    showNotification(`Added ${tag} to lyrics`);
  };

  // Apply template
  const handleApplyTemplate = (tmpl: string) => {
    if (lyrics.trim() && !window.confirm('Replace current lyrics with this structural template?')) {
      return;
    }
    setLyrics(tmpl);
    showNotification('Applied song template');
  };

  // Generate full lyrics with AI
  const handleGenerateFullLyrics = async () => {
    if (!theme.trim()) {
      alert('Please describe what your song is about (theme or story).');
      return;
    }
    setIsGenerating(true);
    setStatusMessage('Neural songwriter drafting complete song...');
    try {
      const generated = await suggestLyricsChujai(theme, genre, complexity, mood);
      setLyrics(generated);
      if (!title.trim()) {
        const autoTitle = theme.split(' ').slice(0, 4).join(' ').replace(/[^a-zA-Z0-9 ]/g, '');
        setTitle(autoTitle || 'Neural Anthem');
      }
      setActiveTab('writer');
      showNotification('✨ AI Lyrics generated successfully!');
      handleSaveDraft(generated, title || theme.slice(0, 20));
    } catch (err) {
      alert('Generation error. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Co-write / Continue with AI
  const handleContinueWithAI = async (sectionType: string = 'Next Section') => {
    if (!lyrics.trim()) {
      alert('Please write at least one line or verse first for the AI to continue!');
      return;
    }
    setIsCoWriting(true);
    setStatusMessage(`AI Co-Writer composing the ${sectionType}...`);
    try {
      const continuation = await continueLyricsWithAI(lyrics, theme, genre, sectionType);
      setLyrics(prev => `${prev.trimEnd()}\n\n${continuation.trim()}`);
      showNotification(`✨ Added ${sectionType} with AI!`);
    } catch (err) {
      alert('Co-writing node busy. Please try again.');
    } finally {
      setIsCoWriting(false);
    }
  };

  // Polish / Refine with AI
  const handlePolishLyrics = async (instruction: string) => {
    if (!lyrics.trim()) {
      alert('Please write or generate lyrics first to polish.');
      return;
    }
    setIsPolishing(true);
    setStatusMessage('AI Lyric Doctor refining meter, rhythm & imagery...');
    try {
      const polished = await polishLyricsWithAI(lyrics, instruction, genre);
      setLyrics(polished);
      showNotification('✨ Lyrics polished successfully!');
    } catch (err) {
      alert('Polishing failed. Please try again.');
    } finally {
      setIsPolishing(false);
    }
  };

  // Rhyme and metaphor search
  const handleSearchRhymes = async (queryToSearch?: string) => {
    const term = queryToSearch || rhymeQuery;
    if (!term.trim()) return;
    setIsLookingUpRhymes(true);
    try {
      const results = await suggestRhymesAndMetaphors(term, genre);
      setRhymeResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLookingUpRhymes(false);
    }
  };

  // Save draft
  const handleSaveDraft = (lyricsToSave?: string, titleToSave?: string) => {
    const finalLyrics = lyricsToSave || lyrics;
    if (!finalLyrics.trim()) return;

    const newDraft: SavedLyricDraft = {
      id: Math.random().toString(36).substr(2, 9),
      title: titleToSave || title.trim() || 'Untitled Lyrics',
      genre,
      mood,
      lyrics: finalLyrics,
      theme,
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    };

    const updated = [newDraft, ...drafts.filter(d => d.title !== newDraft.title)];
    setDrafts(updated);
    localStorage.setItem('swcafe_lyrics_drafts', JSON.stringify(updated));

    // Auto-save directly into centralized song library and archive
    autoSaveSongToLibrary({
      id: newDraft.id,
      title: newDraft.title,
      genre,
      lyrics: finalLyrics,
      theme: theme || 'Written in Lyric Studio',
      engine: 'Chujai AI v5.5'
    });
    showNotification(`💾 Auto-saved "${newDraft.title}" directly to your Library!`);
  };

  // Load draft
  const handleLoadDraft = (d: SavedLyricDraft) => {
    setTitle(d.title);
    setGenre(d.genre);
    setMood(d.mood || 'Emotional & Melancholic');
    setTheme(d.theme || '');
    setLyrics(d.lyrics);
    setActiveTab('writer');
    showNotification(`Loaded draft "${d.title}"`);
  };

  // Delete draft
  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = drafts.filter(d => d.id !== id);
    setDrafts(updated);
    localStorage.setItem('swcafe_lyrics_drafts', JSON.stringify(updated));
    showNotification('Draft removed');
  };

  // Send to Song Creator
  const handleSendToCreator = () => {
    const finalTitle = title.trim() || 'Untitled Anthem';
    const finalLyrics = lyrics.trim() || '[Chorus]\nSinging our hearts out into the night';
    
    if (onSendToCreator) {
      onSendToCreator({
        title: finalTitle,
        lyrics: finalLyrics,
        genre
      });
    } else if (onNavigate) {
      localStorage.setItem('swcafe_song_creator_memory', JSON.stringify({
        title: finalTitle,
        lyrics: finalLyrics,
        genre,
        isCustom: true
      }));
      onNavigate('song-creator');
    }
  };

  // Compute stats
  const lineCount = lyrics ? lyrics.split('\n').filter(l => l.trim().length > 0).length : 0;
  const wordCount = lyrics ? lyrics.trim().split(/\s+/).filter(Boolean).length : 0;
  const characterCount = lyrics.length;
  const estimatedDuration = Math.max(1, Math.round(wordCount / 130 * 60)); // seconds
  const estMins = Math.floor(estimatedDuration / 60);
  const estSecs = estimatedDuration % 60;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 text-left font-sans">
      
      {/* Toast Notification */}
      {statusMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#ff5e00] text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-4 border border-white/20">
          <span>🎵</span>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <header className="bg-gradient-to-r from-zinc-950 via-[#0e0e12] to-zinc-950 border border-white/5 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✍️</span>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Lyric Studio <span className="text-[#ff5e00] text-xs px-2.5 py-0.5 rounded-full bg-[#ff5e00]/10 border border-[#ff5e00]/25 uppercase font-mono">v5.5 Neural</span>
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] text-slate-400 font-medium">Write custom song lyrics manually or co-write seamlessly with Gemini AI</p>
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Auto-Save Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/5 flex-wrap gap-1">
          <button 
            onClick={() => setActiveTab('writer')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'writer' ? 'bg-[#ff5e00] text-white shadow-lg shadow-[#ff5e00]/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📝</span> Writer & Editor
          </button>
          <button 
            onClick={() => setActiveTab('generator')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'generator' ? 'bg-[#ff5e00] text-white shadow-lg shadow-[#ff5e00]/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>✨</span> AI Songwriter
          </button>
          <button 
            onClick={() => setActiveTab('rhymes')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'rhymes' ? 'bg-[#ff5e00] text-white shadow-lg shadow-[#ff5e00]/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🎯</span> Rhymes & Metaphors
          </button>
          <button 
            onClick={() => setActiveTab('drafts')}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'drafts' ? 'bg-[#ff5e00] text-white shadow-lg shadow-[#ff5e00]/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📁</span> Saved Drafts ({drafts.length})
          </button>
        </div>
      </header>

      {/* Main Studio Viewport */}
      {activeTab === 'writer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          
          {/* LEFT: Quick Song Info & AI Assistant Tools */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Song Meta Card */}
            <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#ff5e00]">Song Profile</span>
                <span className="text-[9px] font-mono text-slate-500 uppercase">Live Sync</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Song Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Hurts Like Hell"
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#ff5e00]/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Genre</label>
                    <select 
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full bg-zinc-900/80 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#ff5e00]/50 appearance-none"
                    >
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Vocal Mood</label>
                    <select 
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      className="w-full bg-zinc-900/80 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#ff5e00]/50 appearance-none"
                    >
                      {MOODS.map(m => <option key={m} value={m}>{m.split('&')[0]}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Story / Concept Note</label>
                  <input 
                    type="text" 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="e.g. Broken promises, walking through empty streets at midnight"
                    className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-[#ff5e00]/50"
                  />
                </div>
              </div>
            </div>

            {/* AI Co-Writer Actions Card */}
            <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">AI Co-Writer</span>
                <span className="text-[9px] font-mono text-emerald-400/60 uppercase">Gemini 3.7</span>
              </div>
              
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Have the AI continue writing your song based on the lines you've already penned.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleContinueWithAI('Chorus')}
                  disabled={isCoWriting}
                  className="bg-zinc-900 hover:bg-zinc-800 text-slate-200 hover:text-white p-2.5 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <span>✨</span> + Write Chorus
                </button>
                <button 
                  onClick={() => handleContinueWithAI('Verse 2')}
                  disabled={isCoWriting}
                  className="bg-zinc-900 hover:bg-zinc-800 text-slate-200 hover:text-white p-2.5 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <span>✨</span> + Write Verse 2
                </button>
                <button 
                  onClick={() => handleContinueWithAI('Bridge')}
                  disabled={isCoWriting}
                  className="bg-zinc-900 hover:bg-zinc-800 text-slate-200 hover:text-white p-2.5 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <span>✨</span> + Write Bridge
                </button>
                <button 
                  onClick={() => handleContinueWithAI('Outro')}
                  disabled={isCoWriting}
                  className="bg-zinc-900 hover:bg-zinc-800 text-slate-200 hover:text-white p-2.5 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <span>✨</span> + Write Outro
                </button>
              </div>

              {/* AI Polish Tools */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">AI Polish & Refinement</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePolishLyrics('Improve poetic imagery and emotional depth while keeping rhythm')}
                    disabled={isPolishing}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-amber-400 p-2 rounded-xl text-[9px] font-black uppercase tracking-wider border border-white/5 transition-all disabled:opacity-50"
                  >
                    Deepen Poetry
                  </button>
                  <button 
                    onClick={() => handlePolishLyrics('Tighten rhyme scheme and syllable meter for catchy flow')}
                    disabled={isPolishing}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-blue-400 p-2 rounded-xl text-[9px] font-black uppercase tracking-wider border border-white/5 transition-all disabled:opacity-50"
                  >
                    Tighten Rhymes
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Song Structure Templates */}
            <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-5 space-y-3 shadow-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Structure Templates</span>
              <div className="space-y-1.5">
                {SONG_STRUCTURE_TEMPLATES.map(tmpl => (
                  <button 
                    key={tmpl.name}
                    onClick={() => handleApplyTemplate(tmpl.template)}
                    className="w-full text-left p-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-white/10 transition-all group"
                  >
                    <div className="text-[11px] font-black text-slate-300 group-hover:text-white">{tmpl.name}</div>
                    <div className="text-[9px] text-slate-500 truncate mt-0.5">{tmpl.desc}</div>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT: High-Powered Lyrics Editor Workspace */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            
            <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 flex flex-col flex-1 shadow-2xl min-h-[640px]">
              
              {/* Editor Top Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/5">
                
                {/* Structural Section Insertion Tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-1">Insert Tag:</span>
                  {SECTION_TAGS.map(tag => (
                    <button 
                      key={tag}
                      onClick={() => handleInsertTag(tag)}
                      className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-[#ff5e00] text-slate-400 hover:text-white text-[9px] font-black tracking-wider border border-white/5 transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (window.confirm('Clear all lyrics?')) {
                        setLyrics('');
                        setTitle('');
                      }
                    }}
                    className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-red-900/40 text-slate-400 hover:text-red-400 text-[10px] font-black uppercase transition-colors"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(lyrics);
                      showNotification('📋 Lyrics copied to clipboard!');
                    }}
                    className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-slate-300 text-[10px] font-black uppercase transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Main Lyrics Textarea with line-number feel */}
              <div className="relative flex-1 my-4 flex">
                <textarea 
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Type your lyrics here, or use the AI Songwriter / Co-Writer to compose stanzas..."
                  className="w-full h-full min-h-[440px] bg-zinc-950/60 border border-white/5 hover:border-white/10 focus:border-[#ff5e00]/50 rounded-2xl p-6 font-mono text-xs leading-relaxed text-slate-200 placeholder-slate-600 focus:outline-none custom-scrollbar resize-none font-medium"
                />
              </div>

              {/* Editor Statistics & Metrics Bar */}
              <div className="py-3 px-4 bg-zinc-950/80 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-4 text-[10px] font-bold text-slate-400 font-mono">
                <div className="flex items-center gap-4">
                  <span>Lines: <strong className="text-white font-mono">{lineCount}</strong></span>
                  <span>Words: <strong className="text-white font-mono">{wordCount}</strong></span>
                  <span>Characters: <strong className="text-white font-mono">{characterCount}</strong></span>
                  <span>Est. Duration: <strong className="text-[#ff5e00] font-mono">{estMins}m {estSecs}s</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">● Studio Ready</span>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="pt-5 mt-2 border-t border-white/5 flex flex-wrap gap-3 items-center justify-between">
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleSaveDraft()}
                    className="px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider border border-white/10 transition-all flex items-center gap-1.5"
                  >
                    <span>💾</span> Save Draft
                  </button>

                  <button 
                    onClick={() => {
                      const blob = new Blob([`${title || 'Untitled Song'}\nGenre: ${genre}\n\n${lyrics}`], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${title.replace(/\s+/g, '_') || 'lyrics'}.txt`;
                      a.click();
                      showNotification('📥 Downloaded lyrics as .txt');
                    }}
                    className="px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-slate-300 font-black text-xs uppercase tracking-wider border border-white/5 transition-all"
                  >
                    Export .txt
                  </button>
                </div>

                {/* Primary CTA: Send to Song Creator */}
                <button 
                  onClick={handleSendToCreator}
                  className="bg-gradient-to-r from-[#ff5e00] to-orange-500 hover:from-[#ff731d] hover:to-orange-400 text-white font-black px-8 py-3.5 rounded-2xl shadow-xl shadow-orange-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2"
                >
                  <span>🎹 Create Song with Lyrics</span>
                  <span className="text-xs">→</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* AI Songwriter Generator Viewport */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
          
          {/* Form settings */}
          <div className="lg:col-span-5 bg-[#0c0c0e] border border-white/5 rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className="space-y-1">
              <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>✨</span> AI Songwriter Engine
              </h2>
              <p className="text-xs text-slate-400 leading-normal">
                Input your story, theme, or concept and Chujai AI will write a complete, structured musical lyric sheet.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">What is this song about? (Theme / Story)</label>
                <textarea 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="e.g. A bittersweet ballad about meeting an old friend in a rainy coffee shop after ten years, realizing how much life changed..."
                  className="w-full h-32 bg-zinc-900/70 border border-white/10 rounded-2xl p-4 text-xs font-medium text-white focus:outline-none focus:border-[#ff5e00]/50 custom-scrollbar resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Musical Style</label>
                  <select 
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-zinc-900/70 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:outline-none focus:border-[#ff5e00]/50"
                  >
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Emotional Tone</label>
                  <select 
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    className="w-full bg-zinc-900/70 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:outline-none focus:border-[#ff5e00]/50"
                  >
                    {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Lyrical Depth & Complexity</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Catchy & Simple', 'Metaphoric & Deep', 'Poetic & Cinematic'].map(comp => (
                    <button
                      key={comp}
                      onClick={() => setComplexity(comp)}
                      className={`p-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all ${
                        complexity === comp 
                          ? 'bg-[#ff5e00]/15 border-[#ff5e00] text-[#ff5e00]' 
                          : 'bg-zinc-900/50 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {comp}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Optional Song Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ten Years in the Rain"
                  className="w-full bg-zinc-900/70 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:outline-none focus:border-[#ff5e00]/50"
                />
              </div>

              <button 
                onClick={handleGenerateFullLyrics}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-[#ff5e00] to-orange-500 hover:from-[#ff731d] hover:to-orange-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
                    <span>AI Writing Full Lyrics...</span>
                  </>
                ) : (
                  <>
                    <span>✨ Generate Complete Lyrics</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview / Results Column */}
          <div className="lg:col-span-7 bg-[#0c0c0e] border border-white/5 rounded-3xl p-8 flex flex-col shadow-2xl min-h-[580px]">
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <span className="text-xs font-black uppercase tracking-wider text-white">Generated Lyric Preview</span>
              {lyrics && (
                <button 
                  onClick={() => setActiveTab('writer')}
                  className="text-xs font-black text-[#ff5e00] hover:underline uppercase tracking-wider"
                >
                  Open in Full Writer →
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar my-4 p-4 bg-zinc-950/60 rounded-2xl border border-white/5 font-mono text-xs leading-relaxed text-slate-300">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-24 opacity-60">
                  <div className="w-12 h-12 border-3 border-orange-500/20 border-t-[#ff5e00] rounded-full animate-spin"></div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#ff5e00] animate-pulse">
                    Consulting creative songwriting nodes...
                  </p>
                </div>
              ) : lyrics ? (
                <div className="whitespace-pre-wrap">{lyrics}</div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-24 text-center space-y-3 opacity-30">
                  <span className="text-5xl">🎶</span>
                  <p className="text-xs font-black uppercase text-slate-400">Fill in your theme on the left and tap Generate</p>
                </div>
              )}
            </div>

            {lyrics && (
              <div className="pt-4 border-t border-white/5 flex gap-3 justify-end">
                <button 
                  onClick={() => setActiveTab('writer')}
                  className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-wider"
                >
                  Edit in Studio
                </button>
                <button 
                  onClick={handleSendToCreator}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#ff5e00] to-orange-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-orange-600/10"
                >
                  Create Song Now →
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Rhymes & Metaphors Assistant Viewport */}
      {activeTab === 'rhymes' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-8 shadow-2xl">
            <div className="max-w-2xl space-y-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>🎯</span> Songwriting Rhyme & Metaphor Engine
              </h2>
              <p className="text-xs text-slate-400 leading-normal">
                Enter any word, ending syllable, or lyrical line to discover perfect rhymes, slant rhymes, poetic metaphors, and next-line inspirations.
              </p>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={rhymeQuery}
                  onChange={(e) => setRhymeQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchRhymes()}
                  placeholder="e.g. shadow, fire, fading away, broken heart..."
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-bold text-white focus:outline-none focus:border-[#ff5e00]/50"
                />
                <button 
                  onClick={() => handleSearchRhymes()}
                  disabled={isLookingUpRhymes}
                  className="bg-[#ff5e00] hover:bg-[#ff731d] text-white font-black px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLookingUpRhymes ? 'Searching...' : 'Explore Muse'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Popular prompts:</span>
            {['shadow', 'echo', 'frozen', 'neon lights', 'letting go', 'whisper', 'ignite'].map(tag => (
              <button 
                key={tag}
                onClick={() => {
                  setRhymeQuery(tag);
                  handleSearchRhymes(tag);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-full text-xs font-semibold border border-white/5 transition-all"
              >
                "{tag}"
              </button>
            ))}
          </div>

          {/* Results Grid */}
          {rhymeResults && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4">
              
              {/* Perfect Rhymes */}
              <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#ff5e00] flex items-center gap-1.5">
                  <span>✨</span> Perfect Rhymes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {rhymeResults.rhymes.map((r, i) => (
                    <button 
                      key={i} 
                      onClick={() => {
                        setLyrics(prev => `${prev.trimEnd()} ${r}`);
                        showNotification(`Appended "${r}" to lyrics`);
                      }}
                      className="bg-zinc-900 hover:bg-[#ff5e00] hover:text-white text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/5 transition-all"
                      title="Click to insert into lyrics"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slant Rhymes */}
              <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>🌊</span> Slant / Near Rhymes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {rhymeResults.slantRhymes.map((r, i) => (
                    <button 
                      key={i} 
                      onClick={() => {
                        setLyrics(prev => `${prev.trimEnd()} ${r}`);
                        showNotification(`Appended "${r}" to lyrics`);
                      }}
                      className="bg-zinc-900 hover:bg-amber-500 hover:text-black text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/5 transition-all"
                      title="Click to insert into lyrics"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metaphors & Imagery */}
              <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
                <h3 className="text-xs font-black uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <span>🌌</span> Poetic Metaphors
                </h3>
                <div className="space-y-2">
                  {rhymeResults.metaphors.map((m, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setLyrics(prev => `${prev.trimEnd()}\n${m}`);
                        showNotification(`Added metaphor line to lyrics`);
                      }}
                      className="p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-slate-300 hover:text-white text-xs font-medium cursor-pointer border border-white/5 transition-all"
                      title="Click to append as new line"
                    >
                      "{m}"
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Line Inspirations */}
              <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <span>💡</span> Next-Line Ideas
                </h3>
                <div className="space-y-2">
                  {rhymeResults.nextLines.map((nl, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setLyrics(prev => `${prev.trimEnd()}\n${nl}`);
                        showNotification(`Added line to lyrics`);
                      }}
                      className="p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-slate-300 hover:text-white text-xs font-medium cursor-pointer border border-white/5 transition-all"
                      title="Click to append as new line"
                    >
                      "{nl}"
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Saved Lyric Drafts Viewport */}
      {activeTab === 'drafts' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Archived Lyric Sheets</h2>
            <button 
              onClick={() => {
                setTitle('');
                setLyrics('');
                setActiveTab('writer');
              }}
              className="bg-[#ff5e00] hover:bg-[#ff731d] text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              + Start New Song Draft
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="py-24 text-center bg-[#0c0c0e] border border-white/5 rounded-3xl space-y-3 opacity-40">
              <span className="text-5xl block">📜</span>
              <p className="text-xs font-black uppercase text-slate-400">No lyric drafts archived yet</p>
              <p className="text-[11px] text-slate-500">Save drafts from the Writer or generate songs with Chujai AI</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drafts.map(d => (
                <div 
                  key={d.id}
                  onClick={() => handleLoadDraft(d)}
                  className="bg-[#0c0c0e] hover:bg-[#121216] border border-white/5 hover:border-[#ff5e00]/30 rounded-3xl p-6 flex flex-col justify-between cursor-pointer transition-all shadow-xl group space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-base font-black text-white group-hover:text-[#ff5e00] transition-colors truncate">{d.title}</h3>
                      <button 
                        onClick={(e) => handleDeleteDraft(d.id, e)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded-lg text-xs"
                        title="Delete draft"
                      >
                        🗑
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <span className="text-[9px] bg-zinc-900 text-slate-400 px-2 py-0.5 rounded-full font-black uppercase">{d.genre}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{d.updatedAt}</span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-4 font-mono leading-relaxed bg-zinc-950/60 p-3 rounded-xl border border-white/5 whitespace-pre-line">
                      {d.lyrics}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-white">
                    <span>Load to Editor</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default LyricsChujaiView;
