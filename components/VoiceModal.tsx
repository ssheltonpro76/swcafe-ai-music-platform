import React, { useState } from 'react';
import { VoiceGender, VoicePersona, PersonaCategory, VocalStyle, VoiceSettings, VocalType, VocalSubType, VocalRegister } from '../types';
import { AI_GENERATORS } from '../constants';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedPersonas: VoicePersona[];
  onSave: (persona: VoicePersona) => void;
  onDelete: (id: number) => void;
}

const VoiceModal: React.FC<VoiceModalProps> = ({ isOpen, onClose, savedPersonas, onSave, onDelete }) => {
  const [activeView, setActiveView] = useState<'blueprint' | 'library'>('library');
  const [gender, setGender] = useState<VoiceGender>(VoiceGender.MALE);
  const [voiceCount, setVoiceCount] = useState(1);
  const [spacing, setSpacing] = useState<'tight' | 'balanced' | 'wide'>('balanced');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PersonaCategory>(PersonaCategory.MUSIC);
  const [isVocalFirst, setIsVocalFirst] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [voices, setVoices] = useState<VoiceSettings[]>([
    { id: 1, register: VocalRegister.MODAL_M1, style: VocalStyle.SMOOTH, type: VocalType.BARITONE, subType: VocalSubType.STANDARD, pitch: 50, tone: 50, characterStrength: 50 }
  ]);

  const handleAddVoice = () => {
    if (voices.length >= 6) return;
    const newId = Date.now();
    const newVoice: VoiceSettings = {
      id: newId,
      register: VocalRegister.MODAL_M1,
      style: VocalStyle.SMOOTH,
      type: gender === VoiceGender.FEMALE ? VocalType.SOPRANO : VocalType.TENOR,
      subType: VocalSubType.STANDARD,
      pitch: 50,
      tone: 50,
      characterStrength: 50
    };
    setVoices([...voices, newVoice]);
    setVoiceCount(voices.length + 1);
  };

  const handleRemoveVoice = (id: number) => {
    if (voices.length <= 1) return;
    const updated = voices.filter(v => v.id !== id);
    setVoices(updated);
    setVoiceCount(updated.length);
  };

  const updateVoiceParam = (id: number, param: keyof VoiceSettings, value: any) => {
    setVoices(voices.map(v => v.id === id ? { ...v, [param]: value } : v));
  };

  const resetDesigner = () => {
    setEditingId(null);
    setName('');
    setGender(VoiceGender.MALE);
    setVoiceCount(1);
    setSpacing('balanced');
    setCategory(PersonaCategory.MUSIC);
    setIsVocalFirst(true);
    setVoices([
      { id: 1, register: VocalRegister.MODAL_M1, style: VocalStyle.SMOOTH, type: VocalType.BARITONE, subType: VocalSubType.STANDARD, pitch: 50, tone: 50, characterStrength: 50 }
    ]);
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return alert('Please enter a name for this identity.');
    
    const personaToSave: VoicePersona = {
      id: editingId || Date.now(),
      name: name.trim(),
      category,
      gender,
      voiceCount,
      spacing,
      voices: [...voices],
      isVocalFirst,
      createdAt: new Date().toISOString()
    };
    
    onSave(personaToSave);
    alert(editingId ? 'Identity Updated' : 'New Identity Archived');
    setEditingId(null);
    setName('');
    setActiveView('library');
  };

  const loadPersona = (p: VoicePersona) => {
    setEditingId(p.id);
    setGender(p.gender);
    setVoiceCount(p.voiceCount);
    setSpacing(p.spacing);
    setName(p.name);
    setCategory(p.category);
    setVoices([...p.voices]);
    setIsVocalFirst(p.isVocalFirst ?? true);
    setActiveView('blueprint');
  };

  const handleGeneratorClick = (genName: string) => {
    const isFemale = genName.toLowerCase().includes('female');
    setEditingId(null);
    setGender(isFemale ? VoiceGender.FEMALE : VoiceGender.MALE);
    setName(genName);
    setVoiceCount(1);
    setVoices([{
      id: Date.now(),
      register: VocalRegister.MODAL_M1,
      style: genName.includes('Deep') ? VocalStyle.DEEP : VocalStyle.SMOOTH,
      type: isFemale ? VocalType.SOPRANO : VocalType.BARITONE,
      subType: VocalSubType.STANDARD,
      pitch: 50,
      tone: 50,
      characterStrength: 60
    }]);
    setActiveView('blueprint');
  };

  const getFilteredTypes = (currentGender: VoiceGender) => {
    const femaleTypes = [VocalType.SOPRANO, VocalType.MEZZO_SOPRANO, VocalType.CONTRALTO];
    const maleTypes = [VocalType.COUNTERTENOR, VocalType.TENOR, VocalType.BARITONE, VocalType.BASS];
    if (currentGender === VoiceGender.FEMALE) return femaleTypes;
    if (currentGender === VoiceGender.MALE) return maleTypes;
    return [...femaleTypes, ...maleTypes];
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0f0f0f] w-full max-w-6xl max-h-[95vh] rounded-[2.5rem] overflow-hidden flex flex-col border border-white/5 shadow-2xl">
        <header className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
          <div className="flex items-center gap-8">
            <div className="space-y-1">
                <h2 className="text-2xl font-black flex items-center gap-3">
                  <span className="text-4xl">🎙️</span> Vocal Identity Lab
                </h2>
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em]">Neural Personality Designer</p>
            </div>
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                <button 
                    onClick={() => {
                        if (activeView === 'library') resetDesigner();
                        setActiveView('blueprint');
                    }}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'blueprint' ? 'bg-[#FF6B6B] text-black shadow-lg shadow-[#FF6B6B]/20' : 'text-slate-500 hover:text-white'}`}
                >
                    {editingId ? 'Edit Identity' : 'Identity Designer'}
                </button>
                <button 
                    onClick={() => setActiveView('library')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'library' ? 'bg-[#FF6B6B] text-black shadow-lg shadow-[#FF6B6B]/20' : 'text-slate-500 hover:text-white'}`}
                >
                    Cloud Stems
                </button>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-3 rounded-full hover:rotate-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="flex-grow overflow-y-auto p-10 custom-scrollbar">
          {activeView === 'blueprint' ? (
              <div className="space-y-12 animate-in slide-in-from-right-4 duration-300">
                {editingId && (
                  <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Archived Identity Loaded: <span className="text-white ml-2">ID_{editingId}</span></p>
                    <button onClick={resetDesigner} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Discard Changes & New</button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-4 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gender Profile</label>
                        <div className="flex gap-2">
                            {[VoiceGender.MALE, VoiceGender.FEMALE, VoiceGender.MIXED].map(g => (
                            <button
                                key={g}
                                onClick={() => setGender(g)}
                                className={`flex-1 py-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2
                                ${gender === g ? 'border-[#FF6B6B] bg-[#FF6B6B]/10 text-[#FF6B6B]' : 'border-white/5 bg-black/20 hover:border-white/10'}`}
                            >
                                <span className="text-2xl">{g === VoiceGender.MALE ? '♂️' : g === VoiceGender.FEMALE ? '♀️' : '⚥'}</span>
                                <span className="text-[9px] font-black capitalize tracking-tighter">{g}</span>
                            </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ensemble Size</label>
                        <div className="flex items-center justify-between bg-black/40 rounded-2xl p-4 border border-white/5 h-[84px]">
                            <button onClick={() => handleRemoveVoice(voices[voices.length-1].id)} className="w-12 h-12 bg-white/5 rounded-xl hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-xl font-black" disabled={voiceCount <= 1}>-</button>
                            <div className="text-center">
                            <div className="text-3xl font-black leading-none">{voiceCount}</div>
                            <div className="text-[9px] text-slate-500 font-black uppercase mt-1 tracking-widest">
                                {voiceCount === 1 ? 'Solo' : voiceCount === 2 ? 'Duo' : voiceCount === 3 ? 'Trio' : 'Ensemble'}
                            </div>
                            </div>
                            <button onClick={handleAddVoice} className="w-12 h-12 bg-white/5 rounded-xl hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-xl font-black" disabled={voiceCount >= 6}>+</button>
                        </div>
                    </div>

                    <div className="space-y-4 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sonic Spacing</label>
                        <div className="flex gap-2 h-[84px]">
                            {(['tight', 'balanced', 'wide'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSpacing(s)}
                                className={`flex-1 rounded-2xl border-2 transition-all text-[9px] font-black uppercase tracking-widest
                                ${spacing === s ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-white/5 bg-black/20 hover:border-white/10'}`}
                            >
                                {s}
                            </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {voices.map((v, i) => (
                        <div key={v.id} className="bg-white/5 rounded-[2.5rem] p-8 border border-white/5 space-y-8 relative group overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                <span className="text-9xl font-black">0{i+1}</span>
                            </div>
                            <div className="flex items-center justify-between relative z-10">
                                <span className="bg-[#FF6B6B]/20 text-[#FF6B6B] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Module {i+1}
                                </span>
                                {voiceCount > 1 && (
                                <button onClick={() => handleRemoveVoice(v.id)} className="text-red-500 hover:text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">Remove</button>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6 relative z-10">
                                <div className="space-y-4 col-span-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Vocal Register (M0-M3)</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {Object.values(VocalRegister).map(reg => (
                                            <button
                                                key={reg}
                                                onClick={() => updateVoiceParam(v.id, 'register', reg)}
                                                className={`py-3 rounded-xl text-[8px] font-black border transition-all flex flex-col items-center justify-center gap-1
                                                ${v.register === reg ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'border-white/5 bg-black/20 text-slate-500 hover:border-white/10'}`}
                                            >
                                                <span className="text-xs">{reg.includes('M0') ? '🌑' : reg.includes('M1') ? '🌕' : reg.includes('M2') ? '🌤️' : reg.includes('M3') ? '🌬️' : '🌊'}</span>
                                                <span className="uppercase tracking-tighter">{reg.split('(')[0].trim()}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Classification</label>
                                    <select 
                                        value={v.type}
                                        onChange={(e) => updateVoiceParam(v.id, 'type', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FF6B6B] appearance-none"
                                    >
                                        {getFilteredTypes(gender).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Timbre Sub-type</label>
                                    <select 
                                        value={v.subType}
                                        onChange={(e) => updateVoiceParam(v.id, 'subType', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FF6B6B] appearance-none"
                                    >
                                        {Object.values(VocalSubType).map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Style Expression Prompt</label>
                                    <input 
                                        type="text" 
                                        value={v.style}
                                        onChange={(e) => updateVoiceParam(v.id, 'style', e.target.value)}
                                        placeholder="e.g. warm vintage, heavy grit, auto-tuned..."
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-bold focus:ring-2 focus:ring-[#FF6B6B] outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6 pt-6 border-t border-white/5 relative z-10">
                                {['pitch', 'tone', 'characterStrength'].map(param => (
                                   <div key={param} className="space-y-2">
                                      <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                        <span>{param.replace('characterStrength', 'Strength')}</span>
                                        <span className="text-[#FFE66D] tabular-nums">{(v as any)[param]}%</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        value={(v as any)[param]} 
                                        onChange={(e) => updateVoiceParam(v.id, param as any, parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-black rounded-full appearance-none accent-[#FF6B6B] cursor-pointer"
                                      />
                                   </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-gradient-to-r from-indigo-900/40 to-black p-10 rounded-[3rem] border border-white/5 flex flex-col md:flex-row gap-10 items-end shadow-2xl">
                    <div className="flex-grow space-y-8">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-[#FF6B6B] uppercase tracking-[0.4em]">{editingId ? 'Update Archived Identity' : 'Archive New Identity'}</label>
                            <div className="flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Engine Profile</span>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => setIsVocalFirst(true)}
                                        className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all ${isVocalFirst ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        Vocal-First
                                    </button>
                                    <button 
                                        onClick={() => setIsVocalFirst(false)}
                                        className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all ${!isVocalFirst ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        Style (Legacy)
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity Name</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Velvet Soul - Soprano" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6B6B] outline-none placeholder:text-slate-700"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                              <select 
                                value={category}
                                onChange={(e) => setCategory(e.target.value as PersonaCategory)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6B6B] outline-none appearance-none"
                              >
                              {Object.values(PersonaCategory).map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                              </select>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSave} className="bg-white text-black px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl hover:scale-105 active:scale-95">
                      {editingId ? 'Save Updates' : 'Commit Identity'}
                    </button>
                </div>
              </div>
          ) : (
              <div className="animate-in slide-in-from-left-4 duration-300 space-y-16">
                  <section className="space-y-10">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-xl font-black uppercase tracking-widest text-white">Cloud Archetypes</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Base models for new generations</p>
                        </div>
                        <span className="text-[10px] font-black text-[#FF6B6B] bg-[#FF6B6B]/10 px-3 py-1 rounded-full">{AI_GENERATORS.length} CLOUD MODELS</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {AI_GENERATORS.map(gen => (
                              <button 
                                key={gen}
                                onClick={() => handleGeneratorClick(gen)}
                                className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#FF6B6B]/30 p-6 rounded-[2rem] transition-all text-left space-y-3 group relative overflow-hidden"
                              >
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-inner ${gen.includes('Female') ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                      {gen.includes('Female') ? '♀' : '♂'}
                                  </div>
                                  <div className="text-[11px] font-black leading-tight group-hover:text-[#FF6B6B] transition-colors uppercase tracking-tight">{gen}</div>
                              </button>
                          ))}
                      </div>
                  </section>

                  <section className="space-y-8">
                      <h3 className="text-xl font-black uppercase tracking-widest text-slate-300">Archive Library</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {savedPersonas.length === 0 ? (
                            <div className="col-span-full py-16 text-center text-slate-500 border-2 border-dashed border-white/5 rounded-[2rem] bg-white/[0.02]">
                                Archive empty. Use the Identity Designer to create custom vocalists.
                            </div>
                            ) : (
                            savedPersonas.map(p => (
                                <div key={p.id} className="bg-[#181818] p-6 rounded-[2.5rem] border border-white/5 flex flex-col gap-6 group hover:border-[#FF6B6B]/30 transition-all shadow-xl">
                                    <div className="flex-grow space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-black text-white">{p.name}</div>
                                            {p.isVocalFirst && <span className="text-[7px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-black uppercase">Vocal-First</span>}
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest space-y-1">
                                          <div>
                                            {p.voiceCount > 1 ? `${p.voiceCount}-Voice Layer` : 'Soloist'} • {p.spacing} Spacing
                                          </div>
                                          <div className="text-white/40 border-t border-white/5 pt-1 mt-1">
                                            {p.voices[0]?.register.split('(')[0]} • {p.voices[0]?.type} • {p.voices[0]?.style}
                                          </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t border-white/10">
                                        <button 
                                            onClick={() => loadPersona(p)} 
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest py-3 rounded-xl transition-all"
                                        >
                                            Edit Identity
                                        </button>
                                        <button 
                                            onClick={() => { if (confirm(`Archive removal: Delete ${p.name}?`)) onDelete(p.id); }} 
                                            className="px-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white text-[10px] rounded-xl transition-all"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                      </div>
                  </section>
              </div>
          )}
        </div>

        <footer className="p-8 border-t border-white/5 flex flex-col gap-6 bg-white/5 shrink-0">
          <div className="flex gap-4">
            <button onClick={onClose} className="px-10 bg-black/40 hover:bg-black/60 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Dismiss</button>
            <button 
              onClick={() => {
                alert('Vocal mapping complete. Ready for generation.');
                onClose();
              }}
              className="flex-grow bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:opacity-90 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-emerald-500/20 active:scale-95"
            >
              Sync Current Identity to Session
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default VoiceModal;
