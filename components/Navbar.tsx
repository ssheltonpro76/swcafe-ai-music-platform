
import React from 'react';

interface NavbarProps {
  onNavigate: (tab: 'home' | 'studio' | 'ai') => void;
  activeTab: 'home' | 'studio' | 'ai';
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, activeTab }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => onNavigate('home')}
        >
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-xl group-hover:rotate-12 transition-transform">S</div>
          <span className="text-2xl font-black tracking-tighter">SwCafe<span className="text-emerald-500">Business</span></span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-semibold">
          <button 
            onClick={() => onNavigate('home')}
            className={`${activeTab === 'home' ? 'text-emerald-500' : 'text-slate-400 hover:text-white'} transition-colors`}
          >
            PLATFORM
          </button>
          <button 
            onClick={() => onNavigate('studio')}
            className={`${activeTab === 'studio' ? 'text-emerald-500' : 'text-slate-400 hover:text-white'} transition-colors`}
          >
            STUDIO
          </button>
          <button 
            onClick={() => onNavigate('ai')}
            className={`${activeTab === 'ai' ? 'text-emerald-500' : 'text-slate-400 hover:text-white'} transition-colors`}
          >
            PRODUCER AI
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button className="hidden sm:block text-sm font-bold text-slate-400 hover:text-white px-4 py-2 transition-colors">Log In</button>
          <button className="bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20">
            Start Free
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
