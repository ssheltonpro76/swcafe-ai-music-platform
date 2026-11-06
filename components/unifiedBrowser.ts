/**
 * SwCafe Unified Browser (Section 10) — shared data + analysis layer.
 *
 * Original implementation. One searchable index over every SwCafe content
 * type: library songs, Sounds one-shots/loops, uploaded sounds, stem
 * records, Studio effect presets, and saved Lyricist voices.
 *
 * Honest limits, stated here and in the UI:
 *  - BPM / key / tags on uploads are ESTIMATED on-device with plain Web
 *    Audio analysis (onset autocorrelation for tempo, chroma correlation
 *    for key). That is not full "music understanding" classification —
 *    that needs a model call and is a later phase.
 *  - "More like this" ranks by shared tags + BPM/key proximity, NOT by
 *    audio embeddings. True audio similarity needs embeddings — later.
 *  - Stem records are PLANS only: no separation engine is connected, so
 *    no stem audio exists. Nothing here is faked.
 *  - No third-party catalog (e.g. Splice) is presented: that needs a
 *    licensing/partnership decision.
 *
 * Storage (all localStorage, this browser only):
 *  - swcafe_browser_uploads: uploaded-sound records + estimated tags.
 *  - swcafe_browser_stems: stem plans saved from the Stem Splitter.
 *  - swcafe_browser_collections: named "My Collections" folders.
 *  - swcafe_browser_tags: extra user tags keyed by browser item id.
 * Changes dispatch a `swcafe_browser_updated` window event.
 */

import { getSavedSongsWithRecalled, SavedSong } from '../songs';
import { PLUGIN_DEFS, PLUGIN_ORDER, PluginType } from './studioEffects';

export type BrowserItemType =
  | 'song'
  | 'loop'
  | 'one-shot'
  | 'upload'
  | 'stem'
  | 'preset'
  | 'lyricist';

export interface BrowserItem {
  id: string;
  type: BrowserItemType;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  /** Tags derived from on-device analysis (estimated) vs typed/genre tags. */
  tagsEstimated: boolean;
  bpm?: number;
  bpmEstimated?: boolean;
  key?: string;
  keyEstimated?: boolean;
  durationSec?: number;
  audioUrl?: string;
  /** True when audioUrl is a session-only object URL that will not survive a reload. */
  audioSessionOnly?: boolean;
  createdAt: string;
  /** Where this record came from, for the detail line. */
  source: string;
}

export interface UploadRecord {
  id: string;
  name: string;
  fileName: string;
  size: number;
  durationSec?: number;
  bpm?: number;
  key?: string;
  tags: string[];
  /** Base64 data URL when the file was small enough to persist; otherwise null. */
  audioDataUrl: string | null;
  /** Session object URL (Studio/Player uploads) — works until reload. */
  audioSessionUrl?: string;
  createdAt: string;
}

export interface StemRecord {
  id: string;
  sourceName: string;
  sourceSize: number;
  mode: 'auto' | 'split' | 'advanced';
  target: string;
  selected: string[];
  createdAt: string;
}

export interface BrowserCollection {
  id: string;
  name: string;
  itemIds: string[];
  createdAt: string;
}

export const UPLOADS_KEY = 'swcafe_browser_uploads';
export const STEMS_KEY = 'swcafe_browser_stems';
export const COLLECTIONS_KEY = 'swcafe_browser_collections';
export const USER_TAGS_KEY = 'swcafe_browser_tags';
export const BROWSER_UPDATED_EVENT = 'swcafe_browser_updated';

/** Max file size (bytes) we try to persist as a base64 data URL in localStorage. */
const PERSIST_AUDIO_MAX_BYTES = 4 * 1024 * 1024;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function dispatchBrowserUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent(BROWSER_UPDATED_EVENT));
  } catch {
    /* noop */
  }
}

export function loadUploads(): UploadRecord[] {
  return readJson<UploadRecord[]>(UPLOADS_KEY, []);
}

export function loadStems(): StemRecord[] {
  return readJson<StemRecord[]>(STEMS_KEY, []);
}

export function loadCollections(): BrowserCollection[] {
  return readJson<BrowserCollection[]>(COLLECTIONS_KEY, []);
}

export function loadUserTags(): Record<string, string[]> {
  return readJson<Record<string, string[]>>(USER_TAGS_KEY, {});
}

export function saveUserTags(map: Record<string, string[]>): void {
  writeJson(USER_TAGS_KEY, map);
  dispatchBrowserUpdated();
}

export function addUserTag(itemId: string, tag: string): void {
  const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
  if (!clean) return;
  const map = loadUserTags();
  const existing = map[itemId] ?? [];
  if (!existing.includes(clean)) {
    map[itemId] = [...existing, clean];
    saveUserTags(map);
  }
}

export function removeUserTag(itemId: string, tag: string): void {
  const map = loadUserTags();
  map[itemId] = (map[itemId] ?? []).filter(t => t !== tag);
  saveUserTags(map);
}

/* ------------------------------------------------------------------ */
/* Collections (10.6) — named folders over browser items, persisted.  */
/* ------------------------------------------------------------------ */

export function createCollection(name: string): BrowserCollection | null {
  const clean = name.trim();
  if (!clean) return null;
  const all = loadCollections();
  const col: BrowserCollection = {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    itemIds: [],
    createdAt: new Date().toISOString(),
  };
  writeJson(COLLECTIONS_KEY, [col, ...all]);
  dispatchBrowserUpdated();
  return col;
}

export function deleteCollection(id: string): void {
  writeJson(COLLECTIONS_KEY, loadCollections().filter(c => c.id !== id));
  dispatchBrowserUpdated();
}

export function addItemToCollection(collectionId: string, itemId: string): void {
  const all = loadCollections().map(c =>
    c.id === collectionId && !c.itemIds.includes(itemId)
      ? { ...c, itemIds: [...c.itemIds, itemId] }
      : c
  );
  writeJson(COLLECTIONS_KEY, all);
  dispatchBrowserUpdated();
}

export function removeItemFromCollection(collectionId: string, itemId: string): void {
  const all = loadCollections().map(c =>
    c.id === collectionId ? { ...c, itemIds: c.itemIds.filter(i => i !== itemId) } : c
  );
  writeJson(COLLECTIONS_KEY, all);
  dispatchBrowserUpdated();
}

/* ------------------------------------------------------------------ */
/* Stem plans (10.1 — stems as records, no audio)                     */
/* ------------------------------------------------------------------ */

export function saveStemPlan(
  sourceName: string,
  sourceSize: number,
  mode: 'auto' | 'split' | 'advanced',
  target: string,
  selected: string[]
): StemRecord {
  const rec: StemRecord = {
    id: `stem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceName,
    sourceSize,
    mode,
    target,
    selected,
    createdAt: new Date().toISOString(),
  };
  const all = loadStems();
  writeJson(STEMS_KEY, [rec, ...all]);
  dispatchBrowserUpdated();
  return rec;
}

/* ------------------------------------------------------------------ */
/* On-device audio analysis (10.2) — BPM / key / energy / brightness  */
/* ------------------------------------------------------------------ */

export interface AudioAnalysis {
  durationSec: number;
  bpm: number | null;
  key: string | null;
  energy: 'soft' | 'moderate' | 'energetic';
  brightness: 'warm' | 'neutral' | 'bright';
  tags: string[];
}

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Krumhansl–Schmuckler key profiles (published values, major / minor). */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Small iterative radix-2 FFT (original implementation) — magnitudes only. */
function fftMagnitudes(input: Float32Array): Float32Array {
  const n = input.length;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  re.set(input);
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cwr - im[i + k + len / 2] * cwi;
        const vi = re[i + k + len / 2] * cwi + im[i + k + len / 2] * cwr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = nwr;
      }
    }
  }
  const mags = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) mags[i] = Math.hypot(re[i], im[i]);
  return mags;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function monoMixdown(buf: AudioBuffer): Float32Array {
  const len = buf.length;
  const out = new Float32Array(len);
  const chans = buf.numberOfChannels;
  for (let ch = 0; ch < chans; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i] / chans;
  }
  return out;
}

/** Tempo from onset-envelope autocorrelation. Returns BPM or null. */
function estimateBpm(mono: Float32Array, sampleRate: number): number | null {
  const hop = 512;
  const win = 1024;
  const frames = Math.max(1, Math.floor((mono.length - win) / hop));
  if (frames < 40) return null; // too short to read a tempo from
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const start = f * hop;
    for (let i = 0; i < win; i += 4) {
      const v = mono[start + i];
      e += v * v;
    }
    env[f] = e;
  }
  // Onset strength: positive energy jumps, smoothed.
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, env[f] - env[f - 1]);
  const mean = onset.reduce((a, b) => a + b, 0) / frames;
  for (let f = 0; f < frames; f++) onset[f] -= mean;

  const envRate = sampleRate / hop; // onset samples per second
  const minLag = Math.floor((60 / 200) * envRate); // 200 BPM
  const maxLag = Math.min(Math.floor((60 / 60) * envRate), Math.floor(frames / 2)); // 60 BPM
  if (maxLag <= minLag) return null;
  let bestLag = -1;
  let bestVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = 0; f + lag < frames; f++) s += onset[f] * onset[f + lag];
    if (s > bestVal) {
      bestVal = s;
      bestLag = lag;
    }
  }
  if (bestLag <= 0 || bestVal <= 0) return null;
  let bpm = (60 * envRate) / bestLag;
  // Octave guard: if doubling the tempo is nearly as strong, prefer the faster read.
  const doubleLag = Math.floor(bestLag / 2);
  if (doubleLag >= minLag) {
    let s2 = 0;
    for (let f = 0; f + doubleLag < frames; f++) s2 += onset[f] * onset[f + doubleLag];
    if (s2 > bestVal * 0.85) bpm = (60 * envRate) / doubleLag;
  }
  if (bpm < 60 || bpm > 200) return null;
  return Math.round(bpm);
}

/** Key from a chromagram correlated against major/minor profiles. */
function estimateKey(mono: Float32Array, sampleRate: number): string | null {
  const size = 4096;
  const windows = 10;
  const chroma = new Float32Array(12);
  let used = 0;
  for (let w = 0; w < windows; w++) {
    const start = Math.floor(((mono.length - size) * w) / Math.max(1, windows - 1));
    if (start < 0) break;
    const seg = new Float32Array(nextPow2(size));
    for (let i = 0; i < size; i++) {
      // Hann window.
      const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
      seg[i] = mono[start + i] * win;
    }
    const mags = fftMagnitudes(seg);
    for (let bin = 1; bin < mags.length; bin++) {
      const freq = (bin * sampleRate) / seg.length;
      if (freq < 55 || freq > 4000) continue;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += mags[bin];
    }
    used++;
  }
  if (used === 0) return null;
  const total = chroma.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  for (let i = 0; i < 12; i++) chroma[i] /= total;

  let bestKey = -1;
  let bestMode: 'major' | 'minor' = 'major';
  let bestScore = -Infinity;
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const [profile, mode] of [[MAJOR_PROFILE, 'major'], [MINOR_PROFILE, 'minor']] as const) {
      let score = 0;
      for (let pc = 0; pc < 12; pc++) score += chroma[pc] * profile[(pc - tonic + 12) % 12];
      if (score > bestScore) {
        bestScore = score;
        bestKey = tonic;
        bestMode = mode;
      }
    }
  }
  if (bestKey < 0) return null;
  return `${KEY_NAMES[bestKey]} ${bestMode}`;
}

function estimateBrightnessAndEnergy(
  mono: Float32Array,
  sampleRate: number
): { energy: AudioAnalysis['energy']; brightness: AudioAnalysis['brightness'] } {
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < mono.length; i += 7) {
    sumSq += mono[i] * mono[i];
    count++;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, count));
  const energy: AudioAnalysis['energy'] = rms < 0.05 ? 'soft' : rms > 0.16 ? 'energetic' : 'moderate';

  // Spectral centroid from a mid-file window.
  const size = 4096;
  const start = Math.max(0, Math.floor(mono.length / 2) - Math.floor(size / 2));
  const seg = new Float32Array(nextPow2(size));
  for (let i = 0; i < size && start + i < mono.length; i++) seg[i] = mono[start + i];
  const mags = fftMagnitudes(seg);
  let num = 0;
  let den = 0;
  for (let bin = 1; bin < mags.length; bin++) {
    const freq = (bin * sampleRate) / seg.length;
    if (freq > 8000) break;
    num += freq * mags[bin];
    den += mags[bin];
  }
  const centroid = den > 0 ? num / den : 0;
  const brightness: AudioAnalysis['brightness'] = centroid > 2800 ? 'bright' : centroid < 1100 ? 'warm' : 'neutral';
  return { energy, brightness };
}

const FILENAME_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'final', 'master', 'mix', 'v1', 'v2', 'mp3', 'wav', 'aiff',
  'new', 'copy', 'audio', 'track', 'song', 'untitled', 'export', 'bounce',
]);

function filenameTags(fileName: string): string[] {
  const base = fileName.replace(/\.[^.]+$/, '').toLowerCase();
  return base
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 3 && !FILENAME_STOPWORDS.has(w) && !/^\d+$/.test(w))
    .slice(0, 5);
}

/**
 * Analyze an uploaded audio file on-device. Never throws — on any failure
 * it returns filename-only tags so the upload still saves.
 */
export async function analyzeAudioFile(file: File): Promise<AudioAnalysis> {
  const fallback: AudioAnalysis = {
    durationSec: 0,
    bpm: null,
    key: null,
    energy: 'moderate',
    brightness: 'neutral',
    tags: [...new Set(filenameTags(file.name))],
  };
  try {
    const ctx = new AudioContext();
    try {
      const buf = await ctx.decodeAudioData(await file.arrayBuffer());
      const mono = monoMixdown(buf);
      const bpm = estimateBpm(mono, buf.sampleRate);
      const key = estimateKey(mono, buf.sampleRate);
      const { energy, brightness } = estimateBrightnessAndEnergy(mono, buf.sampleRate);
      const tags = new Set<string>(filenameTags(file.name));
      const dur = buf.duration;
      if (dur > 0 && dur < 6) tags.add('one-shot');
      else if (dur >= 6 && dur < 30) tags.add('short-loop');
      if (bpm !== null) {
        tags.add(bpm < 80 ? 'slow' : bpm < 110 ? 'mid-tempo' : bpm < 140 ? 'upbeat' : 'fast');
      }
      if (key) tags.add(key.toLowerCase().replace(' ', '-'));
      tags.add(energy);
      if (brightness !== 'neutral') tags.add(brightness);
      return { durationSec: dur, bpm, key, energy, brightness, tags: [...tags] };
    } finally {
      void ctx.close();
    }
  } catch {
    return fallback;
  }
}

/**
 * Register an uploaded sound: analyze it, persist the record + estimated
 * tags, and notify the browser. Safe to call fire-and-forget from any
 * upload flow (Studio lanes, Player upload, Browser upload) — it never
 * throws and never blocks playback.
 *
 * `persistAudio`: when true (Browser's own upload) the file is stored as
 * a data URL if small enough so it keeps playing after reload. When
 * false (Studio/Player uploads) the session object URL is kept instead
 * and the record is marked session-only.
 */
export async function registerUploadedSound(
  file: File,
  sessionUrl?: string,
  persistAudio = false
): Promise<UploadRecord | null> {
  try {
    const analysis = await analyzeAudioFile(file);
    let audioDataUrl: string | null = null;
    if (persistAudio && file.size <= PERSIST_AUDIO_MAX_BYTES) {
      audioDataUrl = await new Promise<string | null>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
      // localStorage quota guard: if the write below fails, the record
      // still saves with audioDataUrl null (session-only playback).
      if (audioDataUrl) {
        const probe = loadUploads();
        void probe;
      }
    }
    const rec: UploadRecord = {
      id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name.replace(/\.[^.]+$/, '') || 'Upload',
      fileName: file.name,
      size: file.size,
      durationSec: analysis.durationSec || undefined,
      bpm: analysis.bpm ?? undefined,
      key: analysis.key ?? undefined,
      tags: analysis.tags,
      audioDataUrl,
      audioSessionUrl: sessionUrl,
      createdAt: new Date().toISOString(),
    };
    const all = loadUploads();
    const ok = writeJson(UPLOADS_KEY, [rec, ...all]);
    if (!ok && audioDataUrl) {
      // Quota: retry without the embedded audio.
      rec.audioDataUrl = null;
      writeJson(UPLOADS_KEY, [rec, ...all]);
    }
    dispatchBrowserUpdated();
    return rec;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* The unified index (10.1)                                           */
/* ------------------------------------------------------------------ */

interface LyricistRecord {
  id: string;
  name: string;
  examples: string;
  createdAt: string;
}

/** Keywords the plugin presets answer to (same words the Plugin Builder matches). */
const PRESET_TAGS: Record<PluginType, string[]> = {
  chorus: ['chorus', 'wide', 'thicken', 'shimmer', 'lush', 'vocal'],
  autopan: ['auto-pan', 'pan', 'sweep', 'swirl', 'stereo', 'movement'],
  delay: ['delay', 'echo', 'repeat', 'space', 'slapback'],
  reverb: ['reverb', 'hall', 'room', 'depth', 'ambient', 'airy'],
};

function genreTags(genre: string): string[] {
  return genre
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 2 && w !== 'sound')
    .slice(0, 6);
}

function songToItem(song: SavedSong, userTags: Record<string, string[]>): BrowserItem {
  const isSound = song.genre.toLowerCase().startsWith('sound');
  const isLoop = song.genre.toLowerCase().includes('loop');
  const type: BrowserItemType = isSound ? (isLoop ? 'loop' : 'one-shot') : 'song';
  const id = `song:${song.id}`;
  return {
    id,
    type,
    title: song.title,
    subtitle: song.genre,
    description: song.theme ?? (song.lyrics ? song.lyrics.slice(0, 120) : ''),
    tags: [...new Set([...genreTags(song.genre), ...(userTags[id] ?? [])])],
    tagsEstimated: false,
    bpm: song.bpm,
    audioUrl: song.audioUrl,
    createdAt: song.createdAt,
    source: isSound ? 'Sounds mode · saved to library' : 'Song library',
  };
}

export function buildBrowserItems(): BrowserItem[] {
  const userTags = loadUserTags();
  const items: BrowserItem[] = [];

  for (const song of getSavedSongsWithRecalled()) items.push(songToItem(song, userTags));

  for (const up of loadUploads()) {
    const id = `upload:${up.id}`;
    items.push({
      id,
      type: 'upload',
      title: up.name,
      subtitle: `Upload · ${(up.size / 1024 / 1024).toFixed(1)} MB`,
      description: up.fileName,
      tags: [...new Set([...up.tags, ...(userTags[id] ?? [])])],
      tagsEstimated: true,
      bpm: up.bpm,
      bpmEstimated: up.bpm !== undefined,
      key: up.key,
      keyEstimated: up.key !== undefined,
      durationSec: up.durationSec,
      audioUrl: up.audioDataUrl ?? up.audioSessionUrl,
      audioSessionOnly: !up.audioDataUrl && !!up.audioSessionUrl,
      createdAt: up.createdAt,
      source: 'Uploaded sound · auto-tagged on device',
    });
  }

  for (const stem of loadStems()) {
    const id = `stem:${stem.id}`;
    const label =
      stem.mode === 'auto'
        ? 'Auto Split · 12 categories'
        : stem.mode === 'split'
          ? `Split from Mix · ${stem.target}`
          : `Advanced Split · ${stem.selected.length} instrument${stem.selected.length === 1 ? '' : 's'}`;
    items.push({
      id,
      type: 'stem',
      title: `${stem.sourceName} — stem plan`,
      subtitle: label,
      description: 'Planned stem extraction. No audio: no separation engine is connected yet.',
      tags: [...new Set(['stem', stem.mode, ...stem.selected.map(s => s.toLowerCase()), ...(userTags[id] ?? [])])],
      tagsEstimated: false,
      createdAt: stem.createdAt,
      source: 'Stem Splitter · plan only, no audio extracted',
    });
  }

  for (const type of PLUGIN_ORDER) {
    const def = PLUGIN_DEFS[type];
    const id = `preset:${type}`;
    items.push({
      id,
      type: 'preset',
      title: `${def.label} — Studio preset`,
      subtitle: 'Studio effects rack',
      description: def.blurb,
      tags: [...new Set([...PRESET_TAGS[type], ...(userTags[id] ?? [])])],
      tagsEstimated: false,
      createdAt: '2026-11-05T00:00:00Z',
      source: 'Studio · Effects Rack (real Web Audio)',
    });
  }

  for (const l of readJson<LyricistRecord[]>('swcafe_lyricists', [])) {
    const id = `lyricist:${l.id}`;
    items.push({
      id,
      type: 'lyricist',
      title: l.name,
      subtitle: 'Lyricist voice',
      description: l.examples ? l.examples.slice(0, 140) : 'Saved lyric voice.',
      tags: [...new Set(['lyricist', 'lyrics', 'voice', ...(userTags[id] ?? [])])],
      tagsEstimated: false,
      createdAt: l.createdAt,
      source: 'Lyric Studio · saved voice',
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}

/* ------------------------------------------------------------------ */
/* Plain-language search (10.3) — keyword matching, same approach as  */
/* the Plugin Builder: expand the query with synonyms, then match    */
/* against title + description + tags.                                */
/* ------------------------------------------------------------------ */

const QUERY_SYNONYMS: Record<string, string[]> = {
  atmospheric: ['atmospheric', 'ambient', 'airy', 'pad', 'ethereal'],
  ambient: ['ambient', 'atmospheric', 'pad', 'airy'],
  pad: ['pad', 'synth-pad', 'ambient', 'atmospheric'],
  lofi: ['lo-fi', 'lofi', 'vinyl', 'warm', 'mellow', 'dusty'],
  'lo-fi': ['lo-fi', 'lofi', 'vinyl', 'warm', 'mellow', 'dusty'],
  kick: ['kick', 'drums', 'drum', 'percussion'],
  drum: ['drum', 'drums', 'kick', 'percussion', 'beat'],
  drums: ['drum', 'drums', 'kick', 'percussion', 'beat'],
  bass: ['bass', 'sub', 'low'],
  vocal: ['vocal', 'vocals', 'voice', 'choir'],
  vocals: ['vocal', 'vocals', 'voice', 'choir'],
  piano: ['piano', 'keys', 'rhodes'],
  guitar: ['guitar', 'acoustic', 'electric'],
  synth: ['synth', 'synthesizer', 'electronic'],
  slow: ['slow', 'soft', 'mellow'],
  fast: ['fast', 'upbeat', 'energetic'],
  upbeat: ['upbeat', 'fast', 'energetic'],
  energetic: ['energetic', 'upbeat', 'fast'],
  soft: ['soft', 'slow', 'mellow', 'warm'],
  bright: ['bright', 'shimmer', 'airy'],
  warm: ['warm', 'mellow', 'soft'],
  dark: ['dark', 'moody'],
  happy: ['happy', 'upbeat', 'bright'],
  sad: ['sad', 'slow', 'melancholy', 'dark'],
  chill: ['chill', 'mellow', 'lo-fi', 'ambient'],
  loop: ['loop', 'short-loop'],
  oneshot: ['one-shot'],
  'one-shot': ['one-shot'],
};

function normalizeToken(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/** Expand one query word with its synonyms (the word itself always included). */
export function expandQueryTerm(term: string): string[] {
  const t = normalizeToken(term);
  if (!t) return [];
  const syns = QUERY_SYNONYMS[t] ?? [];
  return [...new Set([t, ...syns])];
}

export function matchesQuery(item: BrowserItem, query: string): boolean {
  const tokens = query.split(/\s+/).map(normalizeToken).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = `${item.title} ${item.subtitle} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
  return tokens.every(tok => expandQueryTerm(tok).some(exp => hay.includes(exp)));
}

export function filterItems(
  items: BrowserItem[],
  query: string,
  typeFilter: BrowserItemType | 'all',
  selectedTags: string[]
): BrowserItem[] {
  return items.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (selectedTags.length > 0 && !selectedTags.every(t => item.tags.includes(t))) return false;
    return matchesQuery(item, query);
  });
}

/* ------------------------------------------------------------------ */
/* Find similar sounds (10.4) — shared tags + BPM/key proximity.      */
/* Ranked by tags, NOT by audio embeddings (none exist yet).           */
/* ------------------------------------------------------------------ */

export interface SimilarResult {
  item: BrowserItem;
  score: number;
  reasons: string[];
}

const SIMILAR_TYPES: BrowserItemType[] = ['song', 'loop', 'one-shot', 'upload'];

export function findSimilar(item: BrowserItem, all: BrowserItem[], limit = 5): SimilarResult[] {
  const scored: SimilarResult[] = [];
  for (const other of all) {
    if (other.id === item.id) continue;
    if (!SIMILAR_TYPES.includes(other.type)) continue;
    let score = 0;
    const reasons: string[] = [];
    const shared = item.tags.filter(t => other.tags.includes(t));
    if (shared.length > 0) {
      score += shared.length * 3;
      reasons.push(`${shared.length} shared tag${shared.length === 1 ? '' : 's'}: ${shared.slice(0, 3).join(', ')}`);
    }
    if (item.bpm !== undefined && other.bpm !== undefined) {
      const diff = Math.abs(item.bpm - other.bpm);
      if (diff <= 3) {
        score += 3;
        reasons.push(`BPM ${other.bpm} (Δ${diff})`);
      } else if (diff <= 10) {
        score += 2;
        reasons.push(`BPM ${other.bpm} (Δ${diff})`);
      } else if (diff <= 20) {
        score += 1;
        reasons.push(`BPM ${other.bpm} (Δ${diff})`);
      }
    }
    if (item.key && other.key && item.key === other.key) {
      score += 2;
      reasons.push(`same key ${item.key}`);
    }
    if (item.type === other.type) {
      score += 1;
      reasons.push(`same type: ${other.type}`);
    }
    if (score > 0) scored.push({ item: other, score, reasons });
  }
  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored.slice(0, limit);
}
