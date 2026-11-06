/**
 * SwCafe Studio — effects rack (original implementation).
 *
 * A small library of REAL Web Audio effects that can be inserted on any
 * lane (audio or MIDI): chorus, auto-pan, delay, and reverb (convolver
 * with a generated impulse response). The same chain builder works for
 * live playback (AudioContext) and Bounce Mix (OfflineAudioContext),
 * because both are BaseAudioContext.
 *
 * The "Plugin Builder" prompt box maps words to parameter presets from
 * this library (keyword matching) — it does NOT generate new DSP code,
 * and the UI says so. Pitch effects are deliberately absent: no pitch
 * engine is connected or verified.
 */

export type PluginType = 'chorus' | 'autopan' | 'delay' | 'reverb';

export interface PluginInstance {
  id: string;
  type: PluginType;
  enabled: boolean;
  /** Parameter values keyed by the param key in PLUGIN_DEFS. */
  params: Record<string, number>;
}

export interface PluginParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: string;
}

export const PLUGIN_DEFS: Record<PluginType, { label: string; blurb: string; params: PluginParamDef[] }> = {
  chorus: {
    label: 'Chorus',
    blurb: 'Thickens a voice or instrument with a modulated double.',
    params: [
      { key: 'rate', label: 'Rate', min: 0.1, max: 3, step: 0.1, def: 0.9, unit: 'Hz' },
      { key: 'depth', label: 'Depth', min: 0, max: 10, step: 0.5, def: 4, unit: 'ms' },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05, def: 0.5 },
    ],
  },
  autopan: {
    label: 'Auto-Pan',
    blurb: 'Sweeps the sound across the stereo field over time.',
    params: [
      { key: 'rate', label: 'Rate', min: 0.05, max: 2, step: 0.05, def: 0.4, unit: 'Hz' },
      { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.05, def: 0.8 },
    ],
  },
  delay: {
    label: 'Delay',
    blurb: 'Echoes with feedback — space and repeats.',
    params: [
      { key: 'time', label: 'Time', min: 0.05, max: 1, step: 0.01, def: 0.35, unit: 's' },
      { key: 'feedback', label: 'Feedback', min: 0, max: 0.85, step: 0.05, def: 0.35 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05, def: 0.4 },
    ],
  },
  reverb: {
    label: 'Reverb',
    blurb: 'Convolution reverb with a generated impulse — hall to room.',
    params: [
      { key: 'decay', label: 'Decay', min: 0.3, max: 4, step: 0.1, def: 1.8, unit: 's' },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05, def: 0.35 },
    ],
  },
};

export const PLUGIN_ORDER: PluginType[] = ['chorus', 'autopan', 'delay', 'reverb'];

export function createPluginInstance(type: PluginType, preset?: Record<string, number>): PluginInstance {
  const params: Record<string, number> = {};
  for (const p of PLUGIN_DEFS[type].params) params[p.key] = preset?.[p.key] ?? p.def;
  return { id: `fx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, enabled: true, params };
}

/** Generated stereo impulse response: noise burst with exponential decay. */
function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay * 2);
    }
  }
  return buf;
}

interface BuiltPlugin {
  input: AudioNode;
  output: AudioNode;
  nodes: AudioNode[];
}

function buildChorus(ctx: BaseAudioContext, p: Record<string, number>): BuiltPlugin {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(0.05);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  dry.gain.value = 1 - p.mix * 0.5;
  wet.gain.value = p.mix;
  delay.delayTime.value = 0.018;
  lfo.frequency.value = p.rate;
  lfoGain.gain.value = (p.depth / 1000) * 0.5;
  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);
  input.connect(dry); dry.connect(output);
  input.connect(delay); delay.connect(wet); wet.connect(output);
  lfo.start();
  return { input, output, nodes: [input, output, dry, wet, delay, lfo, lfoGain] };
}

function buildAutoPan(ctx: BaseAudioContext, p: Record<string, number>): BuiltPlugin {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const panner = ctx.createStereoPanner();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = p.rate;
  lfoGain.gain.value = p.depth;
  lfo.connect(lfoGain);
  lfoGain.connect(panner.pan);
  input.connect(panner); panner.connect(output);
  lfo.start();
  return { input, output, nodes: [input, output, panner, lfo, lfoGain] };
}

function buildDelay(ctx: BaseAudioContext, p: Record<string, number>): BuiltPlugin {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(1.2);
  const feedback = ctx.createGain();
  dry.gain.value = 1 - p.mix * 0.6;
  wet.gain.value = p.mix;
  delay.delayTime.value = p.time;
  feedback.gain.value = p.feedback;
  input.connect(dry); dry.connect(output);
  input.connect(delay);
  delay.connect(feedback); feedback.connect(delay);
  delay.connect(wet); wet.connect(output);
  return { input, output, nodes: [input, output, dry, wet, delay, feedback] };
}

function buildReverb(ctx: BaseAudioContext, p: Record<string, number>): BuiltPlugin {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const convolver = ctx.createConvolver();
  dry.gain.value = 1 - p.mix * 0.6;
  wet.gain.value = p.mix;
  convolver.buffer = makeImpulse(ctx, Math.max(0.5, p.decay * 1.5), 2.2);
  input.connect(dry); dry.connect(output);
  input.connect(convolver); convolver.connect(wet); wet.connect(output);
  return { input, output, nodes: [input, output, dry, wet, convolver] };
}

/**
 * Build an insert chain for a lane's enabled plugins, in slot order.
 * Returns the chain input/output plus every created node (for teardown)
 * and a stop() that halts the chain's LFO oscillators. With no enabled
 * plugins the input connects straight to the output.
 */
export function createEffectChain(
  ctx: BaseAudioContext,
  plugins: PluginInstance[]
): { input: AudioNode; output: AudioNode; nodes: AudioNode[]; stop: () => void } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const nodes: AudioNode[] = [input, output];
  let tail: AudioNode = input;
  for (const plugin of plugins) {
    if (!plugin.enabled) continue;
    const built =
      plugin.type === 'chorus' ? buildChorus(ctx, plugin.params)
      : plugin.type === 'autopan' ? buildAutoPan(ctx, plugin.params)
      : plugin.type === 'delay' ? buildDelay(ctx, plugin.params)
      : buildReverb(ctx, plugin.params);
    tail.connect(built.input);
    tail = built.output;
    nodes.push(...built.nodes);
  }
  tail.connect(output);
  const oscillators = nodes.filter((n): n is OscillatorNode => n instanceof OscillatorNode);
  return {
    input, output, nodes,
    stop: () => oscillators.forEach(o => { try { o.stop(); } catch { /* noop */ } }),
  };
}

/** A stable key for a lane's effect list (rebuild the chain when it changes). */
export function fxKey(plugins: PluginInstance[]): string {
  return JSON.stringify(plugins.map(p => [p.type, p.enabled, p.params]));
}

export interface PromptMatch {
  type: PluginType;
  preset: Record<string, number>;
  why: string;
}

const PROMPT_RULES: { type: PluginType; keywords: string[]; preset: Record<string, number>; why: string }[] = [
  {
    type: 'chorus',
    keywords: ['chorus', 'wide', 'widen', 'thicken', 'thick', 'shimmer', 'lush'],
    preset: { rate: 0.9, depth: 4, mix: 0.55 },
    why: 'Chorus — thickens the sound with a modulated double',
  },
  {
    type: 'autopan',
    keywords: ['pan', 'panning', 'sweep', 'sweeping', 'move', 'moving', 'swirl', 'auto-pan', 'autopan', 'side to side', 'left to right'],
    preset: { rate: 0.4, depth: 0.8 },
    why: 'Auto-Pan — sweeps the sound across the stereo field',
  },
  {
    type: 'delay',
    keywords: ['delay', 'echo', 'repeat', 'repeats', 'space', 'slap', 'slapback'],
    preset: { time: 0.35, feedback: 0.35, mix: 0.4 },
    why: 'Delay — echo with feedback',
  },
  {
    type: 'reverb',
    keywords: ['reverb', 'hall', 'room', 'cathedral', 'depth', 'ambient', 'ambience', 'wet', 'airy', 'church'],
    preset: { decay: 1.8, mix: 0.35 },
    why: 'Reverb — convolution hall, generated impulse',
  },
];

const UNSUPPORTED_HINTS: { keywords: string[]; note: string }[] = [
  {
    keywords: ['pitch', 'pitch-shift', 'pitch shift', 'transpose', 'autotune', 'auto-tune', 'harmony', 'doubling'],
    note: 'Pitch effects are not available — no pitch engine is connected.',
  },
  {
    keywords: ['de-esser', 'deesser', 'de esser', 'sibilance'],
    note: 'A de-esser is not in the effect library yet.',
  },
  {
    keywords: ['lo-fi', 'lofi', 'lo fi', 'vinyl', 'tape'],
    note: 'Lo-fi texture effects are not in the effect library yet.',
  },
];

/**
 * Match a text prompt to effect presets by keyword. Returns every matched
 * effect (at most one per type) plus notes for anything asked for that
 * cannot be built. This is preset-matching, not generated DSP.
 */
export function matchPluginsFromPrompt(prompt: string): { matches: PromptMatch[]; notes: string[] } {
  const text = prompt.toLowerCase();
  const matches: PromptMatch[] = [];
  for (const rule of PROMPT_RULES) {
    if (rule.keywords.some(k => text.includes(k))) {
      matches.push({ type: rule.type, preset: rule.preset, why: rule.why });
    }
  }
  const notes: string[] = [];
  for (const hint of UNSUPPORTED_HINTS) {
    if (hint.keywords.some(k => text.includes(k))) notes.push(hint.note);
  }
  return { matches, notes };
}
