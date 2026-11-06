import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Plus, Upload, Sparkles, Volume2, Download, Music, Trash2, Repeat, Scissors, Send, SlidersHorizontal, Keyboard, X, FileDown, EyeOff } from 'lucide-react';
import { suggestLyricsChujai, generateMusicAdvice } from '../geminiService';
import { autoSaveSongToLibrary, getSavedSongsWithRecalled, SavedSong } from '../songs';
import PianoRoll from './PianoRoll';
import { MidiNote, parseMidiFile, exportMidiFile, playSynthNote, midiName } from './midi';
import { registerUploadedSound } from './unifiedBrowser';
import {
  PluginInstance, PluginType, PLUGIN_DEFS, PLUGIN_ORDER,
  createPluginInstance, createEffectChain, fxKey, matchPluginsFromPrompt,
} from './studioEffects';

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

type FadeCurve = 'linear' | 'exp' | 'log';

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
  /** Fine pitch in decimal semitones — 2.38 means 2 semitones + 38 cents. */
  pitch: number;
  /** Timestretch factor (0.5..2). Rate-based: it changes tempo AND pitch. */
  stretch: number;
  /** Per-clip loop: restart this clip when it ends. */
  loop: boolean;
  /** Reversed playback (re-encoded as a WAV blob for this session). */
  reverse: boolean;
  /** Original URL while reversed, so the clip can be un-reversed. */
  originalUrl?: string;
  /** Fade lengths in seconds, relative to the clip. */
  fadeIn: number;
  fadeOut: number;
  fadeCurve: FadeCurve;
  /** Hidden lanes keep playing in the mix; only their display is hidden. */
  hidden: boolean;
  /** Per-lane effect plugins (insert chain after pan, before the master bus). */
  effects: PluginInstance[];
}

/** A MIDI lane: notes played through a simple synth preview voice. */
interface MidiLane {
  id: string;
  name: string;
  color: string;
  notes: MidiNote[];
  volume: number; // 0..100
  pan: number; // -100..100
  muted: boolean;
  solo: boolean;
  hidden: boolean;
  /** Per-lane effect plugins (same insert chain as audio lanes). */
  effects: PluginInstance[];
}

const defaultClipProps = (): Pick<Lane, 'pitch' | 'stretch' | 'loop' | 'reverse' | 'fadeIn' | 'fadeOut' | 'fadeCurve' | 'hidden' | 'effects'> => ({
  pitch: 0, stretch: 1, loop: false, reverse: false, fadeIn: 0, fadeOut: 0, fadeCurve: 'linear', hidden: false, effects: [],
});

interface Section {
  id: string;
  label: string;
  start: number;
  end: number;
  text: string;
}

/** Live effect chain for a lane (built from its plugins, rebuilt on change). */
interface FxChain {
  input: AudioNode;
  output: AudioNode;
  nodes: AudioNode[];
  key: string;
  stop: () => void;
}

interface LaneNodes {
  el: HTMLAudioElement;
  src: MediaElementAudioSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
  fx?: FxChain;
}

const ENGINE_URL = '/.netlify/functions/generate-music';
const LANE_COLORS = ['#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1', '#84cc16'];

/** Typing-keyboard layout for musical typing: key → semitone offset from C. */
const TYPING_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16,
};
const TYPING_KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p'];

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

/** Format decimal semitones as "semitones.cents", e.g. 2.38. */
const formatPitch = (p: number): string => {
  const sign = p < 0 ? '-' : '';
  const abs = Math.abs(p);
  const semis = Math.floor(abs + 1e-6);
  const cents = Math.round((abs - semis) * 100);
  return `${sign}${semis}.${cents.toString().padStart(2, '0')}`;
};

/** Parse "2.38" as 2 semitones + 38 cents (digits after the dot are cents). */
const parsePitchText = (text: string): number | null => {
  const m = text.trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const cents = m[3] ? parseInt(m[3], 10) : 0;
  if (cents > 99) return null;
  const total = parseInt(m[2], 10) + cents / 100;
  return (m[1] === '-' ? -1 : 1) * total;
};

/** Playback-rate multiplier for a pitch in decimal semitones. */
const pitchRate = (pitch: number): number => Math.pow(2, pitch / 12);

/** Curve shape for a 0..1 fade progress: linear, exponential, logarithmic. */
const applyCurve = (x: number, curve: FadeCurve): number => {
  const c = Math.min(1, Math.max(0, x));
  if (curve === 'exp') return c * c;
  if (curve === 'log') return 1 - (1 - c) * (1 - c);
  return c;
};

/** SVG path for a fade curve drawn in a 100x40 box. */
const fadePath = (shape: FadeCurve, dir: 'in' | 'out'): string => {
  const pts: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * 100;
    const gain = dir === 'in' ? applyCurve(i / 12, shape) : applyCurve(1 - i / 12, shape);
    const y = 40 * (1 - gain);
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
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

  // --- Clip Settings panel / rename / reverse ---
  const [clipPanelOpen, setClipPanelOpen] = useState(false);
  const [renamingLaneId, setRenamingLaneId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [reversingLaneId, setReversingLaneId] = useState<string | null>(null);
  const [pitchText, setPitchText] = useState('0.00');
  const [laneDurations, setLaneDurations] = useState<Record<string, number>>({});

  // --- Effects rack / plugin builder ---
  const [pluginPrompt, setPluginPrompt] = useState('');
  const [pluginPromptNote, setPluginPromptNote] = useState<string | null>(null);

  // --- MIDI lanes / piano roll ---
  const [midiLanes, setMidiLanes] = useState<MidiLane[]>([]);
  const [selectedMidiLaneId, setSelectedMidiLaneId] = useState<string | null>(null);
  const [editingMidiLaneId, setEditingMidiLaneId] = useState<string | null>(null);
  const [midiStatus, setMidiStatus] = useState<'off' | 'connecting' | 'on' | 'unsupported'>('off');
  const [midiInputs, setMidiInputs] = useState<string[]>([]);

  // --- Musical typing ---
  const [typingOn, setTypingOn] = useState(false);
  const [arpOn, setArpOn] = useState(false);
  const [chordOn, setChordOn] = useState(false);
  const [typingOctave, setTypingOctave] = useState(0);
  const [heldKeys, setHeldKeys] = useState<string[]>([]);

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
  const midiFileInputRef = useRef<HTMLInputElement | null>(null);
  const [peaks, setPeaks] = useState<Record<string, number[]>>({});

  // --- Refs for transport / MIDI scheduling / musical typing ---
  const isPlayingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const transportRef = useRef({ ctxTime: 0, offset: 0 });
  const triggeredNotesRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const midiVoicesRef = useRef<Map<string, () => void>>(new Map());
  const midiNodesRef = useRef<Map<string, { gain: GainNode; pan: StereoPannerNode; fx?: FxChain }>>(new Map());
  const midiLanesRef = useRef<MidiLane[]>([]);
  const typingVoicesRef = useRef<Map<string, Array<() => void>>>(new Map());
  const arpHeldRef = useRef<Map<string, number>>(new Map());
  const arpIndexRef = useRef(0);
  const arpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arpVoiceRef = useRef<(() => void) | null>(null);
  const webMidiVoicesRef = useRef<Map<number, () => void>>(new Map());
  const webMidiAccessRef = useRef<unknown>(null);

  useEffect(() => { lanesRef.current = lanes; }, [lanes]);
  useEffect(() => { midiLanesRef.current = midiLanes; }, [midiLanes]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { loopRef.current = { on: loopOn, start: loopStart, end: loopEnd }; }, [loopOn, loopStart, loopEnd]);

  // Rebuild a lane's effect chain whenever its plugin list changes.
  // The chain sits between the lane's pan node and the master bus, so
  // plugins hear the lane's level/pan and feed the master.
  useEffect(() => {
    const ctx = ctxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;
    const rebuild = (
      pan: StereoPannerNode,
      current: FxChain | undefined,
      effects: PluginInstance[],
      setFx: (fx: FxChain) => void
    ) => {
      const key = fxKey(effects);
      if (current?.key === key) return;
      if (current) {
        try { pan.disconnect(); } catch { /* noop */ }
        current.nodes.forEach(n => { try { n.disconnect(); } catch { /* noop */ } });
        current.stop();
      }
      const built = createEffectChain(ctx, effects);
      pan.connect(built.input);
      built.output.connect(master);
      setFx({ ...built, key });
    };
    lanesRef.current.forEach(lane => {
      const nodes = nodesRef.current.get(lane.id);
      if (nodes) rebuild(nodes.pan, nodes.fx, lane.effects, fx => { nodes.fx = fx; });
    });
    midiLanesRef.current.forEach(lane => {
      const nodes = midiNodesRef.current.get(lane.id);
      if (nodes) rebuild(nodes.pan, nodes.fx, lane.effects, fx => { nodes.fx = fx; });
    });
  }, [lanes, midiLanes]);
  // Keep the pitch text field in sync with the selected clip.
  const selectedLaneForPitch = lanes.find(l => l.id === selectedLaneId) || null;
  useEffect(() => {
    setPitchText(selectedLaneForPitch ? formatPitch(selectedLaneForPitch.pitch) : '0.00');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLaneId]);
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

  /** Playback-rate multiplier for a lane: global speed × stretch × pitch. */
  const effectiveRate = (lane: Lane, speedVal: number = speedRef.current): number =>
    Math.max(0.25, Math.min(4, speedVal * lane.stretch * pitchRate(lane.pitch)));

  const applyLaneRate = (lane: Lane) => {
    const nodes = nodesRef.current.get(lane.id);
    if (nodes) nodes.el.playbackRate = effectiveRate(lane);
  };

  /** Fade multiplier (0..1) for a lane at time t, using its fade curve. */
  const fadeFactor = (lane: Lane, t: number): number => {
    const dur = laneDurations[lane.id] || duration || 0;
    let f = 1;
    if (lane.fadeIn > 0 && t < lane.fadeIn) f = Math.min(f, applyCurve(t / lane.fadeIn, lane.fadeCurve));
    if (lane.fadeOut > 0 && dur > 0 && t > dur - lane.fadeOut) {
      f = Math.min(f, applyCurve((dur - t) / lane.fadeOut, lane.fadeCurve));
    }
    return Math.max(0, Math.min(1, f));
  };

  const stopMidiVoices = () => {
    midiVoicesRef.current.forEach(stop => { try { stop(); } catch { /* noop */ } });
    midiVoicesRef.current.clear();
    triggeredNotesRef.current.clear();
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const stopTypingVoices = () => {
    typingVoicesRef.current.forEach(stops => stops.forEach(s => { try { s(); } catch { /* noop */ } }));
    typingVoicesRef.current.clear();
    arpHeldRef.current.clear();
    setHeldKeys([]);
    if (arpTimerRef.current) { clearInterval(arpTimerRef.current); arpTimerRef.current = null; }
    if (arpVoiceRef.current) { try { arpVoiceRef.current(); } catch { /* noop */ } arpVoiceRef.current = null; }
  };

  const teardownGraph = () => {
    stopMidiVoices();
    stopTypingVoices();
    nodesRef.current.forEach(n => {
      try { n.el.pause(); } catch { /* noop */ }
      try { n.src.disconnect(); n.gain.disconnect(); n.pan.disconnect(); } catch { /* noop */ }
      if (n.fx) {
        n.fx.nodes.forEach(x => { try { x.disconnect(); } catch { /* noop */ } });
        n.fx.stop();
      }
    });
    nodesRef.current.clear();
    midiNodesRef.current.forEach(n => {
      try { n.gain.disconnect(); n.pan.disconnect(); } catch { /* noop */ }
      if (n.fx) {
        n.fx.nodes.forEach(x => { try { x.disconnect(); } catch { /* noop */ } });
        n.fx.stop();
      }
    });
    midiNodesRef.current.clear();
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
      masterGainRef.current = null;
    }
  };

  const applyMix = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const anySolo = lanesRef.current.some(l => l.solo) || midiLanesRef.current.some(l => l.solo);
    lanesRef.current.forEach(lane => {
      const nodes = nodesRef.current.get(lane.id);
      if (!nodes) return;
      const base = lane.muted ? 0 : (anySolo && !lane.solo ? 0 : lane.volume / 100);
      nodes.gain.gain.setTargetAtTime(base * fadeFactor(lane, currentTimeRef.current), ctx.currentTime, 0.03);
      nodes.pan.pan.setTargetAtTime(lane.pan / 100, ctx.currentTime, 0.03);
    });
    midiLanesRef.current.forEach(lane => {
      const nodes = midiNodesRef.current.get(lane.id);
      if (!nodes) return;
      const base = lane.muted ? 0 : (anySolo && !lane.solo ? 0 : lane.volume / 100);
      nodes.gain.gain.setTargetAtTime(base, ctx.currentTime, 0.03);
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
    el.playbackRate = effectiveRate(lane);
    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    // Insert chain: source -> gain -> pan -> [effects] -> master bus.
    const built = createEffectChain(ctx, lane.effects);
    src.connect(gain); gain.connect(pan);
    pan.connect(built.input); built.output.connect(masterGainRef.current);
    const nodes: LaneNodes = { el, src, gain, pan, fx: { ...built, key: fxKey(lane.effects) } };
    nodesRef.current.set(lane.id, nodes);
    el.addEventListener('ended', () => {
      // Per-clip loop: restart this clip while the transport is playing.
      if (lane.loop && isPlayingRef.current) {
        try { el.currentTime = 0; void el.play(); } catch { /* noop */ }
      }
    });
    if (isMaster) {
      el.addEventListener('timeupdate', () => {
        const t = el.currentTime;
        currentTimeRef.current = t;
        setCurrentTime(t);
        applyMix(); // keeps fade automation tracking the playhead
        const loop = loopRef.current;
        if (loop.on && t >= loop.end && loop.end > loop.start) {
          seekAll(loop.start);
        }
      });
      el.addEventListener('loadedmetadata', () => setDuration(el.duration || 0));
      el.addEventListener('ended', () => {
        // Master clip loop restarts the whole session; otherwise stop.
        if (lane.loop && isPlayingRef.current) {
          seekAll(0);
          nodesRef.current.forEach(n => { n.el.play().catch(() => undefined); });
        } else {
          setIsPlaying(false);
        }
      });
    }
    return nodes;
  };

  const seekAll = (t: number) => {
    stopMidiVoices();
    nodesRef.current.forEach(n => {
      try { n.el.currentTime = Math.min(t, n.el.duration || t); } catch { /* noop */ }
    });
    currentTimeRef.current = t;
    setCurrentTime(t);
    if (isPlayingRef.current) startMidiScheduler();
  };

  /** MIDI lane gain/pan nodes in the live graph (created lazily). */
  const ensureMidiNodes = (lane: MidiLane): { gain: GainNode; pan: StereoPannerNode; fx?: FxChain } | null => {
    const existing = midiNodesRef.current.get(lane.id);
    if (existing) return existing;
    const ctx = ensureGraph();
    if (!ctx || !masterGainRef.current) return null;
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    // Insert chain: synth voice -> gain -> pan -> [effects] -> master bus.
    const built = createEffectChain(ctx, lane.effects);
    gain.connect(pan);
    pan.connect(built.input); built.output.connect(masterGainRef.current);
    const nodes = { gain, pan, fx: { ...built, key: fxKey(lane.effects) } };
    midiNodesRef.current.set(lane.id, nodes);
    return nodes;
  };

  /** Schedule MIDI notes ahead of the playhead while the transport runs. */
  const midiTick = () => {
    const ctx = ctxRef.current;
    if (!ctx || !isPlayingRef.current) return;
    const tr = transportRef.current;
    const now = tr.offset + (ctx.currentTime - tr.ctxTime);
    const anySolo = lanesRef.current.some(l => l.solo) || midiLanesRef.current.some(l => l.solo);
    midiLanesRef.current.forEach(lane => {
      const audible = !lane.muted && (!anySolo || lane.solo);
      if (!audible) return;
      const nodes = ensureMidiNodes(lane);
      if (!nodes) return;
      lane.notes.forEach(note => {
        if (note.start <= now && note.end > now && !triggeredNotesRef.current.has(note.id)) {
          triggeredNotesRef.current.add(note.id);
          const stop = playSynthNote(ctx, nodes.gain, {
            midi: note.pitch, velocity: note.velocity,
            when: ctx.currentTime, duration: Math.max(0.05, note.end - now),
          });
          midiVoicesRef.current.set(note.id, stop);
        }
      });
    });
    rafRef.current = requestAnimationFrame(midiTick);
  };

  const startMidiScheduler = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    stopMidiVoices();
    transportRef.current = { ctxTime: ctx.currentTime, offset: currentTimeRef.current };
    rafRef.current = requestAnimationFrame(midiTick);
  };

  const playAll = () => {
    const ctx = ensureGraph();
    if (!ctx) { showToast('Audio is not available in this browser.'); return; }
    if (ctx.state === 'suspended') void ctx.resume();
    lanesRef.current.forEach((lane, i) => ensureLaneNode(lane, i === 0));
    midiLanesRef.current.forEach(lane => ensureMidiNodes(lane));
    applyMix();
    nodesRef.current.forEach((n, id) => {
      const lane = lanesRef.current.find(l => l.id === id);
      if (lane) n.el.playbackRate = effectiveRate(lane);
      n.el.play().catch(() => undefined);
    });
    isPlayingRef.current = true;
    setIsPlaying(true);
    startMidiScheduler();
  };

  const pauseAll = () => {
    stopMidiVoices();
    nodesRef.current.forEach(n => { try { n.el.pause(); } catch { /* noop */ } });
    isPlayingRef.current = false;
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
    const master: Lane = { id: 'master', name: 'Master Mix', color: '#f97316', kind: 'master', audioUrl: song.audioUrl, volume: 90, pan: 0, muted: false, solo: false, ...defaultClipProps() };
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
      ...defaultClipProps(),
    };
    setLanes(prev => [...prev, lane]);
    setSelectedLaneId(lane.id);
    void computePeaks(lane.id, url);
    // Auto-tag (10.2): register the upload in the Sound Browser — analyzed
    // on-device, fire-and-forget, never blocks the lane.
    void registerUploadedSound(file, url, false);
    showToast(`Lane added: ${lane.name}. Press play to hear it with the mix.`);
  };

  const removeLane = (id: string) => {
    const nodes = nodesRef.current.get(id);
    if (nodes) {
      try { nodes.el.pause(); nodes.src.disconnect(); nodes.gain.disconnect(); nodes.pan.disconnect(); } catch { /* noop */ }
      if (nodes.fx) {
        nodes.fx.nodes.forEach(x => { try { x.disconnect(); } catch { /* noop */ } });
        nodes.fx.stop();
      }
      nodesRef.current.delete(id);
    }
    setLanes(prev => prev.filter(l => l.id !== id));
    if (selectedLaneId === id) setSelectedLaneId('master');
  };

  const updateLane = (id: string, patch: Partial<Lane>) => {
    setLanes(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    // Apply live: mix values are read from lanesRef, refreshed on next tick.
    window.setTimeout(() => {
      applyMix();
      const lane = lanesRef.current.find(l => l.id === id);
      if (lane && (patch.pitch !== undefined || patch.stretch !== undefined)) applyLaneRate(lane);
    }, 0);
  };

  const updateMidiLane = (id: string, patch: Partial<MidiLane>) => {
    setMidiLanes(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    window.setTimeout(applyMix, 0);
  };

  const removeMidiLane = (id: string) => {
    const nodes = midiNodesRef.current.get(id);
    if (nodes) {
      try { nodes.gain.disconnect(); nodes.pan.disconnect(); } catch { /* noop */ }
      if (nodes.fx) {
        nodes.fx.nodes.forEach(x => { try { x.disconnect(); } catch { /* noop */ } });
        nodes.fx.stop();
      }
      midiNodesRef.current.delete(id);
    }
    setMidiLanes(prev => prev.filter(l => l.id !== id));
    if (selectedMidiLaneId === id) setSelectedMidiLaneId(null);
    if (editingMidiLaneId === id) setEditingMidiLaneId(null);
  };

  /** Reverse a clip by decoding it, reversing the samples, and re-encoding
   *  as a WAV blob for this session (the original URL is kept to un-reverse). */
  const toggleReverse = async (lane: Lane) => {
    if (reversingLaneId) return;
    setReversingLaneId(lane.id);
    try {
      if (!lane.reverse) {
        const res = await fetch(lane.audioUrl);
        const arr = await res.arrayBuffer();
        const off = new OfflineAudioContext(2, 1, 44100);
        const decoded = await off.decodeAudioData(arr);
        const len = decoded.length;
        const c0 = decoded.getChannelData(0);
        const c1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : c0;
        const left = new Float32Array(len);
        const right = new Float32Array(len);
        for (let i = 0; i < len; i++) { left[i] = c0[len - 1 - i]; right[i] = c1[len - 1 - i]; }
        const blob = encodeWav(left, right, decoded.sampleRate);
        const url = URL.createObjectURL(blob);
        const nodes = nodesRef.current.get(lane.id);
        if (nodes) { nodes.el.src = url; nodes.el.load(); }
        updateLane(lane.id, { reverse: true, originalUrl: lane.audioUrl, audioUrl: url });
        void computePeaks(lane.id, url);
        showToast('Clip reversed — re-encoded as WAV for this session.');
      } else {
        const orig = lane.originalUrl || lane.audioUrl;
        const nodes = nodesRef.current.get(lane.id);
        if (nodes) { nodes.el.src = orig; nodes.el.load(); }
        updateLane(lane.id, { reverse: false, audioUrl: orig, originalUrl: undefined });
        void computePeaks(lane.id, orig);
        showToast('Clip restored to forward playback.');
      }
    } catch {
      showToast('Could not reverse this clip — the audio could not be decoded here.');
    } finally {
      setReversingLaneId(null);
    }
  };

  const commitRename = () => {
    if (!renamingLaneId) return;
    const name = renameText.trim();
    if (name) updateLane(renamingLaneId, { name });
    setRenamingLaneId(null);
  };

  /** Real waveform peaks when the file can be decoded; seeded bars otherwise. */
  const computePeaks = async (laneId: string, url: string) => {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const off = new OfflineAudioContext(1, 1, 44100);
      const decoded = await off.decodeAudioData(buf);
      setLaneDurations(prev => ({ ...prev, [laneId]: decoded.duration }));
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

  // --- MIDI import / export / preview ---
  const importMidiFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const { notes, bpm: fileBpm } = parseMidiFile(buf);
      if (notes.length === 0) { showToast('No notes found in that MIDI file.'); return; }
      const color = LANE_COLORS[midiLanes.length % LANE_COLORS.length];
      const lane: MidiLane = {
        id: `midi-${Date.now()}`,
        name: file.name.replace(/\.(mid|midi)$/i, '') || 'MIDI',
        color, notes, volume: 85, pan: 0, muted: false, solo: false, hidden: false, effects: [],
      };
      setMidiLanes(prev => [...prev, lane]);
      setSelectedMidiLaneId(lane.id);
      setEditingMidiLaneId(lane.id);
      showToast(`MIDI imported: ${notes.length} notes from "${lane.name}" (file tempo ${fileBpm} BPM; notes are placed in seconds, session BPM unchanged).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not read that MIDI file.');
    }
  };

  const exportMidiLane = (lane: MidiLane) => {
    if (lane.notes.length === 0) { showToast('This MIDI lane has no notes to export.'); return; }
    const blob = exportMidiFile(lane.notes, bpm);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${lane.name.replace(/[^\w-]+/g, '_')}.mid`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(`Exported ${lane.name}.mid (${lane.notes.length} notes).`);
  };

  const previewMidiNote = (midi: number) => {
    const ctx = ensureGraph();
    if (!ctx || !masterGainRef.current) return;
    if (ctx.state === 'suspended') void ctx.resume();
    playSynthNote(ctx, masterGainRef.current, { midi, velocity: 90, duration: 0.6 });
  };

  // --- Musical typing ---
  const typingBaseNote = () => 60 + typingOctave * 12; // C4 at octave 0

  const playTypingNote = (key: string, midi: number) => {
    const ctx = ensureGraph();
    if (!ctx || !masterGainRef.current) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const stops: Array<() => void> = [];
    if (chordOn) {
      [0, 4, 7].forEach(iv => stops.push(playSynthNote(ctx, masterGainRef.current as AudioNode, { midi: midi + iv, velocity: 90 })));
    } else {
      stops.push(playSynthNote(ctx, masterGainRef.current, { midi, velocity: 90 }));
    }
    typingVoicesRef.current.set(key, stops);
  };

  const startArpTimer = () => {
    if (arpTimerRef.current) return;
    const stepMs = (60 / bpm / 2) * 1000; // 8th notes at the session BPM
    arpTimerRef.current = setInterval(() => {
      const held = [...arpHeldRef.current.values()].sort((a, b) => a - b);
      if (held.length === 0) return;
      const midi = held[arpIndexRef.current % held.length];
      arpIndexRef.current += 1;
      const ctx = ctxRef.current;
      if (!ctx || !masterGainRef.current) return;
      if (arpVoiceRef.current) { try { arpVoiceRef.current(); } catch { /* noop */ } }
      arpVoiceRef.current = playSynthNote(ctx, masterGainRef.current, { midi, velocity: 90, duration: (stepMs / 1000) * 0.9 });
    }, stepMs);
  };

  useEffect(() => {
    if (!typingOn) { stopTypingVoices(); return; }
    if (!arpOn && arpTimerRef.current) { clearInterval(arpTimerRef.current); arpTimerRef.current = null; }
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.repeat || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z') { setTypingOctave(o => Math.max(-2, o - 1)); return; }
      if (key === 'x') { setTypingOctave(o => Math.min(2, o + 1)); return; }
      const offset = TYPING_MAP[key];
      if (offset === undefined) return;
      e.preventDefault();
      const midi = typingBaseNote() + offset;
      if (arpOn) {
        arpHeldRef.current.set(key, midi);
        startArpTimer();
      } else {
        playTypingNote(key, midi);
      }
      setHeldKeys(prev => (prev.includes(key) ? prev : [...prev, key]));
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (arpOn) {
        arpHeldRef.current.delete(key);
      } else {
        const stops = typingVoicesRef.current.get(key);
        stops?.forEach(s => { try { s(); } catch { /* noop */ } });
        typingVoicesRef.current.delete(key);
      }
      setHeldKeys(prev => prev.filter(k => k !== key));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      if (arpTimerRef.current) { clearInterval(arpTimerRef.current); arpTimerRef.current = null; }
      if (arpVoiceRef.current) { try { arpVoiceRef.current(); } catch { /* noop */ } arpVoiceRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingOn, arpOn, chordOn, typingOctave, bpm]);

  // --- Web MIDI controller (live play only; no recording) ---
  const connectMidiController = async () => {
    const nav = navigator as unknown as { requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<unknown> };
    if (!nav.requestMIDIAccess) {
      setMidiStatus('unsupported');
      showToast('Web MIDI is not supported in this browser.');
      return;
    }
    setMidiStatus('connecting');
    try {
      const access = (await nav.requestMIDIAccess()) as {
        inputs: Map<string, { name?: string | null; onmidimessage: ((e: { data?: Uint8Array | null }) => void) | null }>;
      };
      webMidiAccessRef.current = access;
      const names: string[] = [];
      access.inputs.forEach(input => {
        names.push(input.name || 'MIDI controller');
        input.onmidimessage = (e) => {
          const data = e.data;
          if (!data || data.length < 3) return;
          const status = data[0] & 0xf0;
          const pitch = data[1];
          const vel = data[2];
          const ctx = ctxRef.current;
          if (!ctx || !masterGainRef.current) return;
          if (status === 0x90 && vel > 0) {
            const stop = playSynthNote(ctx, masterGainRef.current, { midi: pitch, velocity: vel });
            webMidiVoicesRef.current.set(pitch, stop);
          } else if (status === 0x80 || (status === 0x90 && vel === 0)) {
            const stop = webMidiVoicesRef.current.get(pitch);
            if (stop) { try { stop(); } catch { /* noop */ } webMidiVoicesRef.current.delete(pitch); }
          }
        };
      });
      if (names.length === 0) {
        setMidiStatus('off');
        showToast('No MIDI controller found — connect one and try again.');
        return;
      }
      ensureGraph();
      setMidiInputs(names);
      setMidiStatus('on');
      showToast(`MIDI controller connected: ${names.join(', ')} — live play only, recording is not supported yet.`);
    } catch {
      setMidiStatus('off');
      showToast('Could not access MIDI — check the browser permission and try again.');
    }
  };

  // --- Fade handle dragging (on the lane waveform) ---
  const startFadeDrag = (lane: Lane, which: 'in' | 'out') => (e: React.PointerEvent) => {
    e.stopPropagation();
    const container = (e.currentTarget as HTMLElement).closest('[data-lane-wave]') as HTMLElement | null;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dur = laneDurations[lane.id] || duration || 30;
    const move = (ev: PointerEvent) => {
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      if (which === 'in') updateLane(lane.id, { fadeIn: Math.min(frac * dur, dur / 2) });
      else updateLane(lane.id, { fadeOut: Math.min((1 - frac) * dur, dur / 2) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // --- Show/Hide lanes: Shift-H hides the selected lane, Shift-Alt-H shows all ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (!e.shiftKey || e.key.toLowerCase() !== 'h') return;
      e.preventDefault();
      if (e.altKey) {
        setLanes(prev => prev.map(l => (l.hidden ? { ...l, hidden: false } : l)));
        setMidiLanes(prev => prev.map(l => (l.hidden ? { ...l, hidden: false } : l)));
        showToast('All hidden lanes are visible again.');
      } else if (selectedMidiLaneId) {
        updateMidiLane(selectedMidiLaneId, { hidden: true });
        showToast('MIDI lane hidden — it keeps playing in the mix. Shift-Alt-H brings it back.');
      } else if (selectedLaneId) {
        updateLane(selectedLaneId, { hidden: true });
        showToast('Lane hidden — it keeps playing in the mix. Shift-Alt-H brings it back.');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLaneId, selectedMidiLaneId]);

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

  /** Bounce the live lane mix (levels, pan, mute/solo) to a single WAV file.
   *  Audio lanes are rendered from their buffers; MIDI lanes are rendered
   *  with the same simple synth preview voice used for live playback. */
  const bounceMix = async () => {
    if (lanes.length === 0 && midiLanes.length === 0) { showToast('No lanes to bounce.'); return; }
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
      const sampleRate = decoded.length > 0 ? decoded[0].buffer.sampleRate : 44100;
      const audioDur = decoded.length > 0 ? Math.max(...decoded.map(d => d.buffer.duration)) : 0;
      const midiDur = midiLanesRef.current.reduce((m, l) => Math.max(m, ...l.notes.map(n => n.end)), 0);
      const maxDur = Math.max(audioDur, midiDur, 1);
      const off = new OfflineAudioContext(2, Math.ceil(maxDur * sampleRate), sampleRate);
      const anySolo = lanesRef.current.some(l => l.solo) || midiLanesRef.current.some(l => l.solo);
      decoded.forEach(({ buffer, lane }) => {
        const src = off.createBufferSource();
        src.buffer = buffer;
        // Reverse + pitch/stretch are rate-based live; the bounce renders the
        // stored (already reversed, if reversed) file at its native rate.
        // Fades ARE rendered here with the clip's curve shape.
        const gain = off.createGain();
        const pan = off.createStereoPanner();
        const effective = lane.muted ? 0 : (anySolo && !lane.solo ? 0 : lane.volume / 100);
        const baseGain = effective * (masterVolume / 100);
        gain.gain.value = baseGain;
        pan.pan.value = lane.pan / 100;
        const clipDur = buffer.duration;
        if (lane.fadeIn > 0 && baseGain > 0) {
          const fi = Math.min(lane.fadeIn, clipDur / 2);
          gain.gain.setValueAtTime(0.0001, 0);
          if (lane.fadeCurve === 'exp') {
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, baseGain), fi);
          } else if (lane.fadeCurve === 'log') {
            for (let i = 1; i <= 8; i++) {
              const x = i / 8;
              gain.gain.linearRampToValueAtTime(Math.max(0.0001, baseGain * (1 - (1 - x) * (1 - x))), fi * x);
            }
          } else {
            gain.gain.linearRampToValueAtTime(Math.max(0.0001, baseGain), fi);
          }
        }
        if (lane.fadeOut > 0 && baseGain > 0) {
          const fo = Math.min(lane.fadeOut, clipDur / 2);
          const start = Math.max(0, clipDur - fo);
          gain.gain.setValueAtTime(Math.max(0.0001, baseGain), start);
          if (lane.fadeCurve === 'exp') {
            gain.gain.exponentialRampToValueAtTime(0.0001, clipDur);
          } else if (lane.fadeCurve === 'log') {
            for (let i = 1; i <= 8; i++) {
              const x = i / 8;
              gain.gain.linearRampToValueAtTime(Math.max(0.0001, baseGain * (1 - x * x)), start + fo * x);
            }
          } else {
            gain.gain.linearRampToValueAtTime(0.0001, clipDur);
          }
        }
        // Lane effects are rendered in the bounce too (same chain as live).
        const fx = createEffectChain(off, lane.effects);
        src.connect(gain); gain.connect(pan);
        pan.connect(fx.input); fx.output.connect(off.destination);
        src.start(0);
      });
      midiLanesRef.current.forEach(lane => {
        const audible = !lane.muted && (!anySolo || lane.solo);
        if (!audible || lane.notes.length === 0) return;
        const gain = off.createGain();
        const pan = off.createStereoPanner();
        gain.gain.value = (lane.volume / 100) * (masterVolume / 100);
        pan.pan.value = lane.pan / 100;
        const fx = createEffectChain(off, lane.effects);
        gain.connect(pan);
        pan.connect(fx.input); fx.output.connect(off.destination);
        lane.notes.forEach(note => {
          playSynthNote(off, gain, { midi: note.pitch, velocity: note.velocity, when: note.start, duration: Math.max(0.05, note.end - note.start) });
        });
      });
      const rendered = await off.startRendering();
      const blob = encodeWav(rendered.getChannelData(0), rendered.getChannelData(1), sampleRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${(loadedSong?.title || 'swcafe-mix').replace(/[^\w-]+/g, '_')}_mix.wav`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('Mix bounced to WAV (MIDI lanes rendered with the preview synth voice).');
    } catch {
      showToast('Bounce needs decodable audio — downloading the master file instead.');
      await downloadMaster();
    } finally {
      setIsBouncing(false);
    }
  };

  const selectedLane = lanes.find(l => l.id === selectedLaneId) || null;

  // --- Effects rack: per-lane plugins (audio + MIDI lanes) ---
  const fxTarget = selectedLane
    ? { kind: 'audio' as const, id: selectedLane.id, name: selectedLane.name, effects: selectedLane.effects }
    : (() => {
        const m = midiLanes.find(l => l.id === selectedMidiLaneId);
        return m ? { kind: 'midi' as const, id: m.id, name: m.name, effects: m.effects } : null;
      })();

  const setFxForTarget = (effects: PluginInstance[]) => {
    if (!fxTarget) return;
    if (fxTarget.kind === 'audio') updateLane(fxTarget.id, { effects });
    else updateMidiLane(fxTarget.id, { effects });
  };

  const addPlugin = (type: PluginType, preset?: Record<string, number>) => {
    if (!fxTarget) { showToast('Select a lane first, then add an effect.'); return; }
    const existing = fxTarget.effects.find(p => p.type === type);
    if (existing) {
      // One slot per effect type: re-apply the preset and enable it.
      setFxForTarget(fxTarget.effects.map(p => (p.type === type ? { ...p, enabled: true, params: { ...p.params, ...(preset || {}) } } : p)));
      showToast(`${PLUGIN_DEFS[type].label} is already on this lane — preset re-applied and enabled.`);
      return;
    }
    setFxForTarget([...fxTarget.effects, createPluginInstance(type, preset)]);
    showToast(`${PLUGIN_DEFS[type].label} added to ${fxTarget.name}.`);
  };

  const updatePluginParam = (pluginId: string, key: string, value: number) => {
    if (!fxTarget) return;
    setFxForTarget(fxTarget.effects.map(p => (p.id === pluginId ? { ...p, params: { ...p.params, [key]: value } } : p)));
  };

  const togglePlugin = (pluginId: string) => {
    if (!fxTarget) return;
    setFxForTarget(fxTarget.effects.map(p => (p.id === pluginId ? { ...p, enabled: !p.enabled } : p)));
  };

  const removePlugin = (pluginId: string) => {
    if (!fxTarget) return;
    setFxForTarget(fxTarget.effects.filter(p => p.id !== pluginId));
  };

  /** Plugin Builder: match the prompt to presets from the built-in library.
   *  Honest by design — this is preset-matching, not generated DSP. */
  const handlePluginPrompt = () => {
    const text = pluginPrompt.trim();
    if (!text) {
      setPluginPromptNote('Describe an effect — e.g. "warm hall reverb" or "sweeping auto-pan".');
      return;
    }
    if (!fxTarget) {
      setPluginPromptNote('Select a lane first — the built effect goes on the selected lane.');
      return;
    }
    const { matches, notes } = matchPluginsFromPrompt(text);
    if (matches.length === 0) {
      setPluginPromptNote(
        `No match for that — I can build chorus, auto-pan, delay, or reverb from words. Try "add a warm hall reverb".${notes.length > 0 ? ` ${notes.join(' ')}` : ''}`
      );
      return;
    }
    // Apply all matches to one fresh effects list (one state write, so a
    // prompt matching two effects keeps both).
    let effects = [...fxTarget.effects];
    matches.forEach(m => {
      const existing = effects.find(p => p.type === m.type);
      if (existing) {
        effects = effects.map(p => (p.type === m.type ? { ...p, enabled: true, params: { ...p.params, ...m.preset } } : p));
      } else {
        effects = [...effects, createPluginInstance(m.type, m.preset)];
      }
    });
    setFxForTarget(effects);
    setPluginPromptNote(
      `Built from your words (preset match, not generated DSP): ${matches.map(m => m.why).join(' · ')}.${notes.length > 0 ? ` ${notes.join(' ')}` : ''}`
    );
  };

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
          <button
            onClick={() => setTypingOn(!typingOn)}
            title="Musical typing — play notes with your computer keyboard (A–K rows)"
            className={`px-2 py-1 rounded text-[9px] font-black uppercase border transition-colors ${typingOn ? 'bg-orange-500/10 text-orange-400 border-orange-500/25' : 'bg-[#1a1a1e] border-white/5 text-zinc-500 hover:text-zinc-300'}`}
          >
            <span className="flex items-center gap-1"><Keyboard size={10} /> Keys</span>
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
          <select value={String(speed)} onChange={(e) => { const s = parseFloat(e.target.value); setSpeed(s); nodesRef.current.forEach((n, id) => { const lane = lanesRef.current.find(l => l.id === id); if (lane) n.el.playbackRate = effectiveRate(lane, s); }); }} className="bg-[#1a1a1e] border border-white/5 rounded px-1.5 py-1 text-[11px] font-mono text-zinc-300 outline-none cursor-pointer" title="Playback speed (real)">
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
              <p className="text-[10px] text-zinc-500 leading-relaxed">MIDI lanes play a simple synth preview voice — not a sampled instrument. Double-click any clip for its Clip Settings (volume, pitch, loop, reverse, stretch, fades). Right-click a clip to rename it. Shift-H hides a lane, Shift-Alt-H shows hidden lanes again.</p>
              <button onClick={onOpenVoice} className="w-full py-2 rounded-lg bg-[#1a1a1e] hover:bg-white/10 border border-white/5 text-[10px] font-black uppercase tracking-wider text-[#ec4899] transition-colors">+ Voice</button>
            </div>
          </div>
        </div>

        {/* CLIP SETTINGS — sidebar left of the timeline (double-click a clip to open) */}
        {clipPanelOpen && selectedLane && (
          <div className="w-[240px] border-r border-white/5 bg-[#131316] flex flex-col shrink-0 min-h-0 z-30">
            <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/5 shrink-0">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <SlidersHorizontal size={11} className="text-orange-400" /> Clip Settings
              </span>
              <button onClick={() => setClipPanelOpen(false)} className="text-zinc-500 hover:text-white transition-colors" title="Close Clip Settings">
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase block">Clip name</span>
                <input
                  type="text"
                  value={selectedLane.name}
                  onChange={(e) => updateLane(selectedLane.id, { name: e.target.value })}
                  className="w-full bg-[#1a1a1e] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-orange-500/40"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase"><span>Volume</span><span className="text-zinc-300 font-mono">{selectedLane.volume}%</span></div>
                <input type="range" min="0" max="100" value={selectedLane.volume} onChange={(e) => updateLane(selectedLane.id, { volume: parseInt(e.target.value) })} className="w-full accent-[#ff5e00] cursor-pointer h-1" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase"><span>Fine pitch</span><span className="text-zinc-300 font-mono">{formatPitch(selectedLane.pitch)} st</span></div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pitchText}
                    onChange={(e) => {
                      setPitchText(e.target.value);
                      const p = parsePitchText(e.target.value);
                      if (p !== null && Math.abs(p) <= 24) updateLane(selectedLane.id, { pitch: p });
                    }}
                    className="w-20 bg-[#1a1a1e] border border-white/5 rounded-lg px-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-orange-500/40 text-center"
                    title="Semitones.cents — e.g. 2.38 means 2 semitones and 38 cents"
                  />
                  <input
                    type="range" min="-12" max="12" step="0.1" value={selectedLane.pitch}
                    onChange={(e) => { const p = parseFloat(e.target.value); setPitchText(formatPitch(p)); updateLane(selectedLane.id, { pitch: p }); }}
                    className="flex-1 accent-[#ff5e00] cursor-pointer h-1"
                  />
                </div>
                <p className="text-[9px] text-zinc-600 leading-snug">Type semitones.cents — 2.38 = 2 semitones + 38 cents. Pitch uses playback rate, so it also shifts tempo.</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase"><span>Timestretch</span><span className="text-zinc-300 font-mono">{selectedLane.stretch.toFixed(2)}×</span></div>
                <input
                  type="range" min="0.5" max="2" step="0.05" value={selectedLane.stretch}
                  onChange={(e) => updateLane(selectedLane.id, { stretch: parseFloat(e.target.value) })}
                  className="w-full accent-[#ff5e00] cursor-pointer h-1"
                />
                <p className="text-[9px] text-zinc-600 leading-snug">Rate-based stretch: it changes tempo and pitch together (there is no pitch-preserving timestretch engine yet).</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateLane(selectedLane.id, { loop: !selectedLane.loop })}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${selectedLane.loop ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/5'}`}
                  title="Restart this clip when it ends"
                >
                  Loop {selectedLane.loop ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => void toggleReverse(selectedLane)}
                  disabled={reversingLaneId === selectedLane.id}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-50 ${selectedLane.reverse ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/5'}`}
                  title="Play this clip backwards (re-encoded as WAV for this session)"
                >
                  {reversingLaneId === selectedLane.id ? 'Reversing…' : selectedLane.reverse ? 'Reversed ✓' : 'Reverse'}
                </button>
              </div>
              <div className="space-y-2 border-t border-white/5 pt-3">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase block">Fades (seconds)</span>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <span className="text-[9px] text-zinc-600 block mb-0.5">Fade in</span>
                    <input type="number" min="0" max="30" step="0.1" value={selectedLane.fadeIn} onChange={(e) => updateLane(selectedLane.id, { fadeIn: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-full bg-[#1a1a1e] border border-white/5 rounded-lg px-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-orange-500/40" />
                  </label>
                  <label className="flex-1">
                    <span className="text-[9px] text-zinc-600 block mb-0.5">Fade out</span>
                    <input type="number" min="0" max="30" step="0.1" value={selectedLane.fadeOut} onChange={(e) => updateLane(selectedLane.id, { fadeOut: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-full bg-[#1a1a1e] border border-white/5 rounded-lg px-2 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-orange-500/40" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-[9px] text-zinc-600 block mb-0.5">Fade curve — drag the fade handles on the clip, or pick a shape here</span>
                  <select
                    value={selectedLane.fadeCurve}
                    onChange={(e) => updateLane(selectedLane.id, { fadeCurve: e.target.value as FadeCurve })}
                    className="w-full bg-[#1a1a1e] border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 outline-none cursor-pointer"
                  >
                    <option value="linear">Linear</option>
                    <option value="exp">Exponential (slow start)</option>
                    <option value="log">Logarithmic (fast start)</option>
                  </select>
                </label>
                <p className="text-[9px] text-zinc-600 leading-snug">Fades are real gain automation on the clip edges, and they are included when you bounce the mix.</p>
              </div>
              <div className="space-y-1 border-t border-white/5 pt-3">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase block">Honest limits</span>
                <p className="text-[9px] text-zinc-600 leading-relaxed">Pitch and timestretch both use playback rate, so they move tempo and pitch together. Reverse re-encodes the clip as a WAV file for this session only. Section timings stay proportional/approximate.</p>
              </div>
            </div>
          </div>
        )}

        {/* CENTER: TIMELINE */}
        <div className="flex-1 bg-[#131316] flex flex-col min-w-0 overflow-hidden relative">
          <div className="h-10 bg-[#131316] border-b border-white/5 flex items-center justify-between px-3.5 shrink-0 z-20">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-mono">Timeline</span>
              {loadedSong && <span className="text-[10px] font-bold text-zinc-300 truncate max-w-[300px]">{loadedSong.title} · {loadedSong.genre}</span>}
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addUploadLane(f); }} />
              <input ref={midiFileInputRef} type="file" accept=".mid,.midi,audio/midi" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importMidiFile(f); }} />
              <button onClick={() => fileInputRef.current?.click()} className="h-7 px-2.5 bg-[#1a1a1e] hover:bg-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300 rounded border border-white/5 flex items-center gap-1 transition-colors">
                <Upload size={11} /> Add lane
              </button>
              <button onClick={() => midiFileInputRef.current?.click()} title="Import a .mid file as a MIDI lane" className="h-7 px-2.5 bg-[#1a1a1e] hover:bg-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300 rounded border border-white/5 flex items-center gap-1 transition-colors">
                <Music size={11} /> Import MIDI
              </button>
              {(lanes.some(l => l.hidden) || midiLanes.some(l => l.hidden)) && (
                <button
                  onClick={() => {
                    setLanes(prev => prev.map(l => (l.hidden ? { ...l, hidden: false } : l)));
                    setMidiLanes(prev => prev.map(l => (l.hidden ? { ...l, hidden: false } : l)));
                  }}
                  title="Hidden lanes keep playing — click to show them again (or Shift-Alt-H)"
                  className="h-7 px-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-[10px] font-black uppercase tracking-wider text-orange-300 rounded border border-orange-500/25 flex items-center gap-1 transition-colors"
                >
                  <EyeOff size={11} /> {lanes.filter(l => l.hidden).length + midiLanes.filter(l => l.hidden).length} hidden
                </button>
              )}
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
            {lanes.length === 0 && midiLanes.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-8">
                <Music size={28} className="text-zinc-700" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Studio empty</p>
                <p className="text-[11px] text-zinc-600 max-w-sm leading-relaxed">Pick a song from the session list or generate one. Then add upload lanes to layer audio over it — every lane plays in sync through one mix bus.</p>
              </div>
            )}
            {lanes.filter(l => !l.hidden).map(lane => {
              const isSelected = selectedLaneId === lane.id;
              const lanePeaks = peaks[lane.id] || seededPeaks(lane.id, 96);
              const laneDur = laneDurations[lane.id] || duration || 30;
              const fadeInPct = lane.fadeIn > 0 ? Math.min(50, (lane.fadeIn / laneDur) * 100) : 0;
              const fadeOutPct = lane.fadeOut > 0 ? Math.min(50, (lane.fadeOut / laneDur) * 100) : 0;
              return (
                <div
                  key={lane.id}
                  onClick={() => { setSelectedLaneId(lane.id); setSelectedMidiLaneId(null); }}
                  onDoubleClick={() => { setSelectedLaneId(lane.id); setClipPanelOpen(true); }}
                  onContextMenu={(e) => { e.preventDefault(); setSelectedLaneId(lane.id); setRenamingLaneId(lane.id); setRenameText(lane.name); }}
                  className={`h-20 border-b border-white/5 flex cursor-pointer transition-colors ${isSelected ? 'bg-white/[0.035]' : 'hover:bg-white/[0.015]'}`}
                  title="Double-click for Clip Settings · Right-click to rename"
                >
                  <div className={`w-[168px] h-full border-r border-white/5 flex flex-col justify-center px-3 gap-1 shrink-0 select-none ${isSelected ? 'bg-[#1a1a1e]' : 'bg-[#131316]/30'}`}>
                    <div className="flex items-center justify-between gap-1">
                      {renamingLaneId === lane.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setRenamingLaneId(null);
                          }}
                          className="w-full bg-[#131316] border border-orange-500/40 rounded px-1.5 py-0.5 text-[10px] font-bold text-zinc-100 outline-none"
                        />
                      ) : (
                        <span className="text-[10px] font-black truncate uppercase" style={{ color: lane.color }}>{lane.name}</span>
                      )}
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
                  <div className="flex-1 relative bg-[#131316]/15 overflow-hidden h-full" data-lane-wave onClick={seekFromRuler}>
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
                    {/* Fade overlays + draggable curve handles */}
                    {fadeInPct > 0 && (
                      <div className="absolute top-0 bottom-0 left-0 bg-white/[0.06] border-r border-orange-400/50 pointer-events-none" style={{ width: `${fadeInPct}%` }}>
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                          <path d={fadePath(lane.fadeCurve, 'in')} fill="none" stroke="#fb923c" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    )}
                    {fadeOutPct > 0 && (
                      <div className="absolute top-0 bottom-0 right-0 bg-white/[0.06] border-l border-orange-400/50 pointer-events-none" style={{ width: `${fadeOutPct}%` }}>
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                          <path d={fadePath(lane.fadeCurve, 'out')} fill="none" stroke="#fb923c" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    )}
                    {fadeInPct > 0 && (
                      <div
                        onPointerDown={startFadeDrag(lane, 'in')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-1 w-3 h-3 rounded-full bg-orange-400 border border-white/60 cursor-ew-resize z-10 shadow"
                        style={{ left: `calc(${fadeInPct}% - 6px)` }}
                        title={`Fade in ${lane.fadeIn.toFixed(1)}s (${lane.fadeCurve}) — drag to change length`}
                      />
                    )}
                    {fadeOutPct > 0 && (
                      <div
                        onPointerDown={startFadeDrag(lane, 'out')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-1 w-3 h-3 rounded-full bg-orange-400 border border-white/60 cursor-ew-resize z-10 shadow"
                        style={{ right: `calc(${fadeOutPct}% - 6px)` }}
                        title={`Fade out ${lane.fadeOut.toFixed(1)}s (${lane.fadeCurve}) — drag to change length`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {/* MIDI LANES */}
            {midiLanes.filter(l => !l.hidden).map(lane => {
              const isSelected = selectedMidiLaneId === lane.id;
              const pitches = lane.notes.map(n => n.pitch);
              const low = pitches.length > 0 ? Math.min(...pitches) - 1 : 48;
              const high = pitches.length > 0 ? Math.max(...pitches) + 1 : 71;
              const laneLen = Math.max(duration || 30, ...lane.notes.map(n => n.end), 8);
              return (
                <div
                  key={lane.id}
                  onClick={() => { setSelectedMidiLaneId(lane.id); setSelectedLaneId(null); }}
                  onDoubleClick={() => setEditingMidiLaneId(lane.id)}
                  className={`h-20 border-b border-white/5 flex cursor-pointer transition-colors ${isSelected ? 'bg-white/[0.035]' : 'hover:bg-white/[0.015]'}`}
                  title="MIDI lane — double-click to open the piano roll"
                >
                  <div className={`w-[168px] h-full border-r border-white/5 flex flex-col justify-center px-3 gap-1 shrink-0 select-none ${isSelected ? 'bg-[#1a1a1e]' : 'bg-[#131316]/30'}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black truncate uppercase" style={{ color: lane.color }}>🎹 {lane.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeMidiLane(lane.id); }}
                        className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                        title="Remove MIDI lane"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateMidiLane(lane.id, { solo: !lane.solo }); }}
                        className={`w-6 h-5 rounded text-[8px] font-black transition-colors ${lane.solo ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-zinc-700 text-zinc-400'}`}
                      >
                        S
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateMidiLane(lane.id, { muted: !lane.muted }); }}
                        className={`w-6 h-5 rounded text-[8px] font-black transition-colors ${lane.muted ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-zinc-700 text-zinc-400'}`}
                      >
                        M
                      </button>
                      <input
                        type="range" min="0" max="100" value={lane.volume}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateMidiLane(lane.id, { volume: parseInt(e.target.value) })}
                        className="flex-1 accent-[#ff5e00] h-1 cursor-pointer"
                      />
                      <span className="text-[8px] font-mono text-zinc-500 w-7 text-right">{lane.volume}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingMidiLaneId(editingMidiLaneId === lane.id ? null : lane.id); }}
                        className="flex-1 py-0.5 rounded text-[8px] font-black uppercase bg-white/10 hover:bg-white/15 text-zinc-300 transition-colors"
                      >
                        Piano roll
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); exportMidiLane(lane); }}
                        className="flex-1 py-0.5 rounded text-[8px] font-black uppercase bg-white/10 hover:bg-white/15 text-zinc-300 transition-colors flex items-center justify-center gap-0.5"
                        title="Download this lane as a .mid file"
                      >
                        <FileDown size={9} /> .mid
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 relative bg-[#131316]/15 overflow-hidden h-full" onClick={() => setEditingMidiLaneId(lane.id)}>
                    {lane.notes.map(note => (
                      <div
                        key={note.id}
                        className="absolute rounded-[2px]"
                        style={{
                          left: `${(note.start / laneLen) * 100}%`,
                          width: `${Math.max(0.6, ((note.end - note.start) / laneLen) * 100)}%`,
                          top: `${((high - note.pitch) / (high - low + 1)) * 100}%`,
                          height: `${100 / (high - low + 1)}%`,
                          backgroundColor: lane.color,
                          opacity: lane.muted ? 0.25 : 0.9,
                        }}
                        title={`${midiName(note.pitch)} · ${note.start.toFixed(2)}s`}
                      />
                    ))}
                    <div className="absolute top-0 bottom-0 w-[1.5px] bg-red-500/80 pointer-events-none" style={{ left: `${playheadPct}%` }}></div>
                    {lane.notes.length === 0 && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-zinc-600">No notes — open the piano roll to add some.</span>}
                  </div>
                </div>
              );
            })}
            {lanes.length > 0 && lanes.every(l => l.hidden) && midiLanes.every(l => l.hidden) && (
              <div className="px-4 py-4 text-center">
                <p className="text-[11px] text-zinc-500">All lanes are hidden — they keep playing in the mix. Press <span className="font-mono text-zinc-300">Shift-Alt-H</span> to show them again.</p>
              </div>
            )}
            {/* MIDI CONTROLLER */}
            <div className="px-4 py-3 border-t border-white/5 flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">MIDI controller</span>
              {midiStatus === 'on' ? (
                <span className="text-[10px] text-emerald-400 font-bold">Connected: {midiInputs.join(', ')}</span>
              ) : midiStatus === 'connecting' ? (
                <span className="text-[10px] text-zinc-400">Connecting…</span>
              ) : midiStatus === 'unsupported' ? (
                <span className="text-[10px] text-zinc-500">Web MIDI is not supported in this browser.</span>
              ) : (
                <button
                  onClick={() => void connectMidiController()}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] font-black uppercase text-zinc-300 transition-colors"
                >
                  Connect controller
                </button>
              )}
              <span className="text-[9px] text-zinc-600 leading-snug">Plays the synth preview voice live. Recording from a controller is not supported yet.</span>
            </div>
            <p className="text-[9px] text-zinc-600 px-4 py-3 leading-relaxed">
              Waveforms show real decoded peaks when the file can be read; otherwise a placeholder pattern is drawn. Section timings are proportional to the lyrics and approximate — the audio itself is the truth. MIDI lanes use a simple synth preview voice, not a sampled instrument.
            </p>
          </div>

          {/* PIANO ROLL — edits the selected MIDI lane */}
          {editingMidiLaneId && (() => {
            const lane = midiLanes.find(l => l.id === editingMidiLaneId);
            if (!lane) return null;
            const laneMaxEnd = Math.max(0, ...lane.notes.map(n => n.end));
            const prDuration = Math.max(duration || 0, laneMaxEnd, 8);
            return (
              <div className="border-t border-white/10 bg-[#131316] shrink-0 max-h-[46%] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 sticky top-0 bg-[#131316] z-10">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    Piano roll — <span style={{ color: lane.color }}>{lane.name}</span>
                    <span className="normal-case font-bold text-zinc-600 ml-2">MIDI edits are session-only (export .mid to keep them)</span>
                  </span>
                  <button onClick={() => setEditingMidiLaneId(null)} className="text-zinc-500 hover:text-white transition-colors" title="Close piano roll">
                    <X size={13} />
                  </button>
                </div>
                <PianoRoll
                  notes={lane.notes}
                  onChange={(notes) => updateMidiLane(lane.id, { notes })}
                  duration={prDuration}
                  color={lane.color}
                  onPreviewNote={previewMidiNote}
                />
              </div>
            );
          })()}

          {/* MUSICAL TYPING STRIP */}
          {typingOn && (
            <div className="border-t border-white/10 bg-[#131316] shrink-0 px-3 py-2 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Musical typing</span>
                <span className="text-[9px] font-mono text-zinc-400">Octave {typingOctave >= 0 ? '+' : ''}{typingOctave} (Z / X to shift) · base {midiName(60 + typingOctave * 12)}</span>
                <button
                  onClick={() => setArpOn(!arpOn)}
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors ${arpOn ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-white/5 text-zinc-400 border border-white/5'}`}
                >
                  Arpeggiator {arpOn ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => setChordOn(!chordOn)}
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors ${chordOn ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-white/5 text-zinc-400 border border-white/5'}`}
                >
                  Chord mode {chordOn ? 'On' : 'Off'}
                </button>
                <span className="text-[9px] text-zinc-600">Hold keys to play — the typing keyboard is a simple synth preview voice, not a sampled instrument.</span>
              </div>
              <div className="flex gap-1 overflow-x-auto custom-scrollbar">
                {TYPING_KEYS.map(k => {
                  const offset = TYPING_MAP[k];
                  const midi = 60 + typingOctave * 12 + offset;
                  const isBlack = [1, 3, 6, 8, 10, 13].includes(offset % 12);
                  const isHeld = heldKeys.includes(k);
                  return (
                    <button
                      key={k}
                      onPointerDown={() => { if (arpOn) { arpHeldRef.current.set(k, midi); startArpTimer(); } else { playTypingNote(k, midi); } setHeldKeys(prev => (prev.includes(k) ? prev : [...prev, k])); }}
                      onPointerUp={() => {
                        if (arpOn) { arpHeldRef.current.delete(k); } else {
                          const stops = typingVoicesRef.current.get(k);
                          stops?.forEach(s => { try { s(); } catch { /* noop */ } });
                          typingVoicesRef.current.delete(k);
                        }
                        setHeldKeys(prev => prev.filter(x => x !== k));
                      }}
                      onPointerLeave={() => {
                        if (arpOn) { arpHeldRef.current.delete(k); } else {
                          const stops = typingVoicesRef.current.get(k);
                          stops?.forEach(s => { try { s(); } catch { /* noop */ } });
                          typingVoicesRef.current.delete(k);
                        }
                        setHeldKeys(prev => prev.filter(x => x !== k));
                      }}
                      className={`shrink-0 w-9 h-12 rounded-b-md border flex flex-col items-center justify-end pb-1 transition-colors ${isHeld ? 'bg-orange-500 border-orange-400' : isBlack ? 'bg-[#222226] border-black/40 text-zinc-400' : 'bg-[#e8e8e8] border-black/20 text-zinc-700'}`}
                      title={`${midiName(midi)} — press "${k.toUpperCase()}"`}
                    >
                      <span className="text-[9px] font-black font-mono">{k.toUpperCase()}</span>
                      <span className="text-[7px] font-mono opacity-70">{midiName(midi)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
                          <button key={s} onClick={() => { setSpeed(s); nodesRef.current.forEach((n, id) => { const lane = lanesRef.current.find(l => l.id === id); if (lane) n.el.playbackRate = effectiveRate(lane, s); }); }} className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all ${speed === s ? 'bg-white/10 text-cyan-400' : 'bg-[#131316] text-zinc-500 hover:text-zinc-300'}`}>{s}×</button>
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

                {/* Effects Rack — real Web Audio inserts on the selected lane */}
                <div className="space-y-3 bg-[#1a1a1e]/70 border border-white/5 rounded-2xl p-3.5">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                    🎛️ Effects Rack{fxTarget ? ` — ${fxTarget.name}` : ''}
                  </span>
                  {!fxTarget ? (
                    <p className="text-[10px] text-zinc-500 leading-relaxed">Select an audio or MIDI lane to add effects to it.</p>
                  ) : (
                    <>
                      {fxTarget.effects.length === 0 ? (
                        <p className="text-[10px] text-zinc-500 leading-relaxed">No effects on this lane yet. Add one below, or describe one in the Plugin Builder.</p>
                      ) : (
                        <div className="space-y-2">
                          {fxTarget.effects.map(plugin => (
                            <div key={plugin.id} className="bg-[#131316] border border-white/5 rounded-xl p-2.5 space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={plugin.enabled}
                                  onChange={() => togglePlugin(plugin.id)}
                                  className="accent-[#ff5e00] cursor-pointer"
                                  title={plugin.enabled ? 'Bypass this effect' : 'Enable this effect'}
                                />
                                <span className="text-[10px] font-black uppercase tracking-wider text-white flex-1">{PLUGIN_DEFS[plugin.type].label}</span>
                                <button onClick={() => removePlugin(plugin.id)} className="text-zinc-500 hover:text-red-400 text-xs px-1" title="Remove effect">✕</button>
                              </div>
                              <p className="text-[9px] text-zinc-600 leading-snug">{PLUGIN_DEFS[plugin.type].blurb}</p>
                              {PLUGIN_DEFS[plugin.type].params.map(param => (
                                <div key={param.key} className="space-y-0.5">
                                  <div className="flex justify-between text-[9px] font-extrabold text-zinc-500 uppercase">
                                    <span>{param.label}</span>
                                    <span className="text-zinc-300 font-mono">{plugin.params[param.key]}{param.unit || ''}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={param.min}
                                    max={param.max}
                                    step={param.step}
                                    value={plugin.params[param.key]}
                                    onChange={(e) => updatePluginParam(plugin.id, param.key, parseFloat(e.target.value))}
                                    className="w-full accent-[#ff5e00] cursor-pointer h-1"
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {PLUGIN_ORDER.map(type => (
                          <button
                            key={type}
                            onClick={() => addPlugin(type)}
                            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] font-black uppercase tracking-wider text-zinc-300 transition-colors"
                          >
                            + {PLUGIN_DEFS[type].label}
                          </button>
                        ))}
                      </div>
                      {/* Plugin Builder — preset-matching from words */}
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">Plugin Builder — describe it in words</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={pluginPrompt}
                            onChange={(e) => setPluginPrompt(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handlePluginPrompt(); }}
                            placeholder='e.g. "warm hall reverb" or "sweeping auto-pan"'
                            className="flex-1 min-w-0 bg-[#131316] border border-white/10 rounded-lg px-2.5 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/40"
                          />
                          <button
                            onClick={handlePluginPrompt}
                            className="px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap"
                          >
                            Build
                          </button>
                        </div>
                        {pluginPromptNote && <p className="text-[9px] text-zinc-400 leading-snug">{pluginPromptNote}</p>}
                        <p className="text-[9px] text-zinc-600 leading-snug">
                          Preset-matching: your words are matched to the built-in library (chorus, auto-pan, delay, reverb). This does not generate new DSP code. Pitch effects are not available — no pitch engine is connected. Effects are live on the lane and included in Bounce Mix.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2 bg-[#1a1a1e]/70 border border-white/5 rounded-2xl p-3.5">
                  <span className="text-[10px] font-black text-[#ff711d] uppercase tracking-wider block">🎹 Copilot Signal Assist</span>
                  <button onClick={() => void handleCopilot()} disabled={isAskingCopilot || !selectedLane} className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-100 border border-white/5 text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-40">
                    {isAskingCopilot ? 'Scanning…' : 'Run Neural Mix Scan'}
                  </button>
                  {copilotAdvice && <p className="text-[10px] text-zinc-300 leading-relaxed italic whitespace-pre-wrap">{copilotAdvice}</p>}
                </div>

                <div className="space-y-2 bg-[#1a1a1e]/70 border border-white/5 rounded-2xl p-3.5">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Session notes</span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">BPM and time signature set the bar grid only — they do not retime audio. Speed (0.5×/1×/2×) changes real playback rate. Clip pitch and timestretch are also rate-based: they move tempo and pitch together, since there is no pitch-preserving timestretch engine yet. MIDI lanes play a simple synth preview voice, not a sampled instrument. Lane effects (chorus, auto-pan, delay, reverb) are real Web Audio inserts — live on the lane and included in Bounce Mix. The Plugin Builder matches your words to presets from that library; it does not generate new DSP, and pitch effects are not available.</p>
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
