
import React from 'react';

const Pricing: React.FC = () => {
  return (
    <section className="space-y-16">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black">Choose Your Business Plan</h2>
        <p className="text-slate-400 text-lg">Flexible enterprise solutions for teams of all sizes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-slate-800/40 p-8 rounded-3xl border border-white/10 hover:bg-slate-800/60 transition-all flex flex-col">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-400 mb-2">Business Starter</h3>
            <div className="text-5xl font-black">$29<span className="text-base text-slate-500">/mo</span></div>
            <p className="text-xs text-slate-500 mt-2">Billed annually, per seat</p>
          </div>
          <ul className="space-y-4 mb-12 flex-grow text-sm">
            <li className="flex items-center gap-2">✅ Universal commercial license</li>
            <li className="flex items-center gap-2">✅ Unlimited asset downloads</li>
            <li className="flex items-center gap-2">✅ 100k content library access</li>
            <li className="flex items-center gap-2">✅ Basic legal indemnification</li>
            <li className="flex items-center gap-2 text-slate-500">❌ Dedicated account manager</li>
          </ul>
          <button className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition-colors">Start Free Trial</button>
        </div>

        <div className="bg-gradient-to-b from-emerald-600/20 to-teal-600/10 p-8 rounded-3xl border-2 border-emerald-500/50 relative flex flex-col scale-105 shadow-2xl shadow-emerald-500/10">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-1 rounded-full text-xs font-black uppercase">Most Popular</div>
          <div className="mb-8">
            <h3 className="text-xl font-bold text-emerald-400 mb-2">Business Pro</h3>
            <div className="text-5xl font-black">$49<span className="text-base text-emerald-500/50">/mo</span></div>
            <p className="text-xs text-emerald-500/50 mt-2">Billed annually, per seat</p>
          </div>
          <ul className="space-y-4 mb-12 flex-grow text-sm">
            <li className="flex items-center gap-2">✅ Everything in Starter</li>
            <li className="flex items-center gap-2">✅ SwCafe Hub integration</li>
            <li className="flex items-center gap-2">✅ Premium LUTs & Templates</li>
            <li className="flex items-center gap-2">✅ Full vocal transformation tools</li>
            <li className="flex items-center gap-2">✅ Priority technical support</li>
          </ul>
          <button className="w-full bg-emerald-600 hover:bg-emerald-700 py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20">Upgrade Now</button>
        </div>

        <div className="bg-slate-800/40 p-8 rounded-3xl border border-white/10 hover:bg-slate-800/60 transition-all flex flex-col">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-400 mb-2">Enterprise</h3>
            <div className="text-5xl font-black">Custom</div>
            <p className="text-xs text-slate-500 mt-2">Volume discounts available</p>
          </div>
          <ul className="space-y-4 mb-12 flex-grow text-sm">
            <li className="flex items-center gap-2">✅ Everything in Pro</li>
            <li className="flex items-center gap-2">✅ Custom API integrations</li>
            <li className="flex items-center gap-2">✅ Dedicated account manager</li>
            <li className="flex items-center gap-2">✅ Unlimited legal coverage</li>
            <li className="flex items-center gap-2">✅ 24/7 priority phone support</li>
          </ul>
          <button className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition-colors">Contact Sales</button>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
