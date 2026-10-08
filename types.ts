
// Global declaration for the aistudio platform API to ensure consistent typing across views
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // aistudio is often defined as optional in the global environment; making it optional here
    // ensures identical modifiers across all declarations.
    aistudio?: AIStudio;
  }
}

export enum VocalRegister {
  FRY_M0 = 'vocal fry (M0)',
  MODAL_M1 = 'modal/chest (M1)',
  HEAD_M2 = 'head/thin folds (M2)',
  FALSETTO_M3 = 'falsetto (M3)',
  MIX = 'mix voice'
}

export enum VocalStyle {
  SMOOTH = 'smooth',
  DEEP = 'deep',
  WARM = 'warm',
  ENERGETIC = 'energetic',
  GRITTY = 'gritty',
  RASPY = 'raspy',
  AIRY = 'airy',
  AUTHORITATIVE = 'authoritative',
  WHISPER = 'whisper',
  NARRATOR = 'narrator',
  CARTOON = 'cartoon'
}

export enum VocalType {
  SOPRANO = 'soprano',
  MEZZO_SOPRANO = 'mezzo-soprano',
  CONTRALTO = 'contralto',
  COUNTERTENOR = 'countertenor',
  TENOR = 'tenor',
  BARITONE = 'baritone',
  BASS = 'bass'
}

export enum VocalSubType {
  STANDARD = 'standard',
  DRAMATIC = 'dramatic',
  LYRIC = 'lyric',
  COLORATURA = 'coloratura',
  BASSO_PROFONDO = 'basso profondo'
}

export enum VoiceGender {
  MALE = 'male',
  FEMALE = 'female',
  MIXED = 'mixed'
}

export enum PersonaCategory {
  MUSIC = 'music',
  STORYTELLING = 'storytelling',
  ANIMATION = 'animation',
  COMMERCIAL = 'commercial',
  PODCAST = 'podcast',
  GAME = 'game',
  CUSTOM = 'custom'
}

export interface VoiceSettings {
  id: number;
  register: VocalRegister;
  style: string;
  type: VocalType;
  subType: VocalSubType;
  pitch: number;
  tone: number;
  characterStrength: number;
}

export interface VoicePersona {
  id: number;
  name: string;
  category: PersonaCategory;
  gender: VoiceGender;
  voiceCount: number;
  spacing: 'tight' | 'balanced' | 'wide';
  voices: VoiceSettings[];
  isVocalFirst: boolean;
  createdAt: string;
}

export interface AIResponse {
  text: string;
  suggestions?: string[];
}
