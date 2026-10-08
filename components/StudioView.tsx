import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Plus, Upload, Sparkles, HelpCircle, LayoutGrid, X, SlidersHorizontal, Trash2, Scissors, Music, Download, Check, Save } from 'lucide-react';
import { suggestLyricsChujai, generateMusicAdvice } from '../geminiService';
import { autoSaveSongToLibrary } from '../songs';

interface Track {
  id: string;
  name: string;
  color: string;
  textColor: string;
  accentColor: string;
  active: boolean;
  muted: boolean;
  solo: boolean;
  volume: number; // 0 to 100
  input: string;
}

interface Stem {
  id: string;
  name: string;
  active: boolean;
  muted: boolean;
  solo: boolean;
  waveformSeed: number;
}

const StudioView: React.FC<{ onOpenVoice: () => void }> = ({ onOpenVoice }) => {
  // --- Active Tab Modes & Core States ---
  const [activeMode, setActiveMode] = useState<'Simple' | 'Advanced' | 'Sounds'>('Advanced');
  const [activeVersion, setActiveVersion] = useState('v5.5');
  
  // Accordion folds on the left panel
  const [isLyricsOpen, setIsLyricsOpen] = useState(true);
  const [isStylesOpen, setIsStylesOpen] = useState(true);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [studioAutoSaveToast, setStudioAutoSaveToast] = useState<string | null>(null);

  // Left sidebar form values
  const [lyricsType, setLyricsType] = useState<'Write' | 'Prompt' | 'Instrumental'>('Write');
  const [lyricsText, setLyricsText] = useState(
    `[Verse]\nThis is where you write your rhymes\nor give our Magic Wand a try ↙\nSection [tags] can help instruct your\nsongs to feel more tight and structured`
  );
  const [stylePrompt, setStylePrompt] = useState('atmospheric, heavy metalcore, deep ethereal synth, spacey guitar');
  const [songTitle, setSongTitle] = useState("Let You Go (Remix v5.5)");

  // Tracks State - modeled after the specific colors from the uploaded design
  const [tracks, setTracks] = useState<Track[]>([
    { id: '1', name: "Don't Hate", color: 'bg-[#10b981]/25 border-l-4 border-[#10b981]', textColor: 'text-[#10b981]', accentColor: '#10b981', active: true, muted: false, solo: false, volume: 82, input: 'No Input' },
    { id: '2', name: 'Woodwinds', color: 'bg-[#fbbf24]/20 border-l-4 border-[#fbbf24]', textColor: 'text-[#fbbf24]', accentColor: '#fbbf24', active: true, muted: false, solo: false, volume: 75, input: 'No Input' },
    { id: '3', name: 'Brass', color: 'bg-[#fbbf24]/20 border-l-4 border-[#fbbf24]', textColor: 'text-[#fbbf24]', accentColor: '#fbbf24', active: false, muted: false, solo: false, volume: 60, input: 'No Input' },
    { id: '4', name: 'FX Synth', color: 'bg-[#06b6d4]/20 border-l-4 border-[#06b6d4]', textColor: 'text-[#06b6d4]', accentColor: '#06b6d4', active: true, muted: false, solo: false, volume: 70, input: 'No Input' },
    { id: '5', name: 'Ambient Pad', color: 'bg-[#ec4899]/20 border-l-4 border-[#ec4899]', textColor: 'text-[#ec4899]', accentColor: '#ec4899', active: true, muted: false, solo: false, volume: 65, input: 'No Input' }
  ]);
  
  const [selectedTrackId, setSelectedTrackId] = useState<string>('1');

  // --- Web Audio Synth Synthesizer & Transport Controls ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(101);
  const [playhead, setPlayhead] = useState(15); // playhead offset position Percentage
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [isLooping, setIsLooping] = useState(true);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [masterVolume, setMasterVolume] = useState(80); // 0 to 100
  const [activeTimeStr, setActiveTimeStr] = useState('00:00.000');
  const [activeBarBeats, setActiveBarBeats] = useState('000.3.2');

  // Dynamic Peak Level metering values (jump on beat)
  const [peakLevels, setPeakLevels] = useState<Record<string, number>>({
    '1': 65, '2': 40, '3': 0, '4': 55, '5': 30
  });

  // --- Right side panel state ---
  const [tempoMatch, setTempoMatch] = useState<'On Beat' | 'Free Scroll'>('On Beat');
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<'1/2' | 'original' | 'x2'>('original');
  const [clipVolume, setClipVolume] = useState(85); // percentage

  // Extracted Stems collection
  const [stems, setStems] = useState<Stem[]>([
    { id: 'st-1', name: 'Vocals Dry', active: true, muted: false, solo: false, waveformSeed: 88 },
    { id: 'st-2', name: 'B Vocals Chorus', active: true, muted: false, solo: false, waveformSeed: 12 },
    { id: 'st-3', name: 'Drums Full Beat', active: true, muted: false, solo: false, waveformSeed: 54 },
    { id: 'st-4', name: 'Sub Bass Floor', active: true, muted: false, solo: false, waveformSeed: 34 },
    { id: 'st-5', name: 'Acoustic Guitar', active: false, muted: false, solo: false, waveformSeed: 67 },
    { id: 'st-6', name: 'Percloop Accent', active: true, muted: false, solo: false, waveformSeed: 91 }
  ]);

  // General Copilot & Magic Assistant Helpers
  const [copilotHistory, setCopilotHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [copilotInput, setCopilotInput] = useState('');
  const [isCopilotThinking, setIsCopilotThinking] = useState(false);
  const [isGeneratingMidi, setIsGeneratingMidi] = useState(false);
  const [generatedLyricsLog, setGeneratedLyricsLog] = useState('');

  // Audio nodes and references for physical synthesis
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const stepIntervalRef = useRef<any>(null);
  const playheadIntervalRef = useRef<any>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentBeatIdxRef = useRef<number>(0);

  // Initialize and get Web Audio context securely (only on user interaction)
  const initAudioCtx = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime((masterVolume / 100) * 0.4, ctx.currentTime);
      masterGain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainNodeRef.current = masterGain;
    }
    return audioCtxRef.current;
  };

  // Sync Master Volume UI with Synth Gain Node
  useEffect(() => {
    if (masterGainNodeRef.current && audioCtxRef.current) {
      masterGainNodeRef.current.gain.linearRampToValueAtTime(
        (masterVolume / 100) * 0.4,
        audioCtxRef.current.currentTime + 0.05
      );
    }
  }, [masterVolume]);

  // Synchronized Synthesizer beats sequencer
  const startSynthLoop = () => {
    const ctx = initAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    nextNoteTimeRef.current = ctx.currentTime;
    currentBeatIdxRef.current = 0;

    const stepDuration = 60 / bpm / 2; // eighth notes

    const scheduleStep = () => {
      while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
        triggerSynthBeat(ctx, nextNoteTimeRef.current, currentBeatIdxRef.current);
        nextNoteTimeRef.current += stepDuration;
        currentBeatIdxRef.current = (currentBeatIdxRef.current + 1) % 16;
      }
    };

    // Schedule intervals
    stepIntervalRef.current = setInterval(scheduleStep, 40);
  };

  const stopSynthLoop = () => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  };

  // Real Web Audio trigger function! swept oscillators + organic noise loops
  const triggerSynthBeat = (ctx: AudioContext, time: number, beatIdx: number) => {
    if (!masterGainNodeRef.current) return;

    // Check specific tracks muted stats
    const voxMuted = tracks.find(t => t.id === '1')?.muted;
    const woodwindsMuted = tracks.find(t => t.id === '2')?.muted;
    const brassMuted = tracks.find(t => t.id === '3')?.muted;
    const fxMuted = tracks.find(t => t.id === '4')?.muted;
    const synthMuted = tracks.find(t => t.id === '5')?.muted;

    // Get individual tracks' volume percentage
    const getVol = (id: string) => {
      const tr = tracks.find(t => t.id === id);
      return tr ? tr.volume / 100 : 0.8;
    };

    // 1. Kick sweeps (Four on the Floor beat) on 0, 4, 8, 12
    if ((beatIdx % 4 === 0) && !voxMuted) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(masterGainNodeRef.current);

      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);

      gain.gain.setValueAtTime(0.5 * getVol('1'), time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

      osc.start(time);
      osc.stop(time + 0.16);

      // Flash volume meter level
      setPeakLevels(p => ({ ...p, '1': Math.floor(Math.random() * 25) + 65 }));
    }

    // 2. High snap percussion (snare/clap alternative) on beat 2, 6, 10, 14
    if ((beatIdx % 8 === 4) && !woodwindsMuted) {
      // Noise burst for snare
      const bufferSize = ctx.sampleRate * 0.1;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25 * getVol('2'), time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(masterGainNodeRef.current);

      noiseNode.start(time);
      noiseNode.stop(time + 0.1);

      setPeakLevels(p => ({ ...p, '2': Math.floor(Math.random() * 20) + 45 }));
    }

    // 3. Arpeggiator Synth melody (Acoustic Chord Matrix playing in Eb / C minor vibe)
    if ((beatIdx % 2 === 0) && !synthMuted) {
      const pitches = [130.81, 155.56, 196.00, 220.00, 261.63, 311.13, 392.00, 440.00]; // C, Eb, G, Ab, C, Eb, G, Ab
      const currentPitch = pitches[beatIdx % pitches.length] * (transposeSemitones !== 0 ? Math.pow(1.059463, transposeSemitones) : 1);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // Triangle wave for warm spacey melodies
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(currentPitch, time);

      gain.gain.setValueAtTime(0.2 * getVol('5'), time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.22);

      osc.connect(gain);
      gain.connect(masterGainNodeRef.current);

      osc.start(time);
      osc.stop(time + 0.25);

      setPeakLevels(p => ({ ...p, '5': Math.floor(Math.random() * 30) + 35 }));
    }

    // 4. Ethereal atmospheric sound effects (random sweep on FX track)
    if ((beatIdx % 12 === 2) && !fxMuted) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(1400, time + 0.4);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, time);
      filter.frequency.exponentialRampToValueAtTime(1500, time + 0.4);

      gain.gain.setValueAtTime(0.12 * getVol('4'), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.42);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGainNodeRef.current);

      osc.start(time);
      osc.stop(time + 0.45);

      setPeakLevels(p => ({ ...p, '4': Math.floor(Math.random() * 25) + 40 }));
    }

    // 5. Metronome tick
    if (metronomeOn && (beatIdx % 4 === 0)) {
      const tick = ctx.createOscillator();
      const tickGain = ctx.createGain();
      tick.frequency.setValueAtTime(beatIdx === 0 ? 1600 : 1000, time);
      tickGain.gain.setValueAtTime(0.08, time);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

      tick.connect(tickGain);
      tickGain.connect(masterGainNodeRef.current);
      tick.start(time);
      tick.stop(time + 0.06);
    }
  };

  // Run or stop playhead scrubbing counter
  useEffect(() => {
    if (isPlaying) {
      startSynthLoop();
      const startTime = Date.now() - (playhead / 100) * 120000; // Assuming 2 minute length
      
      playheadIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const totalDuration = 120000; // 2 minutes
        const currentPercentage = (elapsed / totalDuration) * 100;
        
        if (currentPercentage >= 100) {
          if (isLooping) {
            setPlayhead(0);
          } else {
            setIsPlaying(false);
            setPlayhead(0);
          }
        } else {
          setPlayhead(currentPercentage);
        }

        // Format transport timestamps elegantly
        const totalSeconds = Math.floor(elapsed / 1000) % 120;
        const minutes = Math.floor(elapsed / 60000);
        const milliseconds = Math.floor(elapsed % 1000);
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        setActiveTimeStr(formattedTime);

        // Bars, beats, ticks logic
        const currentTicks = Math.floor((elapsed % 1000) / 10) % 99;
        const currentBeat = Math.floor((elapsed / 600.0)) % 4 + 1;
        const currentBar = Math.floor((elapsed / 2400.0)) % 999 + 1;
        setActiveBarBeats(`${currentBar.toString().padStart(3, '0')}.${currentBeat}.${currentTicks}`);

      }, 33);
    } else {
      stopSynthLoop();
      if (playheadIntervalRef.current) {
        clearInterval(playheadIntervalRef.current);
        playheadIntervalRef.current = null;
      }
    }

    return () => {
      stopSynthLoop();
      if (playheadIntervalRef.current) {
        clearInterval(playheadIntervalRef.current);
      }
    };
  }, [isPlaying, isLooping, bpm]);

  // Audio cleanups on destroy
  useEffect(() => {
    return () => {
       stopSynthLoop();
    };
  }, []);

  // --- Handlers for Creation Workbench (Left panel) ---
  const handleLyricsAutogen = async () => {
    if (!stylePrompt) return alert('Please enter styles of music in the Styles tab first.');
    setIsGeneratingMidi(true);
    try {
      const responseText = await suggestLyricsChujai(
        "an atmospheric journey of escaping regrets into neon skies",
        stylePrompt,
        "High"
      );
      setLyricsText(responseText);
      setGeneratedLyricsLog('✨ Lyric template compiled via Chujai v5.5 Neural nodes!');
    } catch (e) {
      alert('Chujai v5.5 engine warming up...');
    } finally {
      setIsGeneratingMidi(false);
    }
  };

  const handleCreateMagicSunoTrack = () => {
    setIsGeneratingMidi(true);
    const audioCtx = initAudioCtx();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const titleToSave = songTitle.trim() || "Untitled Studio Master";
    const genreToSave = stylePrompt.trim() || "Electronic / Atmospheric";
    const finalLyrics = lyricsType === 'Instrumental' ? '[Instrumental Track - Synthesized by Studio DAW]' : lyricsText;

    setTimeout(() => {
      setIsGeneratingMidi(false);
      // Auto-save generated track immediately to persistent Library & Archive!
      const savedSong = autoSaveSongToLibrary({
        title: titleToSave,
        genre: genreToSave,
        lyrics: finalLyrics,
        theme: `Studio DAW Session (${bpm} BPM)`,
        engine: `Studio ${activeVersion}`,
        bpm: bpm
      });

      // Play right away to showcase the interactive DAW synthesizers!
      setIsPlaying(true);
      setStudioAutoSaveToast(`💾 Auto-saved: "${savedSong.title}" vaulted to your Library & Studio Archive!`);
      setTimeout(() => setStudioAutoSaveToast(null), 5500);
    }, 2800);
  };

  // Trigger professional AI advice
  const triggerGetAdvice = async () => {
    const selectedTrack = tracks.find(t => t.id === selectedTrackId);
    if (!selectedTrack) return;
    setIsCopilotThinking(true);
    try {
      const promptText = `Provide advanced multi-track mixing advice for a tracking channel titled "${selectedTrack.name}" inside an atmospheric ${stylePrompt} workstation context. Suggest detailed compression thresholds, dynamic EQ frequency notches, and reverb spatial width configuration in 1 short paragraph.`;
      const tipText = await generateMusicAdvice(promptText);
      setCopilotHistory(prev => [
        ...prev,
        { role: 'user', text: `Mix Scan: ${selectedTrack.name}` },
        { role: 'ai', text: tipText }
      ]);
    } catch (err) {
      alert('AI workstation assistant nodes syncing.');
    } finally {
      setIsCopilotThinking(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] text-[#e0e0e0] font-sans select-none overflow-hidden text-left relative">
      
      {/* Real-time Studio Auto-Save Toast Alert */}
      {studioAutoSaveToast && (
        <div className="fixed top-5 right-6 z-50 bg-[#131316] border border-orange-500/50 text-orange-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-3 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"></span>
          <span>{studioAutoSaveToast}</span>
          <button 
            onClick={() => setStudioAutoSaveToast(null)} 
            className="ml-2 text-zinc-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. TOP HEADER APP BAR (SUNO Studio Redesign style) */}
      <div className="h-12 bg-[#131316] border-b border-white/5 flex items-center justify-between px-4 z-40 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Logo brand */}
          <div className="flex items-center gap-1.5 cursor-pointer">
            <h1 className="text-sm font-extrabold tracking-[0.22em] text-white uppercase font-mono my-0 flex items-center gap-1.5">
              <span className="text-orange-400 text-base">☕</span>
              swcafe studio
            </h1>
            <span className="text-[9px] bg-[#1a1c24] text-zinc-400 font-extrabold px-1.5 py-0.5 rounded border border-white/5 font-mono">1.2</span>
          </div>

          <div className="h-4 w-px bg-white/10 mx-2"></div>

          {/* Prompt Mode Pill Selection */}
          <div className="flex bg-[#1a1a1e] p-0.5 rounded-lg border border-white/5">
            {(['Simple', 'Advanced', 'Sounds'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  activeMode === mode
                    ? 'bg-white/10 text-orange-400 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Engine version dropdown */}
          <select 
            value={activeVersion}
            onChange={(e) => setActiveVersion(e.target.value)}
            className="bg-[#1a1a1e] border border-white/5 rounded-lg px-2 py-1 text-[10px] font-bold text-zinc-300 pointer-events-auto outline-none cursor-pointer focus:border-orange-500/40"
          >
            <option value="v5.5">v5.5 Premier</option>
            <option value="v5">v5 Standard</option>
            <option value="v4">v4 Classic (Legacy)</option>
          </select>
        </div>

        {/* Center top-transport active song block */}
        <div className="hidden md:flex items-center gap-3 bg-[#1a1a1e] border border-white/5 py-1 px-3.5 rounded-full shadow-inner max-w-sm">
          <div className="h-4.5 w-4.5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex-shrink-0 animate-pulse"></div>
          <span className="text-[10px] font-black tracking-wide text-white font-mono uppercase truncate">
            {isPlaying ? '● On Air:' : '■ Idle:'} <span className="text-orange-400">{songTitle || 'Untitled Tape'}</span>
          </span>
          <span className="text-[8px] bg-orange-500/15 text-orange-400 px-1.5 my-0.5 rounded uppercase font-bold tracking-widest font-mono">
            {bpm} BPM
          </span>
        </div>

        {/* Right Help / Learn actions */}
        <div className="flex items-center gap-2">
          {/* Studio Auto-Save active status */}
          <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-orange-400 bg-orange-950/40 border border-orange-500/25 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
            <span>Auto-Save Active</span>
          </div>

          <button 
            onClick={() => alert(`🎹 Welcome to SwCafe Studio DAW v1.2!\n• Click "+ Audio" or "Inspo" on the left to preset lyrics & style.\n• Click the glowing "Create" button to compile stems.\n• Every song generated is automatically saved to your Library!\n• Use the bottom player grid to play, loop, adjust BPM, and solo different multitrack stems!`)}
            className="h-8 px-3 rounded-lg bg-[#1a1a1e] hover:bg-white/10 border border-white/5 flex items-center gap-1.5 text-[10px] font-bold text-zinc-300 transition-colors"
          >
            <HelpCircle size={12} className="text-zinc-400" />
            <span>Learn</span>
          </button>

          <button 
            onClick={() => {
              const fileData = JSON.stringify({ title: songTitle, lyrics: lyricsText, style: stylePrompt, bpm }, null, 2);
              const blob = new Blob([fileData], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${songTitle.toLowerCase().replace(/\s+/g, '_')}_master_stems.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="h-8 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white font-bold text-[10px] uppercase flex items-center gap-1 shadow-sm transition-all shadow-black/40"
          >
            <Download size={11} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. THREE-PANEL CORE DAW GRID */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* PANEL A: LEFT WORKBENCH SIDEBAR (lyrics, styles, settings) */}
        <div className="w-[280px] border-r border-white/5 bg-[#131316] flex flex-col shrink-0 min-h-0 z-30">
          
          {/* Quick Action Top buttons */}
          <div className="p-3 border-b border-white/5 flex gap-1.5 shrink-0">
            <button 
              onClick={() => {
                setSongTitle("Acoustic Twilight Rain");
                setStylePrompt("slow moody cinematic acoustics, soft nylon guitar, ambient rainy drone, warm sub");
                setLyricsText("[Verse 1]\nRaindrops gather on the rusty steel frame\nWhispering secrets I can no longer name\nLet the sound of the acoustic loop flow...");
              }}
              className="flex-1 py-1.5 bg-[#1a1a1e] hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-black uppercase text-orange-400 tracking-wider flex items-center justify-center gap-1 transition-all"
            >
              <Music size={10} />
              <span>+ Audio</span>
            </button>
            <button 
              onClick={onOpenVoice}
              className="flex-1 py-1.5 bg-[#1a1a1e] hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-black uppercase text-[#ec4899] tracking-wider flex items-center justify-center gap-1 transition-all relative"
            >
              <span className="absolute -top-1 -right-1 bg-pink-500 text-white font-black text-[6px] px-1 rounded-full animate-bounce">New</span>
              <span>+ Voice</span>
            </button>
            <button 
              onClick={() => {
                setStylePrompt("gothic dark electro punk, distortion drums, high gain fuzzy bass, modular sweeps");
                setSongTitle("Goth Industrial Grind");
              }}
              className="flex-1 py-1.5 bg-[#1a1a1e] hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-black uppercase text-cyan-400 tracking-wider flex items-center justify-center gap-1 transition-all"
            >
              <Sparkles size={10} />
              <span>Inspo</span>
            </button>
          </div>

          {/* Scrollable workbench container */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-left custom-scrollbar">
            
            {/* Folder 1: Lyrics Configuration */}
            <div className="space-y-2 border-b border-white/5 pb-3">
              <div 
                onClick={() => setIsLyricsOpen(!isLyricsOpen)}
                className="flex items-center justify-between cursor-pointer select-none py-1 text-zinc-400 hover:text-white"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-zinc-500 text-[8px]">{isLyricsOpen ? '▼' : '▶'}</span>
                  Lyrics
                </span>
                <span className="text-[8px] font-mono font-bold text-zinc-500">Ctrl+L</span>
              </div>

              {isLyricsOpen && (
                <div className="space-y-2.5 pt-1 animate-in fade-in-50">
                  {/* Lyrics mini tabs */}
                  <div className="flex bg-[#1a1a1e] p-0.5 rounded-md border border-white/5">
                    {(['Write', 'Prompt', 'Instrumental'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => {
                          setLyricsType(tab);
                          if (tab === 'Instrumental') {
                            setLyricsText("[Pure Synthesized Instrumental Track - No Vocal Layers Metaphysically Configured]");
                          }
                        }}
                        className={`flex-1 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all ${
                          lyricsType === tab
                            ? 'bg-white/10 text-orange-400'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Lyrics Text Box container matching mockup exactly */}
                  <div className="relative border border-white/5 bg-[#131316] rounded-xl overflow-hidden focus-within:border-orange-500/30 transition-all">
                    <textarea
                      value={lyricsText}
                      onChange={(e) => setLyricsText(e.target.value)}
                      disabled={lyricsType === 'Instrumental'}
                      className="w-full h-28 bg-transparent p-3 font-sans text-xs text-zinc-300 leading-normal focus:outline-none resize-none custom-scrollbar custom-placeholder"
                      style={{ caretColor: '#ff5e00' }}
                    />
                    
                    {/* Corner controls exactly like the image input */}
                    <div className="absolute bottom-2.5 left-3.5 right-3.5 flex justify-between items-center pointer-events-auto">
                      <div className="flex gap-1.5">
                        <button 
                          onClick={handleLyricsAutogen}
                          title="Generate high-craft lyrics" 
                          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-orange-400 transition-colors"
                        >
                          <Sparkles size={11} />
                        </button>
                        <button 
                          onClick={() => alert(`💡 Tip: Insert labels like [Chorus], [Verse], [Drop], [Heavy Riff] to guide neural AI track generation layers.`)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        >
                          <SlidersHorizontal size={11} />
                        </button>
                      </div>
                      <span className="text-[9px] text-zinc-600 font-mono">
                        {lyricsText ? lyricsText.length : 0} chr
                      </span>
                    </div>
                  </div>
                  
                  {generatedLyricsLog && (
                    <p className="text-[9px] text-orange-400 font-semibold italic mt-1 leading-snug">
                      {generatedLyricsLog}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Folder 2: Styles Selection */}
            <div className="space-y-2 border-b border-white/5 pb-3">
              <div 
                onClick={() => setIsStylesOpen(!isStylesOpen)}
                className="flex items-center justify-between cursor-pointer select-none py-1 text-zinc-400 hover:text-white"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-zinc-500 text-[8px]">{isStylesOpen ? '▼' : '▶'}</span>
                  Styles
                </span>
                <span className="text-[8px] font-mono font-bold text-zinc-500">Ctrl+S</span>
              </div>

              {isStylesOpen && (
                <div className="space-y-2 pt-1 animate-in fade-in-50">
                  <input
                    type="text"
                    value={stylePrompt}
                    onChange={(e) => setStylePrompt(e.target.value)}
                    placeholder="bolero, fast-paced beats, speech, ritmo..."
                    className="w-full bg-[#131316] border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/35 transition-all font-mono"
                  />
                  
                  {/* Preset quick pills */}
                  <div className="flex flex-wrap gap-1">
                    {['bolero', 'fast-paced beats', 'speech', 'ritmo', 'light piano', 'atmospheric'].map((pill) => {
                      const isActive = stylePrompt.includes(pill);
                      return (
                        <button
                          key={pill}
                          onClick={() => {
                            if (isActive) {
                              setStylePrompt(stylePrompt.replace(`${pill}, `, '').replace(pill, ''));
                            } else {
                              setStylePrompt(stylePrompt ? `${stylePrompt}, ${pill}` : pill);
                            }
                          }}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all border ${
                            isActive
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/25'
                              : 'bg-[#1a1a1e] text-zinc-400 border-white/5 hover:text-white'
                          }`}
                        >
                          {pill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Folder 3: More Options fold (tempo limits, key bindings) */}
            <div className="space-y-2 border-b border-white/5 pb-3">
              <div 
                onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                className="flex items-center justify-between cursor-pointer select-none py-1 text-zinc-400 hover:text-white"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-zinc-500 text-[8px]">{isOptionsOpen ? '▼' : '▶'}</span>
                  More Options
                </span>
              </div>

              {isOptionsOpen && (
                <div className="space-y-3 pt-1 text-left animate-in fade-in-50">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Selected BPM</label>
                    <div className="flex gap-2">
                      <input 
                        type="range" 
                        min="60" 
                        max="200" 
                        value={bpm} 
                        onChange={(e) => setBpm(parseInt(e.target.value))}
                        className="flex-1 accent-[#ff5e00] cursor-ew-resize"
                      />
                      <span className="text-[11px] font-bold text-orange-400 w-12 text-right font-mono">{bpm} BPM</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Time Signature</label>
                    <select 
                      value={timeSignature} 
                      onChange={(e) => setTimeSignature(e.target.value)}
                      className="w-full bg-[#1a1a1e] border border-white/5 rounded-lg px-2 py-1 text-xs text-zinc-300"
                    >
                      <option value="4/4">4/4 Common Time</option>
                      <option value="3/4">3/4 Waltz Beat</option>
                      <option value="6/8">6/8 Ballad Timings</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Song Title custom fields */}
            <div className="space-y-1 block mt-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Song Title (Optional)</label>
              <input
                type="text"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="Let You Go (Remix)"
                className="w-full bg-[#131316] border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-orange-500/40"
              />
            </div>

            {/* AI Mixing Copilot strip */}
            <div className="mt-4 bg-[#1a1a1e]/50 border border-white/5 rounded-xl p-3 space-y-2">
              <span className="text-[9px] font-extrabold text-[#ff711d] uppercase tracking-wider block">🎹 Copilot Signal Assist</span>
              <p className="text-[10px] text-zinc-400 font-sans leading-normal">
                Click index tracks on the grid, and scan them using live neural model advice lines.
              </p>
              
              <button 
                onClick={triggerGetAdvice}
                disabled={isCopilotThinking}
                className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/10 text-zinc-100 border border-white/5 text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                {isCopilotThinking ? (
                  <>
                    <span className="h-2 w-2 rounded-full border border-slate-300 border-t-transparent animate-spin"></span>
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={11} className="text-zinc-400" />
                    <span>Run Neural Mix Scan</span>
                  </>
                )}
              </button>

              {copilotHistory.length > 0 && (
                <div className="max-h-24 overflow-y-auto custom-scrollbar pt-1 pr-1 border-t border-white/5">
                  {copilotHistory.slice(-2).map((h, i) => (
                    <div key={i} className="text-[9px] leading-relaxed mt-1.5 border-b border-white/5/30 pb-1">
                      <span className="font-extrabold uppercase text-orange-400 tracking-wider">{h.role === 'user' ? 'Channel Filter' : 'Advice Outcome'}:</span>{' '}
                      <span className="text-zinc-300 font-sans italic">{h.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Core Creation Trigger at bottom */}
          <div className="p-3.5 bg-[#131316] border-t border-white/5 shrink-0 space-y-2">
            {/* Auto-Save indicator */}
            <div className="flex items-center justify-between text-[9px] text-orange-400 bg-orange-950/30 border border-orange-500/25 px-2.5 py-1 rounded-lg">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                <span>Auto-Save: Active</span>
              </div>
              <span className="text-[8px] text-orange-400/80">Every song saved to Library</span>
            </div>

            <button 
              onClick={handleCreateMagicSunoTrack}
              disabled={isGeneratingMidi}
              className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-600 hover:brightness-110 text-white font-black rounded-lg text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-black/40 active:scale-[0.98] transition-all"
            >
              {isGeneratingMidi ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
                  <span>Compiling Stems...</span>
                </>
              ) : (
                <>
                  <span>Create ♪</span>
                  <span className="text-[10px] text-white/70 font-bold tracking-normal font-mono bg-black/25 px-1.5 py-0.5 rounded">10 🪙</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* PANEL B: MIDDLE TIMELINE PANEL (Arrangement visualizer, ruler, detailed wave view) */}
        <div className="flex-1 bg-[#131316] flex flex-col min-w-0 overflow-hidden relative">
          
          {/* Timeline Header Row (with song select, playhead slider triggers, Undo/Redo) */}
          <div className="h-10 bg-[#131316] border-b border-white/5 flex items-center justify-between px-3.5 shrink-0 z-20">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => alert('Channel selection backward matrix mapped.')}
                className="h-6 w-6 rounded-md hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors text-xs font-bold"
              >
                ←
              </button>

              {/* Middle Title Pill matching mockup */}
              <div className="flex items-center gap-2 bg-[#1a1a1e] hover:bg-white/10 border border-white/5 rounded-full py-1 px-3 cursor-pointer select-none">
                <span className="h-4.5 w-4.5 rounded-md bg-orange-500/20 text-orange-400 text-[8px] font-black flex items-center justify-center font-mono">D</span>
                <span className="text-[10px] font-extrabold text-zinc-200 uppercase tracking-tight">{songTitle || "Don't Hate"}</span>
              </div>
            </div>

            {/* Undo, Redo, Export dropdown helpers */}
            <div className="flex gap-1">
              <button 
                onClick={() => alert('Undo action!')}
                title="Undo"
                className="h-7 w-7 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
              >
                ↶
              </button>
              <button 
                onClick={() => alert('Redo action!')}
                title="Redo"
                className="h-7 w-7 rounded-md hover:bg-white/5 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
              >
                ↷
              </button>
              
              <div className="h-4 w-px bg-white/10 mx-1 self-center"></div>

              {/* Version pill indicators */}
              <div className="flex items-center gap-1.5 text-[8px] font-black text-[#10b981] uppercase tracking-widest bg-[#10b981]/10 px-2.0 py-1 rounded-full border border-[#10b981]/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-ping"></span>
                <span>Active Link v5.5</span>
              </div>
            </div>
          </div>

          {/* Timeline Grid Space containing multi-track blocks */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar relative">
            
            {/* Timeline Bars Grid Header (1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89, 97...) */}
            <div className="h-7 bg-[#131316]/60 border-b border-white/5 flex relative shrink-0">
              <div className="w-[180px] h-full border-r border-white/5 bg-[#131316]/50 shrink-0 select-none flex items-center px-4">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Channel Matrix</span>
              </div>
              <div className="flex-1 h-full relative select-none">
                {/* Visual intervals matching timeline image */}
                {[1, 17, 33, 49, 65, 81, 97, 113, 129].map((bar, idx) => (
                  <div 
                    key={bar} 
                    className="absolute top-0 bottom-0 border-l border-white/5 flex flex-col justify-center pl-1.5" 
                    style={{ left: `${(idx / 8) * 100}%` }}
                  >
                    <span className="text-[8px] font-mono text-zinc-600 font-extrabold">{bar}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scrolling Arrangement tracks container */}
            <div className="flex-1 relative min-h-0 min-w-0">
              
              {/* Dynamic playhead line */}
              <div 
                className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 z-20 pointer-events-none shadow-[0_0_12px_rgba(239,68,68,0.7)]" 
                style={{ left: `calc(180px + ${playhead}%)` }}
              >
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-[4.5px] -mt-0.5 border border-white/20 shadow-md"></div>
              </div>

              {/* Multi-track Channels row list */}
              {tracks.map((track) => {
                const isSelected = selectedTrackId === track.id;
                return (
                  <div 
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`h-16 border-b border-white/5 flex hover:bg-white/[0.015] transition-all cursor-pointer ${
                      isSelected ? 'bg-white/[0.035]' : ''
                    }`}
                  >
                    {/* Track properties (Left bar of row) */}
                    <div className={`w-[180px] h-full border-r border-white/5 flex flex-col justify-center px-3 gap-1.5 shrink-0 select-none ${
                        isSelected ? 'bg-[#1a1a1e]' : 'bg-[#131316]/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black truncate max-w-[110px] tracking-tight uppercase ${track.textColor}`}>
                          {track.name}
                        </span>
                        
                        {/* Dynamic live peak indicators to simulation volume heights */}
                        <div className="flex items-end gap-0.5 h-3 justify-center w-8 bg-[#131316] px-1 rounded-sm border border-white/5">
                          <span className="w-1 bg-[#10b981] transition-all duration-75 rounded-t-xs" style={{ height: `${isPlaying && !track.muted ? peakLevels[track.id] * 0.7 : 2}%` }}></span>
                          <span className="w-1 bg-yellow-400 transition-all duration-75 rounded-t-xs" style={{ height: `${isPlaying && !track.muted ? peakLevels[track.id] * 0.6 : 2}%` }}></span>
                          <span className="w-1 bg-red-500 transition-all duration-75 rounded-t-xs" style={{ height: `${isPlaying && !track.muted ? peakLevels[track.id] * 0.45 : 2}%` }}></span>
                        </div>
                      </div>

                      {/* Controls: Solo, Mute, Volume strip */}
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTracks(tracks.map(t => t.id === track.id ? { ...t, solo: !t.solo } : t));
                          }}
                          className={`w-6 h-5 rounded text-[8px] font-black transition-colors ${
                            track.solo 
                              ? 'bg-yellow-500 text-black' 
                              : 'bg-white/10 hover:bg-zinc-700 text-zinc-400'
                          }`}
                        >
                          S
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTracks(tracks.map(t => t.id === track.id ? { ...t, muted: !t.muted } : t));
                          }}
                          className={`w-6 h-5 rounded text-[8px] font-black transition-colors ${
                            track.muted 
                              ? 'bg-red-500 text-white' 
                              : 'bg-white/10 hover:bg-zinc-700 text-zinc-400'
                          }`}
                        >
                          M
                        </button>

                        {/* Slider bar for Individual Track Volume */}
                        <div className="flex-1 flex items-center gap-1 bg-[#1a1a1e] py-0.5 px-1.5 rounded border border-white/5 relative h-5 select-none shrink-0 overflow-hidden">
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={track.volume}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const nv = parseInt(e.target.value);
                              setTracks(tracks.map(t => t.id === track.id ? { ...t, volume: nv } : t));
                            }}
                            className="w-full accent-[#ff5e00] h-1.5 outline-none bg-transparent cursor-ew-resize scale-y-75"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Timeline grid clip space */}
                    <div className="flex-1 relative bg-[#131316]/15 select-none overflow-hidden h-full">
                      {/* Vertical Grid Gridlines to preserve visual integrity */}
                      <div className="absolute inset-0 flex justify-between pointer-events-none opacity-5">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(g => (
                          <div key={g} className="h-full w-px bg-white"></div>
                        ))}
                      </div>

                      {/* Wave Blocks matched exactly with screenshot layout */}
                      <div 
                        className={`absolute top-2 bottom-2 rounded-lg border flex flex-col justify-center px-4 transition-all hover:brightness-110 shadow-md ${track.color}`}
                        style={{
                          left: track.id === '1' ? '12%' : track.id === '2' ? '20%' : track.id === '3' ? '30%' : track.id === '4' ? '15%' : '0%',
                          width: track.id === '1' ? '65%' : track.id === '2' ? '50%' : track.id === '3' ? '45%' : track.id === '4' ? '60%' : '75%'
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-[10px] font-black tracking-widest uppercase truncate ${track.textColor}`}>
                            {songTitle} ({track.name})
                          </span>
                          <span className="text-[7.5px] opacity-40 font-mono">00:24 - 01:45</span>
                        </div>
                        {/* Dynamic mini synthesized waves rendering overlay */}
                        <div className="flex gap-0.5 items-center h-4 pt-1 opacity-40">
                          {Array.from({ length: 48 }).map((_, waveIdx) => {
                            const val = Math.sin((waveIdx + parseInt(track.id)) * 0.4) * 6 + 7;
                            return (
                              <div 
                                key={waveIdx} 
                                className="w-[1.5px] bg-white transition-all duration-300"
                                style={{
                                  height: `${isPlaying && !track.muted ? (Math.random() * val + 3) : val}px`,
                                  backgroundColor: track.accentColor
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* FLOATING PILL BAR (Vocals ▾ | Styles | Lyrics | Cover) exactly like the design */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center bg-[#0a0a0b]/90 border border-white/5 shadow-2xl p-1 rounded-full text-zinc-300 gap-1 backdrop-blur-md">
                <button 
                  onClick={() => alert('Vocals layer drop mapped.')} 
                  className="px-4 py-1.5 hover:bg-white/10 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 text-white"
                >
                  <span className="h-2 w-2 rounded-full bg-[#10b981]"></span>
                  <span>Vocals ▾</span>
                </button>
                <span className="h-3 w-px bg-white/10"></span>
                <button 
                  onClick={() => setIsStylesOpen(true)}
                  className="px-4 py-1.5 hover:bg-white/10 rounded-full text-[10px] font-bold tracking-wider uppercase"
                >
                  Styles
                </button>
                <span className="h-3 w-px bg-white/10"></span>
                <button 
                  onClick={() => setIsLyricsOpen(true)}
                  className="px-4 py-1.5 hover:bg-white/10 rounded-full text-[10px] font-bold tracking-wider uppercase"
                >
                  Lyrics
                </button>
                <span className="h-3 w-px bg-white/10"></span>
                <button 
                  onClick={() => {
                    alert('Generating audio Cover layer remix stems!');
                    handleCreateMagicSunoTrack();
                  }}
                  className="px-5 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:brightness-110 text-white rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 select-none"
                >
                  <span>Cover</span>
                </button>
              </div>

            </div>
          </div>

          {/* Bottom zoom details waveform canvas panel (gorgeous detailed Wave Editor) */}
          <div className="h-[230px] border-t border-white/5 bg-[#131316] flex flex-col shrink-0 select-none relative">
            
            {/* Header controls overlay */}
            <div className="p-2 bg-[#131316] border-b border-white/5 flex items-center justify-between shrink-0 px-4">
              <div className="flex items-center gap-4 text-left">
                <span className="text-[10px] font-black tracking-widest text-orange-400 uppercase font-mono">
                  {songTitle} (Vocals Zoom-Grid)
                </span>
                <div className="h-3.5 w-px bg-white/10"></div>
                <span className="text-[9px] text-[#10b981] font-bold uppercase tracking-wider">Timestretch On</span>
                <span className="text-[9px] text-zinc-500 hover:text-white cursor-pointer transition-colors uppercase font-bold" onClick={() => alert('Markers reset to zero!')}>Reset Markers</span>
                <span className="text-[9px] text-zinc-500 hover:text-white cursor-pointer transition-colors uppercase font-bold" onClick={() => alert('Grid snapped to 101 BPM!')}>Quantize</span>
              </div>
              <button 
                onClick={() => alert('Timeline cut slice initiated.')}
                className="h-6 w-6 hover:bg-white/10 rounded flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                title="Split Wave Clip"
              >
                <Scissors size={12} />
              </button>
            </div>

            {/* Waveform Drawing Block */}
            <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-black/25">
              
              {/* Play scrubber scrub vertical line */}
              <div 
                className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-10 pointer-events-none"
                style={{ left: `${playhead}%` }}
              >
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-[4.5px] shadow-lg"></div>
              </div>

              {/* Glowing horizontal Stereo dual waveform */}
              <div className="w-full h-28 relative flex items-center justify-between gap-[1.5px] px-6 select-none">
                {Array.from({ length: 120 }).map((_, waveIdx) => {
                  // Create organic wave shape with dynamic offsets
                  const sineFactor = Math.sin(waveIdx * 0.12) * Math.cos(waveIdx * 0.05);
                  const randomSway = isPlaying ? Math.random() * 8 + 4 : 8;
                  const ampVal = Math.abs(sineFactor) * 36 + randomSway;
                  const isScrubbed = (waveIdx / 120) * 100 <= playhead;

                  return (
                    <div 
                      key={waveIdx} 
                      className="flex-1 flex flex-col justify-center select-none"
                      onClick={(e) => {
                        const nextP = (waveIdx / 120) * 100;
                        setPlayhead(nextP);
                      }}
                    >
                      {/* Top waveform bar */}
                      <div 
                        className={`w-full transition-all duration-150 rounded-t-full ${
                          isScrubbed 
                            ? 'bg-gradient-to-t from-violet-500 to-[#c084fc] shadow-[0_0_10px_rgba(168,85,247,0.3)]' 
                            : 'bg-white/10'
                        }`}
                        style={{ height: `${ampVal}px` }}
                      />
                      <div className="h-[2px]" />
                      {/* Bottom waveform bar */}
                      <div 
                        className={`w-full transition-all duration-150 rounded-b-full ${
                          isScrubbed 
                            ? 'bg-gradient-to-b from-blue-500 to-indigo-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                            : 'bg-white/10'
                        }`}
                        style={{ height: `${ampVal * 0.8}px` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Interactive micro timing rulers under the wave */}
              <div className="absolute bottom-2 left-6 right-6 flex justify-between text-[7px] font-mono text-zinc-600">
                <span>00:00</span>
                <span>00:15</span>
                <span>00:30</span>
                <span>00:45</span>
                <span>01:00</span>
                <span>01:15</span>
                <span>01:30</span>
                <span>01:45</span>
                <span>02:00</span>
              </div>
            </div>

            {/* DAW METRICS TRANSPORT BOTTOM BAR */}
            <div className="h-10 bg-[#0a0a0b] border-t border-white/5 flex items-center justify-between px-4 shrink-0 px-3 z-30 select-none">
              
              {/* Left actions */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const nextId = (tracks.length + 1).toString();
                    setTracks([
                      ...tracks,
                      { id: nextId, name: `Synth ${nextId}`, color: 'bg-indigo-900/25 border-l-4 border-indigo-500', textColor: 'text-indigo-400', accentColor: '#6366f1', active: true, muted: false, solo: false, volume: 75, input: 'No Input' }
                    ]);
                    alert('Custom audio track mapped to timeline grid!');
                  }}
                  className="h-6.5 px-2 bg-[#1a1a1e] hover:bg-white/10 text-[9px] font-black uppercase tracking-wider text-zinc-300 rounded border border-white/5 flex items-center gap-1 transition-colors"
                >
                  <Plus size={10} />
                  <span>Track</span>
                </button>
                
                <button 
                  onClick={() => alert('Launch file explorer to upload WAV or MP3 stem files...')}
                  className="h-6.5 px-2 bg-[#1a1a1e] hover:bg-white/10 text-[9px] font-black uppercase tracking-wider text-zinc-300 rounded border border-white/5 flex items-center gap-1 transition-colors"
                >
                  <Upload size={10} />
                  <span>Upload</span>
                </button>

                <div className="h-4 w-px bg-white/10 mx-1"></div>

                {/* Meter matrix metadata */}
                <div className="flex gap-2 text-[10px] font-mono select-none">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-600 font-extrabold uppercase text-[8px] tracking-wide">Sig</span>
                    <span className="text-zinc-300 font-bold">{timeSignature}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-600 font-extrabold uppercase text-[8px] tracking-wide">BPM</span>
                    <input 
                      type="number" 
                      value={bpm}
                      onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))}
                      className="bg-transparent border-none text-zinc-300 w-8 outline-none font-bold p-0 text-center select-all focus:ring-0"
                    />
                  </div>
                </div>
              </div>

              {/* Center transport buttons */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setPlayhead(0);
                    setActiveTimeStr('00:00.000');
                    setActiveBarBeats('001.1.00');
                  }}
                  className="w-6 h-6 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Rewind to start"
                >
                  <RotateCcw size={13} />
                </button>

                {/* Play/Pause CTA */}
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${
                    isPlaying 
                      ? 'bg-red-500 text-white shadow-red-950/20' 
                      : 'bg-gradient-to-r from-orange-500 to-red-600 text-black shadow-black/40 hover:scale-105'
                  }`}
                  title={isPlaying ? 'Pause Synthesizer' : 'Play Synthesizer'}
                >
                  {isPlaying ? (
                    <Pause size={14} className="fill-current text-white" />
                  ) : (
                    <Play size={14} className="fill-current text-black ml-0.5" />
                  )}
                </button>

                {/* Looper toggle */}
                <button 
                  onClick={() => setIsLooping(!isLooping)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-colors border ${
                    isLooping 
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/25' 
                      : 'bg-[#1a1a1e] border-white/5 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Loop
                </button>

                {/* Metronome toggle */}
                <button 
                  onClick={() => setMetronomeOn(!metronomeOn)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-colors border ${
                    metronomeOn 
                      ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25' 
                      : 'bg-[#1a1a1e] border-white/5 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Click
                </button>
              </div>

              {/* Right timing feedback + Master volume slider */}
              <div className="flex items-center gap-3">
                {/* Numeric Time Counter */}
                <div className="flex bg-[#1a1a1e] rounded border border-white/5 py-0.5 px-2.5 items-center gap-3">
                  <span className="text-[10px] font-mono text-cyan-400 font-extrabold tabular-nums tracking-wide">{activeTimeStr}</span>
                  <div className="h-3 w-px bg-white/10"></div>
                  <span className="text-[10px] font-mono text-orange-400 font-extrabold tabular-nums tracking-wide">{activeBarBeats}</span>
                </div>

                {/* Master volume controller */}
                <div className="flex items-center gap-1.5">
                  <Volume2 size={12} className="text-zinc-500 shrink-0" />
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={masterVolume} 
                    onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                    className="w-16 accent-[#ff5e00] h-1 bg-white/10 rounded-lg cursor-ew-resize opacity-80 hover:opacity-100"
                  />
                  <span className="text-[9px] font-mono font-black text-zinc-400 w-5 text-right">{masterVolume}%</span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* PANEL C: RIGHT INSPECTOR PANEL (Clip Settings, Stems Extractor) */}
        <div className="w-[280px] border-l border-white/5 bg-[#131316] flex flex-col shrink-0 min-h-0 z-30 text-left">
          
          {/* Header thumbnail and tag info block */}
          <div className="p-4 border-b border-white/5 shrink-0 flex items-center gap-3 bg-black/15">
            <div className="h-10 w-10 rounded-xl overflow-hidden bg-[#1a1a1e] border border-white/10 relative">
              <img 
                src="https://picsum.photos/seed/sunodaw/100/100" 
                alt="Don't Hate Album Art" 
                className="h-full w-full object-cover opacity-85"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-zinc-100 font-black text-[11px] uppercase tracking-tight truncate">
                <span>{songTitle}</span>
                <span className="text-zinc-500 italic text-[9px]">✎</span>
              </div>
              <p className="text-[8px] text-orange-400 font-black uppercase tracking-wider font-mono mt-0.5">Premier Calibrated</p>
            </div>
          </div>

          {/* Action Row buttons (Remix, vote thumbs) */}
          <div className="p-3 border-b border-white/5 shrink-0 flex items-center gap-1 bg-[#1a1a1e]/40">
            <button 
              onClick={() => {
                alert(`Stem mixing mapped! Styles set to atmospheric, chord settings synchronized.`);
                setStylePrompt("slow moody organic acoustics, electronic trap snare, ambient pads");
              }}
              className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/10 border border-white/5 text-[9px] font-black uppercase text-zinc-200 tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>♻ Remix</span>
            </button>
            
            <button 
              onClick={() => alert('Voted up track remix!')}
              className="h-7 w-7 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center justify-center text-xs"
              title="Like stem"
            >
              👍
            </button>
            <button 
              onClick={() => alert('Voted down track remix!')}
              className="h-7 w-7 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center justify-center text-xs"
              title="Dislike stem"
            >
              👎
            </button>
            
            <span className="flex-1"></span>
            
            <button 
              onClick={() => alert('Export WAV, MIDI, or separate Multi-track audio loops.')}
              className="h-7 w-7 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex items-center justify-center text-xs font-black"
            >
              •••
            </button>
          </div>

          {/* Scrollable list of Accordion control boxes */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar text-left">
            
            {/* Clip Settings fold */}
            <div className="space-y-3 bg-[#1a1a1e]/70 border border-white/5 rounded-2xl p-3.5 shadow-inner">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Clip Settings</span>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <span>Sync Timing</span>
                  <span className="text-orange-400">{tempoMatch}</span>
                </div>
                <select 
                  value={tempoMatch} 
                  onChange={(e) => setTempoMatch(e.target.value as any)}
                  className="w-full bg-[#131316] border border-white/5 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
                >
                  <option value="On Beat">On Beat Quantized</option>
                  <option value="Free Scroll">Free Scroll</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider items-center">
                  <span>Transpose Pitch</span>
                  <span className="text-orange-400 font-mono font-bold">{transposeSemitones > 0 ? `+${transposeSemitones}` : transposeSemitones} st</span>
                </div>
                
                <div className="flex gap-2 items-center">
                  <button 
                    onClick={() => setTransposeSemitones(prev => Math.max(-12, prev - 1))}
                    className="w-8 h-7 bg-[#1a1a1e] hover:bg-white/10 text-white rounded-lg border border-white/5 font-extrabold text-xs"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-black/60 rounded-lg py-1 text-center font-mono text-xs text-zinc-300 font-bold border border-white/5">
                    {transposeSemitones}
                  </div>
                  <button 
                    onClick={() => setTransposeSemitones(prev => Math.min(12, prev + 1))}
                    className="w-8 h-7 bg-[#1a1a1e] hover:bg-white/10 text-white rounded-lg border border-white/5 font-extrabold text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider block">Playback Speed</span>
                <div className="flex bg-[#131316] p-0.5 rounded-lg border border-white/5">
                  {(['1/2', 'original', 'x2'] as const).map(speed => (
                    <button
                      key={speed}
                      onClick={() => {
                        setSpeedMultiplier(speed);
                        if (speed === '1/2') setBpm(Math.floor(bpm / 2));
                        if (speed === 'x2') setBpm(bpm * 2);
                      }}
                      className={`flex-1 py-1 text-[9px] font-black uppercase rounded transition-all ${
                        speedMultiplier === speed
                          ? 'bg-white/10 text-cyan-400'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {speed === 'original' ? '1x' : speed}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <span>Clip Volume Gain</span>
                  <span className="text-zinc-400 font-mono font-bold">{clipVolume}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={clipVolume} 
                  onChange={(e) => setClipVolume(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-ew-resize h-1 bg-white/10 rounded-lg"
                />
              </div>

            </div>

            {/* Stems list fold */}
            <div className="space-y-3 bg-[#1a1a1e]/70 border border-white/5 rounded-2xl p-3.5 shadow-inner text-left">
              <div className="flex justify-between items-center pb-1">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest font-mono">Stems Extracted</span>
                
                <button 
                  onClick={() => {
                    alert('Running deep spectral splitter on core tracking lines...');
                    setTimeout(() => {
                      alert('Stems extracted successfully! Stems collection updated below.');
                    }, 1200);
                  }}
                  className="px-2 py-0.5 bg-[#4f46e5]/10 hover:bg-[#4f46e5]/25 text-[#a5b4fc] border border-[#4f46e5]/20 rounded text-[9px] font-black uppercase tracking-wider transition-colors"
                >
                  ✂ Extract
                </button>
              </div>

              {/* List of extracted elements with stylized mini waveform loops */}
              <div className="space-y-2.5">
                {stems.map((stem) => (
                  <div 
                    key={stem.id} 
                    className={`p-2 bg-[#131316] rounded-xl border flex flex-col gap-1 transition-all hover:bg-[#1a1a1e]/60 ${
                      stem.active ? 'border-white/5' : 'border-dashed border-white/5 opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-tight text-zinc-300 uppercase truncate max-w-[130px]">
                        {stem.name}
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => setStems(stems.map(s => s.id === stem.id ? { ...s, muted: !s.muted } : s))}
                          className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold ${
                            stem.muted ? 'bg-red-950 text-red-400 border border-red-500/30' : 'bg-white/10 text-zinc-400 hover:text-white'
                          }`}
                        >
                          Mute
                        </button>
                        <button 
                          onClick={() => {
                            setStems(stems.map(s => s.id === stem.id ? { ...s, active: !s.active } : s));
                          }}
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete stem reference"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Simulated mini detailed wave loops */}
                    <div className="h-6 bg-[#131316] rounded-md overflow-hidden flex items-center justify-between gap-[1px] px-2 select-none relative">
                      {Array.from({ length: 32 }).map((_, idx) => {
                        const heights = Math.abs(Math.sin((idx + stem.waveformSeed) * 0.42)) * 14 + 2;
                        return (
                          <div 
                            key={idx} 
                            style={{ height: `${heights}px` }} 
                            className={`flex-1 rounded-sm ${
                              stem.muted 
                                ? 'bg-zinc-700' 
                                : 'bg-gradient-to-t from-violet-600 to-indigo-500'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      <style>{`
        /* Micro typography enhancements for professional look */
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .custom-placeholder::placeholder {
          color: rgba(71, 85, 105, 0.9);
          font-style: italic;
        }
        input[type=range] {
          -webkit-appearance: none;
          background: rgba(255,255,255,0.05);
          height: 4px;
          border-radius: 9999px;
        }
        input[type=range]:focus {
          outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 9999px;
          background: #ff5e00;
          cursor: ew-resize;
          box-shadow: 0 0 8px rgba(255, 94, 0, 0.5);
          transition: transform 0.1s;
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
};

export default StudioView;
