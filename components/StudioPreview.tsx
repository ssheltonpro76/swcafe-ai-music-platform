
import React from 'react';

interface StudioPreviewProps {
  onLaunch: () => void;
}

const StudioPreview: React.FC<StudioPreviewProps> = ({ onLaunch }) => {
  return (
    <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-[3rem] p-8 md:p-16 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-48 -mt-48"></div>
      
      <div className="relative z-10 text-center space-y-8">
        <div className="inline-block px-4 py-1.5 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">
          Available for Premier Subscribers
        </div>
        <h2 className="text-4xl md:text-7xl font-semibold tracking-tight italic">SwCafe Studio</h2>
        <p className="text-xl md:text-2xl font-medium opacity-90 max-w-3xl mx-auto">
          The first-ever generative audio workstation. The creative workspace you’ve been waiting for: built for real experimentation, fast iteration, and pure fun.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 hover:bg-white/15 transition-all">
            <h4 className="text-xl font-bold mb-3 flex items-center gap-2"><span>📂</span> Start with Any Audio</h4>
            <p className="text-zinc-100/70 text-sm">Upload samples, pull from your library, or break things down into stems using neural deconstruction.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 hover:bg-white/15 transition-all">
            <h4 className="text-xl font-bold mb-3 flex items-center gap-2"><span>🔄</span> Infinite Stem Variations</h4>
            <p className="text-zinc-100/70 text-sm">Instantly generate vocals, drums, synths, and more that flow with your audio in perfect sync.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 hover:bg-white/15 transition-all">
            <h4 className="text-xl font-bold mb-3 flex items-center gap-2"><span>⏱️</span> Multitrack Timeline</h4>
            <p className="text-zinc-100/70 text-sm">Arrange, layer, and refine with precision. Control BPM, volume, pitch, and more across every track.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 hover:bg-white/15 transition-all">
            <h4 className="text-xl font-bold mb-3 flex items-center gap-2"><span>💾</span> Export Everything</h4>
            <p className="text-zinc-100/70 text-sm">Send stems out as high-quality audio or MIDI and pick up right where you left off in your primary DAW.</p>
          </div>
        </div>

        <button 
          onClick={onLaunch}
          className="bg-white text-indigo-600 px-16 py-6 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-2xl active:scale-95"
        >
          Launch Studio Workstation
        </button>
      </div>
    </section>
  );
};

export default StudioPreview;
