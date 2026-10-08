
import React from 'react';

const RadioView: React.FC = () => {
  const stations = [
    { name: 'Lo-Fi Chill Hop', genre: 'Study / Relax', listeners: '1.2k', color: 'from-blue-500 to-indigo-600' },
    { name: 'Techno Pulse', genre: 'Industrial / Dark', listeners: '850', color: 'from-purple-600 to-pink-600' },
    { name: 'Organic Folk', genre: 'Acoustic / Nature', listeners: '2.3k', color: 'from-emerald-500 to-teal-500' },
    { name: '80s Synth Retro', genre: 'Retrowave / Pop', listeners: '1.1k', color: 'from-orange-500 to-red-600' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <header className="space-y-4">
        <h2 className="text-4xl font-semibold tracking-tight">Radio Stations</h2>
        <p className="text-zinc-400">Curated AI streams broadcast 24/7 for every mood and environment.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {stations.map(station => (
          <div key={station.name} className="relative h-64 rounded-3xl overflow-hidden group cursor-pointer border border-white/5">
            <div className={`absolute inset-0 bg-gradient-to-br ${station.color} opacity-40 group-hover:scale-110 transition-transform duration-1000`}></div>
            <div className="absolute inset-0 bg-[#0a0a0b]/60"></div>
            <div className="absolute inset-0 p-8 flex flex-col justify-between">
              <div>
                <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/10">
                   LIVE STATION
                </span>
                <h3 className="text-3xl font-semibold tracking-tight mt-4">{station.name}</h3>
                <p className="text-zinc-300 font-bold uppercase text-xs tracking-tighter mt-1">{station.genre}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="equalizer">
                      <div className="equalizer-bar"></div>
                      <div className="equalizer-bar" style={{ animationDelay: '0.2s' }}></div>
                      <div className="equalizer-bar" style={{ animationDelay: '0.4s' }}></div>
                   </div>
                   <span className="text-[10px] font-black uppercase text-zinc-400">{station.listeners} Tuned In</span>
                </div>
                <button className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-xl">▶</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RadioView;
