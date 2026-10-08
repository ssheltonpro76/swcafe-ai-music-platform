
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import HomeView from './components/HomeView';
import StudioView from './components/StudioView';
import MusicAI from './components/MusicAI';
import VisionCafeView from './components/VisionCafeView';
import RadioView from './components/RadioView';
import VoiceModal from './components/VoiceModal';
import SongCreatorView from './components/SongCreatorView';
import AlbumCoverCreatorView from './components/AlbumCoverCreatorView';
import VideoEditorView from './components/VideoEditorView';
import StemSplitterView from './components/StemSplitterView';
import PerformanceHubView from './components/PerformanceHubView';
import ChordWheelView from './components/ChordWheelView';
import SongEditorView from './components/SongEditorView';
import RemasterView from './components/RemasterView';
import CoversView from './components/CoversView';
import LyricsChujaiView from './components/LyricsChujaiView';
import SongLibraryView from './components/SongLibraryView';
import SongListView from './components/SongListView';
import SwCafeScenesView from './components/SwCafeScenesView';
import ReplaceSectionView from './components/ReplaceSectionView';
import { ProfileView } from './components/ProfileView';
import { CarPlayView } from './components/CarPlayView';
import { VoicePersona, DEFAULT_PERSONAS } from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [personas, setPersonas] = useState<VoicePersona[]>([]);
  const [replaceContext, setReplaceContext] = useState<any>(null);
  const [creatorInitialData, setCreatorInitialData] = useState<any>(null);

  const [currentTrack, setCurrentTrack] = useState({
    title: "Cosmic Waves v4",
    artist: "SwCafe AI",
    cover: "https://picsum.photos/seed/music/200/200"
  });

  useEffect(() => {
    const saved = localStorage.getItem('voicePersonas');
    if (saved) {
      setPersonas(JSON.parse(saved));
    } else {
      setPersonas(DEFAULT_PERSONAS);
      localStorage.setItem('voicePersonas', JSON.stringify(DEFAULT_PERSONAS));
    }
  }, []);

  const savePersona = (persona: VoicePersona) => {
    setPersonas(prev => {
      const exists = prev.some(p => p.id === persona.id);
      const updated = exists 
        ? prev.map(p => p.id === persona.id ? persona : p)
        : [...prev, persona];
      localStorage.setItem('voicePersonas', JSON.stringify(updated));
      return updated;
    });
  };

  const deletePersona = (id: number) => {
    const updated = personas.filter(p => p.id !== id);
    setPersonas(updated);
    localStorage.setItem('voicePersonas', JSON.stringify(updated));
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomeView onOpenVoice={() => setIsVoiceModalOpen(true)} onNavigate={setActiveTab} />;
      case 'explore': return <HomeView onOpenVoice={() => setIsVoiceModalOpen(true)} onNavigate={setActiveTab} />;
      case 'profile': return <ProfileView onPlay={(title, artist, cover) => setCurrentTrack({ title, artist, cover })} onNavigate={setActiveTab} />;
      case 'carplay': return <CarPlayView onPlay={(title, artist, cover) => setCurrentTrack({ title, artist, cover })} />;
      case 'studio': return <StudioView onOpenVoice={() => setIsVoiceModalOpen(true)} />;
      case 'remaster': return <RemasterView />;
      case 'song-creator': return (
        <SongCreatorView 
          initialData={creatorInitialData} 
          onPlay={(title, artist, cover) => setCurrentTrack({ title, artist, cover })} 
          onOpenLyricStudio={() => setActiveTab('lyrics-studio')}
        />
      );
      case 'covers': return <CoversView />;
      case 'song-editor': return <SongEditorView />;
      case 'performance': return <PerformanceHubView />;
      case 'production-center': return <ChordWheelView />;
      case 'ai': return <MusicAI />;
      case 'vision': return <VisionCafeView />;
      case 'radio': return <RadioView />;
      case 'album-creator': return <AlbumCoverCreatorView />;
      case 'video-editor': return <VideoEditorView />;
      case 'stem-splitter': return <StemSplitterView />;
      case 'lyrics-studio':
      case 'lyrics-chujai': return (
        <LyricsChujaiView 
          onNavigate={setActiveTab} 
          onSendToCreator={(data) => {
            setCreatorInitialData(data);
            setActiveTab('song-creator');
          }}
        />
      );
      case 'song-list': return <SongListView />;
      case 'hooks': return <StemSplitterView />;
      case 'notifications': return (
        <div className="max-w-2xl mx-auto space-y-6 text-left p-6 bg-[#131316] border border-white/5 rounded-3xl animate-in fade-in">
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <h2 className="text-xl font-semibold tracking-tight text-white font-sans flex items-center gap-2">
              <span>🔔</span> Station Notifications
            </h2>
            <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-bold font-mono">3 Alerts</span>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-[#1a1a1e] rounded-2xl border border-white/5">
              <p className="text-xs font-semibold text-white tracking-tight mb-1">🔥 Neural Core v5.5 Calibrated</p>
              <p className="text-[11px] text-zinc-400 font-sans leading-normal">SwCafe neural vocoding layers have completed fine-tuning matching stephenshelton acoustic profiles. Stems latency reduced to 12ms.</p>
            </div>
            <div className="p-4 bg-[#1a1a1e] rounded-2xl border border-white/5">
              <p className="text-xs font-semibold text-white tracking-tight mb-1">🎉 Custom Model Lab Activated</p>
              <p className="text-[11px] text-zinc-400 font-sans leading-normal">Your custom v5.5 engine training path is unlocked! Vault 6 or more tracks to begin training personalized parameters matching your signature sound.</p>
            </div>
            <div className="p-4 bg-[#1a1a1e] rounded-2xl border border-white/5">
              <p className="text-xs font-semibold text-white tracking-tight mb-1">🎙️ Vocal Persona Synced</p>
              <p className="text-[11px] text-zinc-400 font-sans leading-normal">CoPilot voice models (Duo & Solo) are calibrated natively. Launch Vocal Lab from your bottom widget tray.</p>
            </div>
          </div>
        </div>
      );
      case 'library': return (
        <SongLibraryView 
          onReplaceSection={(song) => {
            setReplaceContext(song);
            setActiveTab('replace-section');
          }} 
        />
      );
      case 'scenes': return <SwCafeScenesView />;
      case 'replace-section': return replaceContext ? (
        <ReplaceSectionView 
          song={replaceContext} 
          onCancel={() => {
            setReplaceContext(null);
            setActiveTab('library');
          }}
          onConfirm={(finalData) => {
            setCreatorInitialData(finalData);
            setReplaceContext(null);
            setActiveTab('song-creator');
          }}
        />
      ) : null;
      default: return <HomeView onOpenVoice={() => setIsVoiceModalOpen(true)} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-white overflow-hidden font-['Inter']">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onOpenVoice={() => setIsVoiceModalOpen(true)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 bg-[#0a0a0b]/80 backdrop-blur-md border-b border-white/5 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-500">
              {activeTab === 'home' ? 'Discover' : activeTab.replace('-', ' ').toUpperCase()}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-1.5 rounded-full text-xs font-semibold text-zinc-300 transition-all">
              Enterprise v4
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-red-600 shadow-[0_0_15px_rgba(249,115,22,0.3)]"></div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-32">
          {renderContent()}
        </main>
      </div>

      <Player track={currentTrack} />

      <VoiceModal 
        isOpen={isVoiceModalOpen} 
        onClose={() => setIsVoiceModalOpen(false)}
        savedPersonas={personas}
        onSave={savePersona}
        onDelete={deletePersona}
      />
    </div>
  );
};

export default App;
