
import React from 'react';

interface HeroProps {
  onOpenVoiceConfig: () => void;
}

const Hero: React.FC<HeroProps> = ({ onOpenVoiceConfig }) => {
  return (
    <div className="relative rounded-3xl overflow-hidden bg-[#131316] border border-white/5 p-8 md:p-16 text-white mt-8">
      {/* Subtle top glow */}
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-orange-600/15 to-transparent pointer-events-none"></div>
      {/* Decorative Grid */}
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="flex-1 space-y-8">
          <div className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider">
            Enterprise Audio Solution
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
            Create unlimited projects with one universal license
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 opacity-90 leading-relaxed max-w-2xl">
            Distribute content across any platform worldwide and protect your business with built-in indemnification coverage. Professional music creation tools designed for enterprise success.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={onOpenVoiceConfig}
              className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-xl"
            >
              Start Free Trial
            </button>
            <button className="bg-white/5 backdrop-blur-sm border border-white/10 px-8 py-4 rounded-full font-bold text-lg hover:bg-white/10 transition-all">
              View Enterprise Pricing
            </button>
          </div>
        </div>

        <div className="w-full md:w-auto flex flex-col items-center md:items-end gap-2">
          <span className="text-zinc-500 text-sm font-medium">Trusted by</span>
          <div className="text-5xl md:text-7xl font-bold tabular-nums tracking-tight">10,000+</div>
          <span className="text-xl font-bold">Businesses Worldwide</span>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-white/20 border border-white/40 overflow-hidden">
                <img src={`https://picsum.photos/seed/${i + 50}/64/64`} alt="User" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
