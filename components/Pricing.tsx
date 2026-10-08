
import React from 'react';

const Pricing: React.FC = () => {
  return (
    <section className="space-y-16">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-semibold tracking-tight">Choose Your Business Plan</h2>
        <p className="text-zinc-400 text-lg">Flexible enterprise solutions for teams of all sizes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-[#1a1a1e]/40 p-8 rounded-3xl border border-white/10 hover:bg-[#1a1a1e]/60 transition-all flex flex-col">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-zinc-400 mb-2">Business Starter</h3>
            <div className="text-5xl font-black">$29<span className="text-base text-zinc-500">/mo</span></div>
            <p className="text-xs text-zinc-500 mt-2">Billed annually, per seat</p>
          </div>
          <ul className="space-y-4 mb-12 flex-grow text-sm">
            <li className="flex items-center gap-2">✅ Universal commercial license</li>
            <li className="flex items-center gap-2">✅ Unlimited asset downloads</li>
            <li className="flex items-center gap-2">✅ 100k content library access</li>
            <li className="flex items-center gap-2">✅ Basic legal indemnification</li>
            <li className="flex items-center gap-2 text-zinc-500">❌ Dedicated account manager</li>
          </ul>
          <button className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold transition-colors">Start Free Trial</button>
        </div>

        <div className="bg-gradient-to-b from-orange-500/20 to-red-600/10 p-8 rounded-3xl border-2 border-orange-500/50 relative flex flex-col scale-105 shadow-2xl shadow-black/40">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase">Most Popular</div>
          <div className="mb-8">
            <h3 className="text-xl font-bold text-orange-400 mb-2">Business Pro</h3>
            <div className="text-5xl font-black">$49<span className="text-base text-orange-400/50">/mo</span></div>
            <p className="text-xs text-orange-400/50 mt-2">Billed annually, per seat</p>
          </div>
          <ul className="space-y-4 mb-12 flex-grow text-sm">
            <li className="flex items-center gap-2">✅ Everything in Starter</li>
            <li className="flex items-center gap-2">✅ SwCafe Hub integration</li>
            <li className="flex items-center gap-2">✅ Premium LUTs & Templates</li>
            <li className="flex items-center gap-2">✅ Full vocal transformation tools</li>
            <li className="flex items-center gap-2">✅ Priority technical support</li>
          </ul>
          <button className="w-full bg-gradient-to-r from-orange-500 to-red-600 py-4 rounded-xl font-bold transition-all shadow-lg shadow-black/40">Upgrade Now</button>
        </div>

        <div className="bg-[#1a1a1e]/40 p-8 rounded-3xl border border-white/10 hover:bg-[#1a1a1e]/60 transition-all flex flex-col">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-zinc-400 mb-2">Enterprise</h3>
            <div className="text-5xl font-black">Custom</div>
            <p className="text-xs text-zinc-500 mt-2">Volume discounts available</p>
          </div>
          <ul className="space-y-4 mb-12 flex-grow text-sm">
            <li className="flex items-center gap-2">✅ Everything in Pro</li>
            <li className="flex items-center gap-2">✅ Custom API integrations</li>
            <li className="flex items-center gap-2">✅ Dedicated account manager</li>
            <li className="flex items-center gap-2">✅ Unlimited legal coverage</li>
            <li className="flex items-center gap-2">✅ 24/7 priority phone support</li>
          </ul>
          <button className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold transition-colors">Contact Sales</button>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
