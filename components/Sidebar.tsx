
import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenVoice: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onOpenVoice }) => {
  const primaryNav = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'explore', label: 'Explore', icon: '🔍' },
    { id: 'song-creator', label: 'Create', icon: '✨', badge: 'v5.5' },
    { id: 'lyrics-studio', label: 'Lyric Studio', icon: '✍️', badge: 'AI' },
    { id: 'studio', label: 'Studio', icon: '🎹' },
    { id: 'library', label: 'Library', icon: '📁' },
    { id: 'hooks', label: 'Hooks', icon: '🪝' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
  ];

  const advancedNav = [
    { id: 'carplay', label: 'CarPlay Mode', icon: '🚗' },
    { id: 'scenes', label: 'Scenes Studio', icon: '🖼️' },
    { id: 'covers', label: 'Cover Remixes', icon: '💿' },
    { id: 'remaster', label: 'AI Remaster', icon: '🪄' },
    { id: 'song-editor', label: 'Song Editor', icon: '✂️' },
    { id: 'production-center', label: 'Chord Studio', icon: '🎛️' },
    { id: 'vision', label: 'Vision Cafe', icon: '🎬' },
    { id: 'video-editor', label: 'Video Editor', icon: '🎥' },
    { id: 'album-creator', label: 'Album Art', icon: '🎨' },
    { id: 'ai', label: 'Producer AI', icon: '🧠' },
  ];

  return (
    <aside className="w-[230px] bg-[#0a0a0b] border-r border-white/5 flex flex-col h-full text-zinc-300">
      <div className="p-4 flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="flex justify-between items-center mb-5 px-2 select-none">
          <div 
            onClick={() => setActiveTab('home')} 
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <h1 className="text-xl font-extrabold tracking-[0.14em] text-white uppercase font-sans">SWCAFE</h1>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
          </div>
          <button className="h-6 w-6 rounded-md hover:bg-zinc-800/60 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <span className="text-xs font-bold font-mono">⟨</span>
          </button>
        </div>

        {/* Professional User Profile Card */}
        <div className="mb-6 mx-1 bg-[#1a1a1e]/60 hover:bg-[#1a1a1e] border border-white/5 rounded-2xl p-3 flex items-center gap-3 transition-colors cursor-pointer group">
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-orange-500 to-red-600 p-[2px]">
            <img 
              src="https://picsum.photos/seed/stephenshelton/100/100" 
              alt="Avatar" 
              className="h-full w-full rounded-full object-cover border border-black/80" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-black text-white truncate my-0">stephenshelton</p>
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider my-0">Premier</p>
          </div>
          <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">▾</span>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-1 mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2 px-3">Generate</p>
          {primaryNav.map(item => (
            <button
               key={item.id}
               onClick={() => setActiveTab(item.id)}
               className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                 activeTab === item.id 
                   ? 'bg-white/10 text-white font-semibold border border-white/5' 
                   : 'text-zinc-400 hover:text-white hover:bg-white/5'
               }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg opacity-90">{item.icon}</span>
                <span className="text-sm tracking-tight">{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                  item.badge === 'v5.5' 
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white' 
                    : 'bg-white/10 text-zinc-300 border border-white/10'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable Advanced Tools Menu */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1 -mx-2 px-2 border-t border-white/5 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3 px-1">Studio Tools</p>
          {advancedNav.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-2 py-2 rounded-lg transition-all ${
                activeTab === item.id 
                  ? 'bg-white/10 text-white font-semibold border border-white/5' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base opacity-80">{item.icon}</span>
                <span className="text-xs font-semibold tracking-tight">{item.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Voice Personality Action */}
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 px-1">Studio Custom Sound</p>
          <button 
            onClick={onOpenVoice}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2.5 rounded-full shadow-lg shadow-black/40 hover:opacity-90 active:scale-[0.99] transition-all text-[10px] uppercase tracking-widest"
          >
            🎙️ Vocal Lab
          </button>
        </div>
      </div>
      
      {/* SwCafe Credits & Storage Module */}
      <div className="p-6 border-t border-white/5 bg-[#0a0a0b]">
        <div className="bg-[#131316] rounded-xl p-3.5 border border-white/5 space-y-2">
          <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400 uppercase">
            <span>Daily Credits</span>
            <span className="text-orange-400 font-bold flex items-center gap-1">🪙 250 / 250</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-red-600 w-full rounded-full"></div>
          </div>
          <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Renewing in 9 hours</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
