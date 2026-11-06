/**
 * MIDI support for SwCafe Studio — original implementation.
 *
 * - Minimal Standard MIDI File (SMF) reader: format 0/1, note on/off, tempo.
 * - Minimal SMF writer: format 0, one track, tempo + note on/off events.
 * - A simple preview synth voice built from Web Audio primitives
 *   (two oscillators, a low-pass filter, an ADSR envelope). This is a
 *   preview voice, not a sampled instrument.
 *
 * No Suno/Logic code, assets, or branding is used here.
 */

export interface MidiNote {
  id: string;
  /** MIDI note number, 0..127 (60 = middle C). */
  pitch: number;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** 1..127. */
  velocity: number;
}

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiName = (midi: number): string => {
  const n = Math.max(0, Math.min(127, Math.round(midi)));
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
};

let noteCounter = 0;
export const makeNoteId = (): string => `n${Date.now().toString(36)}${(noteCounter++).toString(36)}`;

/* ------------------------------------------------------------------ */
/* SMF reading                                                        */
/* ------------------------------------------------------------------ */

class ByteReader {
  pos = 0;
  constructor(private bytes: Uint8Array) {}
  get length(): number { return this.bytes.length; }
  get remaining(): number { return this.bytes.length - this.pos; }
  u8(): number { return this.bytes[this.pos++] ?? 0; }
  u16(): number { return (this.u8() << 8) | this.u8(); }
  u32(): number { return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0; }
  str(len: number): string {
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(this.u8());
    return s;
  }
  /** Standard MIDI variable-length quantity. */
  varLen(): number {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      v = (v << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return v;
  }
}

interface RawEvent {
  tick: number;
  type: 'on' | 'off';
  pitch: number;
  velocity: number;
}

/**
 * Parse a .mid file (ArrayBuffer) into notes + a tempo.
 * Returns notes sorted by start time. Unsupported chunks/events are skipped.
 */
export function parseMidiFile(buf: ArrayBuffer): { notes: MidiNote[]; bpm: number } {
  const r = new ByteReader(new Uint8Array(buf));
  if (r.str(4) !== 'MThd') throw new Error('Not a MIDI file (missing MThd header).');
  const headerLen = r.u32();
  const format = r.u16();
  const trackCount = r.u16();
  const division = r.u16();
  r.pos += Math.max(0, headerLen - 6);
  if (format !== 0 && format !== 1) throw new Error(`MIDI format ${format} is not supported (formats 0 and 1 only).`);
  if (division === 0 || (division & 0x8000) !== 0) throw new Error('SMPTE time division is not supported.');

  const ticksPerQuarter = division;
  const events: RawEvent[] = [];
  let tempoUsPerQuarter = 500000; // default 120 BPM

  for (let t = 0; t < trackCount; t++) {
    if (r.remaining < 8 || r.str(4) !== 'MTrk') break;
    const trackLen = r.u32();
    const trackEnd = Math.min(r.length, r.pos + trackLen);
    let tick = 0;
    let runningStatus = 0;
    while (r.pos < trackEnd) {
      const delta = r.varLen();
      tick += delta;
      let status = r.u8();
      if (status < 0x80) {
        // Running status: this byte is data, reuse the previous status.
        status = runningStatus;
        r.pos -= 1;
      } else {
        runningStatus = status;
      }
      const kind = status & 0xf0;
      if (kind === 0x90 || kind === 0x80) {
        const pitch = r.u8();
        const velocity = r.u8();
        const isOn = kind === 0x90 && velocity > 0;
        events.push({ tick, type: isOn ? 'on' : 'off', pitch, velocity: velocity || 64 });
      } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) {
        r.u8(); r.u8(); // two data bytes, ignored
      } else if (kind === 0xc0 || kind === 0xd0) {
        r.u8(); // one data byte, ignored
      } else if (status === 0xff) {
        const metaType = r.u8();
        const len = r.varLen();
        if (metaType === 0x51 && len === 3) {
          tempoUsPerQuarter = (r.u8() << 16) | (r.u8() << 8) | r.u8();
        } else {
          r.pos += len;
        }
        if (metaType === 0x2f) break; // end of track
      } else if (status === 0xf0 || status === 0xf7) {
        const len = r.varLen();
        r.pos += len; // SysEx, ignored
      } else {
        break; // unknown event — stop this track rather than misreading
      }
    }
    r.pos = trackEnd;
  }

  const secPerTick = (tempoUsPerQuarter / 1_000_000) / ticksPerQuarter;
  const bpm = 60_000_000 / tempoUsPerQuarter;
  events.sort((a, b) => a.tick - b.tick || (a.type === 'off' ? -1 : 1));
  const open = new Map<string, { start: number; velocity: number }>();
  const notes: MidiNote[] = [];
  for (const ev of events) {
    const key = `${ev.pitch}`;
    const t = ev.tick * secPerTick;
    if (ev.type === 'on') {
      if (!open.has(key)) open.set(key, { start: t, velocity: ev.velocity });
    } else {
      const o = open.get(key);
      if (o) {
        if (t > o.start) notes.push({ id: makeNoteId(), pitch: ev.pitch, start: o.start, end: t, velocity: o.velocity });
        open.delete(key);
      }
    }
  }
  // Close any notes left hanging at the last event time.
  const lastTick = events.length > 0 ? events[events.length - 1].tick : 0;
  open.forEach((o, key) => {
    const t = lastTick * secPerTick;
    if (t > o.start) notes.push({ id: makeNoteId(), pitch: parseInt(key, 10), start: o.start, end: t, velocity: o.velocity });
  });
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return { notes, bpm: Math.round(bpm * 10) / 10 };
}

/* ------------------------------------------------------------------ */
/* SMF writing                                                        */
/* ------------------------------------------------------------------ */

const encodeVarLen = (value: number): number[] => {
  let v = Math.max(0, Math.floor(value));
  const bytes = [v & 0x7f];
  v >>= 7;
  while (v > 0) { bytes.unshift((v & 0x7f) | 0x80); v >>= 7; }
  return bytes;
};

/** Write notes as a format-0 .mid file (480 ticks per quarter note). */
export function exportMidiFile(notes: MidiNote[], bpm: number): Blob {
  const ticksPerQuarter = 480;
  const tempoUs = Math.max(100000, Math.round(60_000_000 / Math.max(20, Math.min(300, bpm || 120))));
  const secPerTick = (tempoUs / 1_000_000) / ticksPerQuarter;
  interface Timed { tick: number; bytes: number[]; order: number }
  const timed: Timed[] = [];
  timed.push({ tick: 0, bytes: [0xff, 0x51, 0x03, (tempoUs >> 16) & 0xff, (tempoUs >> 8) & 0xff, tempoUs & 0xff], order: 0 });
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  sorted.forEach((n, i) => {
    const onTick = Math.max(0, Math.round(n.start / secPerTick));
    const offTick = Math.max(onTick + 1, Math.round(n.end / secPerTick));
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity || 80)));
    timed.push({ tick: onTick, bytes: [0x90, n.pitch & 0x7f, vel], order: i * 2 + 1 });
    timed.push({ tick: offTick, bytes: [0x80, n.pitch & 0x7f, 0], order: i * 2 + 2 });
  });
  timed.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const track: number[] = [];
  let lastTick = 0;
  for (const ev of timed) {
    track.push(...encodeVarLen(ev.tick - lastTick), ...ev.bytes);
    lastTick = ev.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00); // end of track
  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0, 0, 0, 6,
    0, 0, // format 0
    0, 1, // one track
    (ticksPerQuarter >> 8) & 0xff, ticksPerQuarter & 0xff,
  ];
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    (track.length >> 24) & 0xff, (track.length >> 16) & 0xff, (track.length >> 8) & 0xff, track.length & 0xff,
  ];
  return new Blob([new Uint8Array([...header, ...trackHeader, ...track])], { type: 'audio/midi' });
}

/* ------------------------------------------------------------------ */
/* Preview synth voice (original Web Audio design)                    */
/* ------------------------------------------------------------------ */

export interface SynthNoteOpts {
  /** MIDI note number. */
  midi: number;
  velocity?: number;
  /** AudioContext time to start at (defaults to now). */
  when?: number;
  /** Seconds; if omitted the note sustains until stop() is called. */
  duration?: number;
}

/**
 * Play one note through a simple original synth voice: two detuned
 * oscillators (saw + square) into a low-pass filter and an ADSR amp
 * envelope. Works with any BaseAudioContext (live or offline).
 * Returns a stop() that releases the note (ignored for fixed durations).
 */
export function playSynthNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  opts: SynthNoteOpts,
): () => void {
  const { midi, velocity = 90, when, duration } = opts;
  const t0 = when ?? ctx.currentTime;
  const freq = midiToFreq(midi);
  const vel = Math.max(0.05, Math.min(1, velocity / 127));

  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = freq;
  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = freq;
  osc2.detune.value = 7;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900 + vel * 2200;
  filter.Q.value = 1.1;

  const amp = ctx.createGain();
  const peak = 0.22 * vel;
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.55), t0 + 0.18);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(amp);
  amp.connect(dest);
  osc1.start(t0);
  osc2.start(t0);

  let stopped = false;
  const release = (at: number) => {
    if (stopped) return;
    stopped = true;
    const rel = Math.max(at, ctx.currentTime);
    try {
      amp.gain.cancelScheduledValues(rel);
      amp.gain.setValueAtTime(Math.max(0.0001, amp.gain.value), rel);
      amp.gain.exponentialRampToValueAtTime(0.0001, rel + 0.22);
      osc1.stop(rel + 0.3);
      osc2.stop(rel + 0.3);
    } catch { /* already stopped */ }
  };
  if (duration !== undefined) {
    release(t0 + Math.max(0.05, duration));
  }
  return () => release(ctx.currentTime);
}
