import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Plus, Upload, Sparkles, Volume2, Download, Music, Trash2, Repeat, Scissors, Send } from 'lucide-react';
import { suggestLyricsChujai, generateMusicAdvice } from '../geminiService';
import { autoSaveSongToLibrary, getSavedSongsWithRecalled, SavedSong } from '../songs';

/**
 * SwCafe Studio — hybrid workstation.
 *
 * Layout/workflow paradigms (original implementation, SwCafe branding throughout):
 * - Logic-style: control-bar transport, ruler, track headers, per-lane channel
 *   strip in the inspector, master bus, bounce to a mix file.
 * - Suno-style: song-structure sections overlaid on the timeline, lyrics
 *   synced to sections, replace-section and extend workflows.
 *
 * Everything here is wired to real SwCafe capabilities: MusicGen generation
 * via the Netlify function, the localStorage song library, real audio
 * playback through the Web Audio graph, and real file uploads as lanes.
 * What is NOT real is labeled in the UI: stem separation has no engine
 * connected yet, and MusicGen is instrumental-only (lyrics shape the mood,
 * they are not sung).
 */

interface Lane {
  id: string;
  name: string;
  color: string;
  kind: 'master' | 'upload';
  audioUrl: string;
  volume: number; // 0..100
  pan: number; // -100..100
  muted: boolean;
  solo: boolean;
}

interface Section {
  id: string;
  label: string;
  start: number;
  end: number;
  text: string;
}

interface LaneNodes {
  el: HTMLAudioElement;
  src: MediaElementAudioSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
}

const ENGINE_URL = '/.netlify/functions/generate-music';
const LANE_COLORS = ['#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1', '#84cc16'];

const fmtTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const barBeat = (t: number, bpm: number, beatsPerBar: number): string => {
  const beatDur = 60 / bpm;
  const barDur = beatDur * beatsPerBar;
  const bar = Math.floor(t / barDur) + 1;
  const beat = Math.floor((t % barDur) / beatDur) + 1;
  return `${bar.toString().padStart(3, '0')}.${beat}`;
};

/** Split lyrics into sections on bracketed headers ([Intro], [Verse 1], ...). */
const parseSections = (lyrics: string, duration: number): Section[] => {
  const text = (lyrics || '').trim();
  if (!text) return [{ id: 'full', label: 'Full Song', start: 0, end: duration, text: '' }];
  const headerRe = /^\[(.+?)\]\s*$/gm;
  const matches = [...text.matchAll(headerRe)];
  if (matches.length === 0) return [{ id: 'full', label: 'Full Song', start: 0, end: duration, text }];
  const raw: { label: string; startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const startIdx = (m.index ?? 0) + m[0].length;
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    raw.push({ label: m[1].trim(), startIdx, endIdx });
  }
  const total = Math.max(1, text.length);
  return raw.map((r, i) => ({
    id: `sec-${i}`,
    label: r.label,
    start: (r.startIdx / total) * duration,
    end: i + 1 < raw.length ? (raw[i + 1].startIdx / total) * duration : duration,
    text: text.slice(r.startIdx, r.endIdx).trim(),
  }));
};

/** Deterministic placeholder peaks (used only when real decode fails). */
const seededPeaks = (seed: string, n: number): number[] => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    const r = (h >>> 0) / 4294967295;
    out.push(0.18 + Math.abs(Math.sin(i * 0.35 + r * 2.1)) * 0.55 + r * 0.25);
  }
  return out;
};

const StudioView: React.FC<{ onOpenVoice: () => void; onPlay?: (title: string, artist: string, cover: string, audioUrl?: string) => void }> = ({ onOpenVoice, onPlay }) => {
  // --- Session / library ---
  const [library, setLibrary] = useState<SavedSong[]>([]);
  const [loadedSong, setLoadedSong] = useState<SavedSong | null>(null);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // --- Transport ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bpm, setBpm] = useState(101);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [speed, setSpeed] = useState(1);
  const [masterVolume, setMasterVolume] = useState(80);
  const [loopOn, setLoopOn] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);

  // --- Generate form ---
  const [genTitle, setGenTitle] = useState('');
  const [genStyle, setGenStyle] = useState('atmospheric, cinematic soul');
  const [genLyrics, setGenLyrics] = useState('[Intro]\n[Verse]\n[Chorus]\n[Outro]');
  const [genLength, setGenLength] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');

  // --- Inspector / lyrics ---
  const [inspectorTab, setInspectorTab] = useState<'channel' | 'lyrics'>('channel');
  const [copilotAdvice, setCopilotAdvice] = useState<string | null>(null);
  const [isAskingCopilot, setIsAskingCopilot] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionText, setEditingSectionText] = useState('');
  const [isBouncing, setIsBouncing] = useState(false);

  // --- Audio graph refs (always current; avoids stale closures in element callbacks) ---
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<Map<string, LaneNodes>>(new Map());
  const lanesRef = useRef<Lane[]>([]);
  const speedRef = useRef(1);
  const loopRef = useRef({ on: false, start: 0, end: 0 });
  const cancelRequestedRef = useRef(false);
  const activePredictionIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [peaks, setPeaks] = useState<Record<string, number[]>>({});

  useEffect(() => { lanesRef.current = lanes; }, [lanes]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { loopRef.current = { on: loopOn, start: loopStart, end: loopEnd }; }, [loopOn, loopStart, loopEnd]);
  useEffect(() => {
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setTargetAtTime((masterVolume / 100) * 0.9, ctxRef.current.currentTime, 0.03);
    }
  }, [masterVolume]);

  // Load library on mount and refresh when other views save songs.
  useEffect(() => {
    const load = () => setLibrary(getSavedSongsWithRecalled());
    load();
    const onUpdate = () => load();
    window.addEventListener('swcafe_library_updated', onUpdate);
    return () => window.removeEventListener('swcafe_library_updated', onUpdate);
  }, []);

  // Teardown graph on unmount.
  useEffect(() => () => teardownGraph(), []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 5500);
  };

  const beatsPerBar = parseInt(timeSignature.split('/')[0], 10) || 4;

  // Sections derive from the loaded song's lyrics and the real duration.
  const sections: Section[] = loadedSong ? parseSections(loadedSong.lyrics, duration > 0 ? duration : 60) : [];
  const activeSection = sections.length > 0
    ? sections.reduce((acc, s) => (currentTime >= s.start ? s : acc), sections[0])
    : null;

  const ensureGraph = (): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = (masterVolume / 100) * 0.9;
    master.connect(ctx.destination);
    ctxRef.current = ctx;
    masterGainRef.current = master;
    return ctx;
  };

  const teardownGraph = () => {
    nodesRef.current.forEach(n => {
      try { n.el.pause(); } catch { /* noop */ }
      try { n.src.disconnect(); n.gain.disconnect(); n.pan.disconnect(); } catch { /* noop */ }
    });
    nodesRef.current.clear();
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
      masterGainRef.current = null;
    }
  };

  const applyMix = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const anySolo = lanesRef.current.some(l => l.solo);
    lanesRef.current.forEach(lane => {
      const nodes = nodesRef.current.get(lane.id);
      if (!nodes) return;
      const effective = lane.muted ? 0 : (anySolo && !lane.solo ? 0 : lane.volume / 100);
      nodes.gain.gain.setTargetAtTime(effective, ctx.currentTime, 0.03);
      nodes.pan.pan.setTargetAtTime(lane.pan / 100, ctx.currentTime, 0.03);
    });
  };

  const ensureLaneNode = (lane: Lane, isMaster: boolean): LaneNodes | null => {
    const existing = nodesRef.current.get(lane.id);
    if (existing) return existing;
    const ctx = ensureGraph();
    if (!ctx || !masterGainRef.current) return null;
    const el = new Audio();
    el.preload = 'auto';
    el.src = lane.audioUrl;
    el.playbackRate = speedRef.current;
    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    src.connect(gain); gain.connect(pan); pan.connect(masterGainRef.current);
    const nodes: LaneNodes = { el, src, gain, pan };
    nodesRef.current.set(lane.id, nodes);
    if (isMaster) {
      el.addEventListener('timeupdate', () => {
        const t = el.currentTime;
        setCurrentTime(t);
        const loop = loopRef.current;
        if (loop.on && t >= loop.end && loop.end > loop.start) {
          seekAll(loop.start);
        }
      });
      el.addEventListener('loadedmetadata', () => setDuration(el.duration || 0));
      el.addEventListener('ended', () => setIsPlaying(false));
    }
    return nodes;
  };

  const seekAll = (t: number) => {
    nodesRef.current.forEach(n => {
      try { n.el.currentTime = Math.min(t, n.el.duration || t); } catch { /* noop */ }
    });
    setCurrentTime(t);
  };

  const playAll = () => {
    const ctx = ensureGraph();
    if (!ctx) { showToast('Audio is not available in this browser.'); return; }
    if (ctx.state === 'suspended') void ctx.resume();
    lanesRef.current.forEach((lane, i) => ensureLaneNode(lane, i === 0));
    applyMix();
    nodesRef.current.forEach(n => { n.el.playbackRate = speedRef.current; n.el.play().catch(() => undefined); });
    setIsPlaying(true);
  };

  const pauseAll = () => {
    nodesRef.current.forEach(n => { try { n.el.pause(); } catch { /* noop */ } });
    setIsPlaying(false);
  };

  const stopAll = () => { pauseAll(); seekAll(0); };

  const togglePlay = () => {
    if (lanes.length === 0) { showToast('Load a song or generate one first.'); return; }
    if (isPlaying) pauseAll(); else playAll();
  };

  /** Load a song as the session master lane (tears down any previous graph). */
  const loadSong = (song: SavedSong) => {
    if (!song.audioUrl) {
      setGenTitle(song.title);
      setGenStyle(song.genre);
      setGenLyrics(song.lyrics);
      showToast(`"${song.title}" has lyrics but no audio yet — the generate form is filled in. Generate it to load it here.`);
      return;
    }
    pauseAll();
    teardownGraph();
    setLoadedSong(song);
    setCurrentTime(0);
    setDuration(0);
    const master: Lane = { id: 'master', name: 'Master Mix', color: '#f97316', kind: 'master', audioUrl: song.audioUrl, volume: 90, pan: 0, muted: false, solo: false };
    setLanes([master]);
    setSelectedLaneId('master');
    setLoopOn(false); setLoopStart(0); setLoopEnd(0);
    setInspectorTab('channel');
    void computePeaks('master', song.audioUrl);
  };

  const addUploadLane = (file: File) => {
    const url = URL.createObjectURL(file);
    const color = LANE_COLORS[(lanes.length) % LANE_COLORS.length];
    const lane: Lane = {
      id: `up-${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, '') || 'Upload',
      color, kind: 'upload', audioUrl: url, volume: 80, pan: 0, muted: false, solo: false,
    };
    setLanes(prev => [...prev, lane]);
    setSelectedLaneId(lane.id);
    void computePeaks(lane.id, url);
    showToast(`Lane added: ${lane.name}. Press play to hear it with the mix.`);
  };

  const removeLane = (id: string) => {
    const nodes = nodesRef.current.get(id);
    if (nodes) {
      try { nodes.el.pause(); nodes.src.disconnect(); nodes.gain.disconnect(); nodes.pan.disconnect(); } catch { /* noop */ }
      nodesRef.current.delete(id);
    }
    setLanes(prev => prev.filter(l => l.id !== id));
    if (selectedLaneId === id) setSelectedLaneId('master');
  };

  const updateLane = (id: string, patch: Partial<Lane>) => {
    setLanes(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    // Apply live: mix values are read from lanesRef, refreshed on next tick.
    window.setTimeout(applyMix, 0);
  };

  /** Real waveform peaks when the file can be decoded; seeded bars otherwise. */
  const computePeaks = async (laneId: string, url: string) => {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const off = new OfflineAudioContext(1, 1, 44100);
      const decoded = await off.decodeAudioData(buf);
      const data = decoded.getChannelData(0);
      const buckets = 96;
      const step = Math.floor(data.length / buckets) || 1;
      const out: number[] = [];
      for (let i = 0; i < buckets; i++) {
        let max = 0;
        for (let j = i * step; j < Math.min((i + 1) * step, data.length); j += 4) {
          const v = Math.abs(data[j]);
          if (v > max) max = v;
        }
        out.push(Math.max(0.08, max));
      }
      setPeaks(prev => ({ ...prev, [laneId]: out }));
    } catch {
      setPeaks(prev => ({ ...prev, [laneId]: seededPeaks(laneId, 96) }));
    }
  };

  // --- Generation (real MusicGen path, same engine as Song Creator) ---
  const failGeneration = (msg: string) => {
    setIsGenerating(false);
    setGenStatus('');
    showToast(msg);
  };

  const cancelGeneration = async () => {
    cancelRequestedRef.current = true;
    const id = activePredictionIdRef.current;
    if (id) {
      try {
        await fetch(ENGINE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', id }) });
      } catch { /* best-effort */ }
    }
    setIsGenerating(false);
    setGenStatus('');
    showToast('Generation cancelled.');
  };

  const runGeneration = async (opts: { title: string; genre: string; theme: string; lyrics: string; duration: number }) => {
    const { title, genre, theme, lyrics, duration } = opts;
    cancelRequestedRef.current = false;
    activePredictionIdRef.current = null;
    setIsGenerating(true);
    setGenStatus('Sending to AI engine…');
    try {
      const lyricExcerpt = lyrics.split('\n').filter(l => l.trim() && !l.trim().startsWith('[')).slice(0, 2).join(' ').slice(0, 200);
      const musicPrompt = `${genre} instrumental track: ${theme}. Titled "${title}".${lyricExcerpt ? ` Mood: ${lyricExcerpt}` : ''}`.slice(0, 900);
      let createRes: Response;
      try {
        createRes = await fetch(ENGINE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', prompt: musicPrompt, duration }) });
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
      if (cancelRequestedRef.current) { await cancelGeneration(); return; }
      const timeHint = duration <= 30 ? '~1–2 min' : duration <= 60 ? '~2–4 min' : '~4–8 min';
      const deadline = Date.now() + Math.max(5 * 60 * 1000, duration * 4 * 1000);
      let consecutivePollErrors = 0;
      let audioUrl: string | null = null;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000));
        if (cancelRequestedRef.current) { await cancelGeneration(); return; }
        let statusRes: Response;
        try {
          statusRes = await fetch(ENGINE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: created.id }) });
        } catch {
          consecutivePollErrors += 1;
          if (consecutivePollErrors >= 3) { failGeneration('Lost connection to the AI engine. Please try again.'); return; }
          setGenStatus('Reconnecting to AI engine…');
          continue;
        }
        const statusData = await statusRes.json().catch(() => null);
        if (!statusRes.ok) {
          consecutivePollErrors += 1;
          if (consecutivePollErrors >= 3) { failGeneration(statusData?.error || `AI engine error (${statusRes.status}).`); return; }
          setGenStatus('Reconnecting to AI engine…');
          continue;
        }
        consecutivePollErrors = 0;
        const st = statusData?.status;
        if (st === 'succeeded') {
          const out = statusData?.output;
          audioUrl = Array.isArray(out) ? out[0] : out;
          if (!audioUrl) { failGeneration('The AI engine finished but returned no audio. Please try again.'); return; }
          break;
        }
        if (st === 'failed' || st === 'canceled') {
          failGeneration(statusData?.error || 'The AI engine could not finish this track. Try a different description.');
          return;
        }
        setGenStatus(`Composing your track… (this takes ${timeHint})`);
      }
      if (!audioUrl) { failGeneration('Generation timed out. Please try again.'); return; }
      const track = autoSaveSongToLibrary({
        title, genre, lyrics, theme, engine: 'MusicGen',
        coverId: Math.floor(Math.random() * 1000), audioUrl, bpm,
      });
      setLibrary(prev => [track, ...prev.filter(x => x.id !== track.id)]);
      setIsGenerating(false);
      setGenStatus('');
      loadSong(track);
      showToast(`💾 Auto-saved: "${title}" — loaded into the Studio.`);
    } catch (e) {
      console.error('Studio generation error:', e);
      failGeneration('Something went wrong while generating. Please try again.');
    }
  };

  const handleGenerate = () => {
    if (!genStyle.trim()) { showToast('Enter a style first.'); return; }
    void runGeneration({ title: genTitle.trim() || 'Untitled Studio Track', genre: genStyle.trim(), theme: genTitle.trim() || 'Studio session', lyrics: genLyrics, duration: genLength });
  };

  const handleExtend = () => {
    if (!loadedSong) { showToast('Load a song first to extend it.'); return; }
    void runGeneration({
      title: `${loadedSong.title} (Extended)`,
      genre: loadedSong.genre,
      theme: `Continuation of ${loadedSong.title}`,
      lyrics: loadedSong.lyrics,
      duration: genLength,
    });
  };

  /** Replace-section: edits one section's lyrics, then regenerates a NEW full
   *  track with the revised lyrics as mood input (MusicGen is instrumental-only,
   *  so this is a new generation, not in-place audio surgery). */
  const handleReplaceSectionAudio = (section: Section) => {
    if (!loadedSong) return;
    const updatedLyrics = loadedSong.lyrics.replace(section.text, editingSectionText.trim() || section.text);
    void runGeneration({
      title: `${loadedSong.title} (Section Rework)`,
      genre: loadedSong.genre,
      theme: `Reworked ${section.label} of ${loadedSong.title}`,
      lyrics: updatedLyrics,
      duration: genLength,
    });
    setEditingSectionId(null);
  };

  const handleAILyrics = async () => {
    try {
      const text = await suggestLyricsChujai(genTitle || 'a new song', genStyle || 'Pop', 'High');
      setGenLyrics(text);
    } catch {
      showToast('Lyrics engine warming up — try again.');
    }
  };

  const handleCopilot = async () => {
    const lane = lanes.find(l => l.id === selectedLaneId);
    if (!lane) return;
    setIsAskingCopilot(true);
    try {
      const tip = await generateMusicAdvice(`Mixing advice for a ${lane.kind === 'master' ? 'master mix' : 'layered'} lane titled "${lane.name}" in a ${genStyle || loadedSong?.genre || 'contemporary'} session at ${bpm} BPM. Give 2 specific tips on level, pan, and space.`);
      setCopilotAdvice(tip);
    } catch {
      setCopilotAdvice('Signal interruption — try again.');
    } finally {
      setIsAskingCopilot(false);
    }
  };

  // --- Export: real audio download + real mix bounce ---
  const downloadMaster = async () => {
    const master = lanes[0];
    if (!master) { showToast('No audio loaded to download.'); return; }
    try {
      const res = await fetch(master.audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${(loadedSong?.title || master.name).replace(/[^\w-]+/g, '_')}.mp3`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      window.open(master.audioUrl, '_blank');
    }
  };

  const encodeWav = (left: Float32Array, right: Float32Array, sampleRate: number): Blob => {
    const len = left.length;
    const buffer = new ArrayBuffer(44 + len * 4);
    const view = new DataView(buffer);
    const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + len * 4, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
    writeStr(36, 'data'); view.setUint32(40, len * 4, true);
    let off = 44;
    for (let i = 0; i < len; i++) {
      const l = Math.max(-1, Math.min(1, left[i]));
      const r = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(off, l * 32767, true); off += 2;
      view.setInt16(off, r * 32767, true); off += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  };

  /** Bounce the live lane mix (levels, pan, mute/solo) to a single WAV file. */
  const bounceMix = async () => {
    if (lanes.length === 0) { showToast('No lanes to bounce.'); return; }
    setIsBouncing(true);
    try {
      const decodeCtx = new OfflineAudioContext(1, 1, 44100);
      const decoded: { buffer: AudioBuffer; lane: Lane }[] = [];
      for (const lane of lanesRef.current) {
        const res = await fetch(lane.audioUrl);
        const arr = await res.arrayBuffer();
        const buffer = await decodeCtx.decodeAudioData(arr);
        decoded.push({ buffer, lane });
      }
      const sampleRate = decoded[0].buffer.sampleRate;
      const maxDur = Math.max(...decoded.map(d => d.buffer.duration));
      const off = new OfflineAudioContext(2, Math.ceil(maxDur * sampleRate), sampleRate);
      const anySolo = lanesRef.current.some(l => l.solo);
      decoded.forEach(({ buffer, lane }) => {
        const src = off.createBufferSource();
        src.buffer = buffer;
        const gain = off.createGain();
        const pan = off.createStereoPanner();
        const effective = lane.muted ? 0 : (anySolo && !lane.solo ? 0 : lane.volume / 100);
        gain.gain.value = effective * (masterVolume / 100);
        pan.pan.value = lane.pan / 100;
        src.connect(gain); gain.connect(pan); pan.connect(off.destination);
        src.start(0);
      });
      const rendered = await off.startRendering();
      const blob = encodeWav(rendered.getChannelData(0), rendered.getChannelData(1), sampleRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${(loadedSong?.title || 'swcafe-mix').replace(/[^\w-]+/g, '_')}_mix.wav`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Mix bounced to WAV.');
    } catch {
      showToast('Bounce needs decodable audio — downloading the master file instead.');
      await downloadMaster();
    } finally {
      setIsBouncing(false);
    }
  };

  const selectedLane = lanes.find(l => l.id === selectedLaneId) || null;
  const playheadPct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const loopBand = duration > 0 && loopEnd > loopStart
    ? { left: (loopStart / duration) * 100, width: ((loopEnd - loopStart) / duration) * 100 }
    : null;

  const seekFromRuler = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    seekAll(frac * duration);
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] text-[#e0e0e0] font-sans select-none overflow-hidden text-left relative">
      {toast && (
        <div className="fixed top-5 right-6 z-50 bg-[#131316] border border-orange-500/50 text-orange-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-3 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"></span>
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-zinc-400 hover:text-white text-sm">✕</button>
        </div>
      )}

      {/* CONTROL BAR — Logic-style transport */}
      <div className="h-14 bg-[#131316] border-b border-white/5 flex items-center justify-between px-4 z-40 shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-extrabold tracking-[0.22em] text-white uppercase font-mono flex items-center gap-1.5 shrink-0">
            <span className="text-orange-400 text-base">☕</span> swcafe studio
          </h1>
          <span className="text-[10px] text-zinc-400 truncate max-w-[220px] hidden md:block">
            {loadedSong ? loadedSong.title : 'No song loaded'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={stopAll} title="Stop / back to start" className="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-300 flex items-center justify-center transition-colors">
            <RotateCcw size={14} />
          </button>
          <button
            onClick={togglePlay}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${isPlaying ? 'bg-red-500 text-white' : 'bg-gradient-to-r from-orange-500 to-red-600 text-black hover:scale-105'}`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={16} className="fill-current text-white" /> : <Play size={16} className="fill-current text-black ml-0.5" />}
          </button>
          <button
            onClick={() => {
              if (!duration) return;
              if (!loopOn) { setLoopStart(0); setLoopEnd(duration); }
              setLoopOn(!loopOn);
            }}
            title="Loop"
            className={`px-2 py-1 rounded text-[9px] font-black uppercase border transition-colors ${loopOn ? 'bg-orange-500/10 text-orange-400 border-orange-500/25' : 'bg-[#1a1a1e] border-white/5 text-zinc-500 hover:text-zinc-300'}`}
          >
            <span className="flex items-center gap-1"><Repeat size={10} /> Loop</span>
          </button>
          <div className="hidden sm:flex bg-[#1a1a1e] rounded border border-white/5 py-1 px-2.5 items-center gap-2">
            <span className="text-[11px] font-mono text-cyan-400 font-extrabold tabular-nums">{fmtTime(currentTime)}</span>
            <span className="text-zinc-600 text-[10px]">/</span>
            <span className="text-[11px] font-mono text-zinc-400 tabular-nums">{fmtTime(duration)}</span>
            <div className="h-3 w-px bg-white/10"></div>
            <span className="text-[11px] font-mono text-orange-400 font-extrabold tabular-nums">{barBeat(currentTime, bpm, beatsPerBar)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="hidden lg:flex items-center gap-1 text-[9px] font-bold text-zinc-500 uppercase">
            BPM
            <input type="number" value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))} className="bg-[#1a1a1e] border border-white/5 rounded px-1.5 py-1 text-[11px] font-mono text-zinc-200 w-14 text-center outline-none" />
          </label>
          <select value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)} className="hidden lg:block bg-[#1a1a1e] border border-white/5 rounded px-1.5 py-1 text-[11px] font-mono text-zinc-300 outline-none cursor-pointer">
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="6/8">6/8</option>
          </select>
          <select value={String(speed)} onChange={(e) => { const s = parseFloat(e.target.value); setSpeed(s); nodesRef.current.forEach(n => { n.el.playbackRate = s; }); }} className="bg-[#1a1a1e] border border-white/5 rounded px-1.5 py-1 text-[11px] font-mono text-zinc-300 outline-none cursor-pointer" title="Playback speed (real)">
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
          </select>
          <div className="hidden md:flex items-center gap-1.5">
            <Volume2 size={12} className="text-zinc-500 shrink-0" />
            <input type="range" min="0" max="100" value={masterVolume} onChange={(e) => setMasterVolume(parseInt(e.target.value))} className="w-16 accent-[#ff5e00] h-1 cursor-pointer" />
            <span className="text-[9px] font-mono font-black text-zinc-400 w-7 text-right">{masterVolume}%</span>
          </div>
          <button onClick={downloadMaster} title="Download the master audio file" className="h-8 px-2.5 rounded-lg bg-[#1a1a1e] hover:bg-white/10 border border-white/5 flex items-center gap-1.5 text-[10px] font-bold text-zinc-300 transition-colors">
            <Download size={11} /> <span className="hidden sm:inline">Master</span>
          </button>
          <button onClick={() => void bounceMix()} disabled={isBouncing} title="Bounce all lanes to one WAV mix file" className="h-8 px-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:brightness-110 text-white font-bold text-[10px] uppercase flex items-center gap-1.5 transition-all disabled:opacity-50">
            {isBouncing ? 'Bouncing…' : 'Bounce Mix'}
          </button>
        </div>
      </div>

      {/* THREE-PANE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">

        {/* LEFT: SOURCE + GENERATE */}
        <div className="w-[290px] border-r border-white/5 bg-[#131316] flex flex-col shrink-0 min-h-0 z-30">
          <div className="flex-1 overflow-y-auto p-3.5 space-y-5 custom-scrollbar">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Session — Load a Song</span>
              {library.length === 0 && <p className="text-[11px] text-zinc-500">Your library is empty. Generate a track below.</p>}
              <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                {library.map(song => {
                  const isLoaded = loadedSong?.id === song.id;
                  return (
                    <button
                      key={song.id}
                      onClick={() => loadSong(song)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${isLoaded ? 'bg-orange-500/10 border-orange-500/30 text-white' : 'bg-[#1a1a1e] border-white/5 text-zinc-300 hover:bg-white/5'}`}
                    >
                      <span className="block text-[11px] font-bold truncate">{song.title}</span>
                      <span className="block text-[9px] text-zinc-500 truncate">{song.genre}{song.audioUrl ? ' · ▶ audio' : ' · lyrics only'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-zinc-600 leading-snug">Songs without audio load their lyrics + style into the generate form instead — generate them to hear them here.</p>
            </div>

            <div className="space-y-2 border-t border-white/5 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Generate</span>
              <input type="text" value={genTitle} onChange={(e) => setGenTitle(e.target.value)} placeholder="Song title (optional)" className="w-full bg-[#1a1a1e] border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-orange-500/40" />
              <input type="text" value={genStyle} onChange={(e) => setGenStyle(e.target.value)} placeholder="Style of music" className="w-full bg-[#1a1a1e] border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-orange-500/40" />
              <div className="relative border border-white/5 bg-[#1a1a1e] rounded-xl overflow-hidden focus-within:border-orange-500/30">
                <textarea value={genLyrics} onChange={(e) => setGenLyrics(e.target.value)} className="w-full h-28 bg-transparent p-3 text-xs text-zinc-300 leading-normal focus:outline-none resize-none custom-scrollbar" style={{ caretColor: '#ff5e00' }} />
                <div className="absolute bottom-2 left-2.5 right-2.5 flex justify-between items-center">
                  <button onClick={() => void handleAILyrics()} className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-orange-400 transition-colors" title="Generate lyrics with AI">
                    <Sparkles size={11} />
                  </button>
                  <span className="text-[9px] text-zinc-600 font-mono">{genLyrics.length} chr</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {['[Intro]', '[Verse]', '[Chorus]', '[Bridge]', '[Outro]'].map(tag => (
                  <button key={tag} onClick={() => setGenLyrics(prev => (prev.trim() ? `${prev.trimEnd()}\n${tag}\n` : `${tag}\n`))} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1a1a1e] text-zinc-400 border border-white/5 hover:text-white transition-all">{tag}</button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-zinc-500 uppercase mr-1">Length</span>
                {[15, 30, 60, 120].map(len => (
                  <button key={len} onClick={() => setGenLength(len)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${genLength === len ? 'bg-orange-500/10 text-orange-400 border-orange-500/25' : 'bg-[#1a1a1e] text-zinc-400 border-white/5 hover:text-white'}`}>{len}s</button>
                ))}
              </div>
              {isGenerating ? (
                <div className="space-y-2">
                  <div className="w-full py-2.5 rounded-lg bg-white/10 text-zinc-200 text-[10px] font-black uppercase tracking-wider text-center">{genStatus || 'Composing…'}</div>
                  <button onClick={() => void cancelGeneration()} className="w-full py-2 rounded-lg bg-[#1a1a1e] hover:bg-white/10 border border-white/5 text-[10px] font-black uppercase tracking-wider text-zinc-300 transition-colors">Cancel</button>
                </div>
              ) : (
                <button onClick={handleGenerate} className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-600 hover:brightness-110 text-white font-black rounded-lg text-xs uppercase tracking-widest shadow-lg shadow-black/40 active:scale-[0.98] transition-all">
                  Create ♪
                </button>
              )}
              <button onClick={handleExtend} disabled={!loadedSong || isGenerating} className="w-full py-2.5 rounded-lg bg-[#1a1a1e] hover:bg-white/10 border border-white/5 text-[10px] font-black uppercase tracking-wider text-zinc-200 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                <Plus size={11} /> Extend current song
              </button>
              <p className="text-[9px] text-zinc-600 leading-snug">Extend generates a new continuation track — it does not append audio to the current file. MusicGen is instrumental-only: lyrics shape the mood, they are not sung.</p>
            </div>

            <div className="space-y-2 border-t border-white/5 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">About these lanes</span>
              <p className="text-[10px] text-zinc-500 leading-relaxed">Stem separation is not connected to a real engine yet, so there are no stem lanes today — upload audio files to layer real lanes, or generate a track. Uploaded lanes live in this session only; they are not saved to the library.</p>
              <button onClick={onOpenVoice} className="w-full py-2 rounded-lg bg-[#1a1a1e] hover:bg-white/10 border border-white/5 text-[10px] font-black uppercase tracking-wider text-[#ec4899] transition-colors">+ Voice</button>
            </div>
          </div>
        </div>

        {/* CENTER: TIMELINE */}
        <div className="flex-1 bg-[#131316] flex flex-col min-w-0 overflow-hidden relative">
          <div className="h-10 bg-[#131316] border-b border-white/5 flex items-center justify-between px-3.5 shrink-0 z-20">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-mono">Timeline</span>
              {loadedSong && <span className="text-[10px] font-bold text-zinc-300 truncate max-w-[300px]">{loadedSong.title} · {loadedSong.genre}</span>}
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addUploadLane(f); }} />
              <button onClick={() => fileInputRef.current?.click()} className="h-7 px-2.5 bg-[#1a1a1e] hover:bg-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300 rounded border border-white/5 flex items-center gap-1 transition-colors">
                <Upload size={11} /> Add lane
              </button>
              {onPlay && loadedSong?.audioUrl && (
                <button
                  onClick={() => { pauseAll(); onPlay(loadedSong.title, 'MusicGen', `https://picsum.photos/seed/${loadedSong.coverId}/200/200`, loadedSong.audioUrl); }}
                  className="h-7 px-2.5 bg-[#1a1a1e] hover:bg-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300 rounded border border-white/5 flex items-center gap-1 transition-colors"
                  title="Hand this track to the bottom player bar"
                >
                  <Send size={11} /> Bottom player
                </button>
              )}
            </div>
          </div>

          {/* Ruler — click to seek; loop band + playhead overlay */}
          <div className="h-9 bg-[#131316]/60 border-b border-white/5 flex relative shrink-0 select-none">
            <div className="w-[168px] h-full border-r border-white/5 bg-[#131316]/50 shrink-0 flex items-center px-3">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Lanes · click ruler to seek</span>
            </div>
            <div className="flex-1 h-full relative cursor-pointer" onClick={seekFromRuler}>
              {duration > 0 && Array.from({ length: Math.floor(duration / 15) + 1 }).map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-l border-white/10 flex flex-col justify-center pl-1" style={{ left: `${(i * 15 / duration) * 100}%` }}>
                  <span className="text-[8px] font-mono text-zinc-500 font-bold">{fmtTime(i * 15)}</span>
                </div>
              ))}
              {loopBand && (
                <div className="absolute top-0 bottom-0 bg-orange-500/15 border-x border-orange-500/40 pointer-events-none" style={{ left: `${loopBand.left}%`, width: `${loopBand.width}%` }}>
                  <span className="absolute top-0.5 left-1 text-[7px] font-black text-orange-400 uppercase tracking-widest">Loop</span>
                </div>
              )}
              <div className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 z-20 pointer-events-none shadow-[0_0_12px_rgba(239,68,68,0.7)]" style={{ left: `${playheadPct}%` }}>
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-[4.5px] -mt-0.5 border border-white/20 shadow-md"></div>
              </div>
            </div>
          </div>

          {/* Section strip — Suno-style structure overlaid on the timeline */}
          <div className="h-9 bg-[#131316]/40 border-b border-white/5 flex relative shrink-0 select-none">
            <div className="w-[168px] h-full border-r border-white/5 bg-[#131316]/50 shrink-0 flex items-center px-3">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Sections</span>
            </div>
            <div className="flex-1 h-full relative flex">
              {duration > 0 && sections.map(sec => (
                <button
                  key={sec.id}
                  onClick={() => seekAll(sec.start)}
                  title={`Seek to ${sec.label} (${fmtTime(sec.start)}) — timing approximate`}
                  className={`h-full border-r border-white/5 px-2 text-left truncate transition-colors ${activeSection?.id === sec.id ? 'bg-orange-500/20 text-orange-300' : 'text-zinc-400 hover:bg-white/5'}`}
                  style={{ width: `${Math.max(6, ((sec.end - sec.start) / duration) * 100)}%` }}
                >
                  <span className="text-[9px] font-black uppercase tracking-wide truncate block">{sec.label}</span>
                </button>
              ))}
              {duration === 0 && <span className="text-[9px] text-zinc-600 px-3 self-center">Load a song to see its sections here.</span>}
            </div>
          </div>

          {/* Lanes */}
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {lanes.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-8">
                <Music size={28} className="text-zinc-700" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Studio empty</p>
                <p className="text-[11px] text-zinc-600 max-w-sm leading-relaxed">Pick a song from the session list or generate one. Then add upload lanes to layer audio over it — every lane plays in sync through one mix bus.</p>
              </div>
            )}
            {lanes.map(lane => {
              const isSelected = selectedLaneId === lane.id;
              const lanePeaks = peaks[lane.id] || seededPeaks(lane.id, 96);
              return (
                <div key={lane.id} onClick={() => setSelectedLaneId(lane.id)} className={`h-20 border-b border-white/5 flex cursor-pointer transition-colors ${isSelected ? 'bg-white/[0.035]' : 'hover:bg-white/[0.015]'}`}>
                  <div className={`w-[168px] h-full border-r border-white/5 flex flex-col justify-center px-3 gap-1 shrink-0 select-none ${isSelected ? 'bg-[#1a1a1e]' : 'bg-[#131316]/30'}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black truncate uppercase" style={{ color: lane.color }}>{lane.name}</span>
                      {lane.kind === 'upload' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeLane(lane.id); }}
                          className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                          title="Remove lane"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateLane(lane.id, { solo: !lane.solo }); }}
                        className={`w-6 h-5 rounded text-[8px] font-black transition-colors ${lane.solo ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-zinc-700 text-zinc-400'}`}
                      >
                        S
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateLane(lane.id, { muted: !lane.muted }); }}
                        className={`w-6 h-5 rounded text-[8px] font-black transition-colors ${lane.muted ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-zinc-700 text-zinc-400'}`}
                      >
                        M
                      </button>
                      <input
                        type="range" min="0" max="100" value={lane.volume}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateLane(lane.id, { volume: parseInt(e.target.value) })}
                        className="flex-1 accent-[#ff5e00] h-1 cursor-pointer"
                      />
                      <span className="text-[8px] font-mono text-zinc-500 w-7 text-right">{lane.volume}%</span>
                    </div>
                  </div>
                  <div className="flex-1 relative bg-[#131316]/15 overflow-hidden h-full" onClick={seekFromRuler}>
                    <div className="absolute inset-0 flex items-center px-3 gap-[1.5px]">
                      {lanePeaks.map((p, i) => {
                        const played = duration > 0 && (i / lanePeaks.length) * 100 <= playheadPct;
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-sm"
                            style={{ height: `${Math.max(8, p * 52)}px`, backgroundColor: played ? lane.color : `${lane.color}55`, opacity: lane.muted ? 0.25 : 1 }}
                          />
                        );
                      })}
                    </div>
                    <div className="absolute top-0 bottom-0 w-[1.5px] bg-red-500/80 pointer-events-none" style={{ left: `${playheadPct}%` }}></div>
                  </div>
                </div>
              );
            })}
            <p className="text-[9px] text-zinc-600 px-4 py-3 leading-relaxed">
              Waveforms show real decoded peaks when the file can be read; otherwise a placeholder pattern is drawn. Section timings are proportional to the lyrics and approximate — the audio itself is the truth.
            </p>
          </div>
        </div>

        {/* RIGHT: INSPECTOR */}
        <div className="w-[280px] border-l border-white/5 bg-[#131316] flex flex-col shrink-0 min-h-0 z-30">
          <div className="flex bg-[#1a1a1e] p-1 m-3 mb-0 rounded-lg border border-white/5 shrink-0">
            {(['channel', 'lyrics'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setInspectorTab(tab)}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${inspectorTab === tab ? 'bg-white/10 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {tab === 'channel' ? 'Channel' : 'Lyrics'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
            {inspectorTab === 'channel' && (
              <>
                {selectedLane ? (
                  <div className="space-y-3 bg-[#1a1a1e]/70 border border-white/5 rounded-2xl p-3.5">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Channel Strip — {selectedLane.name}</span>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase"><span>Volume</span><span className="text-zinc-300 font-mono">{selectedLane.volume}%</span></div>
                      <input type="range" min="0" max="100" value={selectedLane.volume} onChange={(e) => updateLane(selectedLane.id, { volume: parseInt(e.target.value) })} className="w-full accent-[#ff5e00] cursor-pointer h-1" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase"><span>Pan</span><span className="text-zinc-300 font-mono">{selectedLane.pan > 0 ? `R${selectedLane.pan}` : selectedLane.pan < 0 ? `L${Math.abs(selectedLane.pan)}` : 'C'}</span></div>
                      <input type="range" min="-100" max="100" value={selectedLane.pan} onChange={(e) => updateLane(selectedLane.id, { pan: parseInt(e.target.value) })} className="w-full accent-cyan-400 cursor-pointer h-1" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => updateLane(selectedLane.id, { solo: !selectedLane.solo })} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${selectedLane.solo ? 'bg-yellow-500 text-black' : 'bg-white/10 text-zinc-300 hover:bg-white/15'}`}>Solo</button>
                      <button onClick={() => updateLane(selectedLane.id, { muted: !selectedLane.muted })} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${selectedLane.muted ? 'bg-red-500 text-white' : 'bg-white/10 text-zinc-300 hover:bg-white/15'}`}>Mute</button>
                    </div>
                    <div className="space-y-1 pt-1">
                      <span className="text-[9px] font-extrabold text-zinc-500 uppercase block">Playback speed (all lanes)</span>
                      <div className="flex gap-1">
                        {[0.5, 1, 2].map(s => (
                          <button key={s} onClick={() => { setSpeed(s); nodesRef.current.forEach(n => { n.el.playbackRate = s; }); }} className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all ${speed === s ? 'bg-white/10 text-cyan-400' : 'bg-[#131316] text-zinc-500 hover:text-zinc-300'}`}>{s}×</button>
                        ))}
                      </div>
                    </div>
                    {selectedLane.kind === 'upload' && (
                      <button onClick={() => removeLane(selectedLane.id)} className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/5 text-[10px] font-black uppercase text-zinc-400 hover:text-red-400 transition-colors">Remove lane</button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500">Select a lane to edit its channel strip.</p>
                )}

                <div className="space-y-2 bg-[#1a1a1e]/70 border border-white/5 rounded-2xl p-3.5">
                  <span className="text-[10px] font-black text-[#ff711d] uppercase tracking-wider block">🎹 Copilot Signal Assist</span>
                  <button onClick={() => void handleCopilot()} disabled={isAskingCopilot || !selectedLane} className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-100 border border-white/5 text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-40">
                    {isAskingCopilot ? 'Scanning…' : 'Run Neural Mix Scan'}
                  </button>
                  {copilotAdvice && <p className="text-[10px] text-zinc-300 leading-relaxed italic whitespace-pre-wrap">{copilotAdvice}</p>}
                </div>

                <div className="space-y-2 bg-[#1a1a1e]/70 border border-white/5 rounded-2xl p-3.5">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Session notes</span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">BPM and time signature set the bar grid only — they do not retime audio. Speed (0.5×/1×/2×) changes real playback rate. Transpose is not offered: it would need pitch processing the app does not have.</p>
                </div>
              </>
            )}

            {inspectorTab === 'lyrics' && (
              <>
                {!loadedSong && <p className="text-[11px] text-zinc-500">Load a song to see its lyrics synced to sections.</p>}
                {loadedSong && sections.map(sec => {
                  const isActive = activeSection?.id === sec.id;
                  const isEditing = editingSectionId === sec.id;
                  return (
                    <div key={sec.id} className={`rounded-2xl border p-3 space-y-2 transition-all ${isActive ? 'bg-orange-500/10 border-orange-500/30' : 'bg-[#1a1a1e]/70 border-white/5'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => seekAll(sec.start)} className="text-left flex-1 min-w-0">
                          <span className={`block text-[10px] font-black uppercase tracking-wider truncate ${isActive ? 'text-orange-300' : 'text-zinc-300'}`}>{sec.label}</span>
                          <span className="block text-[9px] font-mono text-zinc-500">{fmtTime(sec.start)} – {fmtTime(sec.end)} · approx.</span>
                        </button>
                        <button
                          onClick={() => { setLoopStart(sec.start); setLoopEnd(sec.end); setLoopOn(true); }}
                          className="shrink-0 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 text-[8px] font-black uppercase text-zinc-400 hover:text-white transition-colors"
                          title="Loop this section"
                        >
                          Loop
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-4">{sec.text}</p>
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea value={editingSectionText} onChange={(e) => setEditingSectionText(e.target.value)} className="w-full h-24 bg-[#131316] border border-white/10 rounded-xl p-2.5 text-[11px] text-zinc-200 focus:outline-none focus:border-orange-500/40 resize-none" />
                          <div className="flex gap-2">
                            <button onClick={() => handleReplaceSectionAudio(sec)} disabled={isGenerating} className="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-1">
                              <Scissors size={10} /> Regenerate section audio
                            </button>
                            <button onClick={() => setEditingSectionId(null)} className="px-3 py-2 rounded-lg bg-white/5 text-[9px] font-black uppercase text-zinc-400">Cancel</button>
                          </div>
                          <p className="text-[9px] text-zinc-600 leading-snug">Regenerating creates a NEW full track with the revised lyrics as mood input — it does not surgically replace audio inside the current file.</p>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingSectionId(sec.id); setEditingSectionText(sec.text); }} className="text-[9px] font-black uppercase text-zinc-500 hover:text-orange-400 transition-colors">Edit section lyrics</button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.16); }
        input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.05); height: 4px; border-radius: 9999px; }
        input[type=range]:focus { outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 9999px; background: #ff5e00; cursor: ew-resize; box-shadow: 0 0 8px rgba(255, 94, 0, 0.5); }
        .line-clamp-4 { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default StudioView;
