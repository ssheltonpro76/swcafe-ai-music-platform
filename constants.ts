
import { VoiceGender, PersonaCategory, VocalStyle, VocalType, VocalSubType, VoicePersona, VocalRegister } from './types';

export const AI_GENERATORS = [
  "Male LoFi EDM", "Female Soul Revival", "Female Telephone Filter", "Male Telephone Filter",
  "Male Caribbean Dancehall", "Male Midnight Crooner", "Female Honey Soul", "Female Latin Folk",
  "Male Swagger Rap", "Latino Male Ballad", "Dramatic Female Spanish", "Modern Pop Diva",
  "Female Spanish Folk", "Fiery Spanish Female", "Female Modern Jazz", "Female Overdrive Rock",
  "Heartfelt Spanish Female", "Spanish Male Modern Pop", "Modern Male Hip-Hop", "Male R&B Royale",
  "Female R&B Diva", "Male 2000s Rock", "Breathy Male Soul", "Female Gritty Pop",
  "Female Pop EDM", "Tender Male Spanish", "Female Session Singer", "Latin Male Traditional",
  "Female Mellow Pop", "Male 2000s R&B", "Male Modern Soul", "Male Afrofusion",
  "Female French Folk", "Male Dirty Rock", "Male Relaxed Rap", "Female Contemporary Worship",
  "Male Bollywood Pop", "Male Afro Dub", "Female Bollywood Pop", "Female Chill R&B"
];

export const DEFAULT_PERSONAS: VoicePersona[] = [
  {
    id: 1,
    name: "Modern Pop Diva",
    category: PersonaCategory.MUSIC,
    gender: VoiceGender.FEMALE,
    voiceCount: 1,
    spacing: 'balanced',
    isVocalFirst: true,
    voices: [{ 
      id: 1, 
      register: VocalRegister.HEAD_M2,
      style: VocalStyle.SMOOTH, 
      type: VocalType.SOPRANO, 
      subType: VocalSubType.COLORATURA, 
      pitch: 60, 
      tone: 70, 
      characterStrength: 80 
    }],
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: "Midnight Crooner",
    category: PersonaCategory.MUSIC,
    gender: VoiceGender.MALE,
    voiceCount: 1,
    spacing: 'balanced',
    isVocalFirst: true,
    voices: [{ 
      id: 2, 
      register: VocalRegister.MODAL_M1,
      style: VocalStyle.DEEP, 
      type: VocalType.BARITONE, 
      subType: VocalSubType.LYRIC, 
      pitch: 40, 
      tone: 40, 
      characterStrength: 60 
    }],
    createdAt: new Date().toISOString()
  }
];

export type { VoicePersona };
