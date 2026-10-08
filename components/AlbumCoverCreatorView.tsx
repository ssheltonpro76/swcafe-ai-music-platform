
import React, { useState, useRef } from 'react';
import { generateAlbumArt } from '../geminiService';
import { Upload, Image as ImageIcon, Wand2, Download, RefreshCw, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AlbumCoverCreatorView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [style, setStyle] = useState('Cinematic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const styles = [
    { name: 'Cinematic', icon: '🎬' },
    { name: 'Abstract', icon: '🎨' },
    { name: 'Minimalist', icon: '⚪' },
    { name: 'Cyberpunk', icon: '🌆' },
    { name: 'Vintage', icon: '📻' },
    { name: 'Surreal', icon: '👁️' },
    { name: 'Watercolor', icon: '🖌️' },
    { name: '3D Render', icon: '🧊' }
  ];

  const aspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];

  const handleGenerate = async () => {
    if (!prompt) return alert('Please describe your visual vision.');
    setIsGenerating(true);
    setGeneratedImage(null);
    try {
      const fullPrompt = `${style} style album cover art of ${prompt}`;
      const imageUrl = await generateAlbumArt(fullPrompt, aspectRatio);
      setGeneratedImage(imageUrl);
    } catch (e) {
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File is too large. Please upload an image under 10MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setGeneratedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `swcafe-album-art-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearImage = () => {
    setGeneratedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-10 pb-20"
    >
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-black tracking-tight flex items-center justify-center gap-3">
          <ImageIcon className="text-[#FF6B6B]" size={32} />
          AI Album Art Creator
        </h1>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">Neural Vision Engine v3.1</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Control Panel */}
        <div className="lg:col-span-5 space-y-8 bg-white/5 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl h-fit">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Describe the Scene</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A solitary astronaut standing on a neon-lit beach at night..."
              className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6B6B] outline-none placeholder:text-slate-700 resize-none transition-all"
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Style Direction</label>
            <div className="grid grid-cols-4 gap-2">
              {styles.map(s => (
                <button
                  key={s.name}
                  onClick={() => setStyle(s.name)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${style === s.name ? 'border-[#FF6B6B] bg-[#FF6B6B]/10 text-white' : 'border-white/5 bg-black/20 text-slate-500 hover:border-white/10'}`}
                >
                  <span className="text-xl mb-1">{s.icon}</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Aspect Ratio</label>
            <div className="flex gap-2">
              {aspectRatios.map(ar => (
                <button
                  key={ar}
                  onClick={() => setAspectRatio(ar as any)}
                  className={`flex-1 py-3 rounded-xl border transition-all text-xs font-black ${aspectRatio === ar ? 'border-[#FF6B6B] bg-[#FF6B6B]/10 text-[#FF6B6B]' : 'border-white/5 bg-black/20 text-slate-500 hover:border-white/10'}`}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 bg-gradient-to-r from-[#FF6B6B] to-[#FFE66D] text-black font-black py-5 rounded-[1.5rem] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all text-[10px] uppercase tracking-[0.2em] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Wand2 size={16} />
              )}
              {isGenerating ? 'Rendering...' : 'Generate'}
            </button>

            <button
              onClick={triggerUpload}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-5 rounded-[1.5rem] transition-all text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              Upload
            </button>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white/5 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
            <header className="p-6 bg-white/5 border-b border-white/5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-[#FFE66D] animate-pulse"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canvas Preview</span>
               </div>
               <div className="flex gap-2">
                {generatedImage && (
                  <>
                    <button 
                      onClick={clearImage}
                      className="bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1"
                    >
                      <X size={12} /> Clear
                    </button>
                    <button 
                      onClick={downloadImage}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1"
                    >
                      <Download size={12} /> Download
                    </button>
                  </>
                )}
               </div>
            </header>
            
            <div className="flex-1 p-10 flex items-center justify-center bg-black/20 relative">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div 
                    key="generating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center space-y-6"
                  >
                     <div className="w-20 h-20 border-4 border-[#FF6B6B]/20 border-t-[#FF6B6B] rounded-full animate-spin mx-auto"></div>
                     <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-[0.2em]">Synthesizing neural pixels...</p>
                  </motion.div>
                ) : generatedImage ? (
                  <motion.div 
                    key="preview"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group max-w-full max-h-full flex items-center justify-center"
                  >
                     <img 
                      src={generatedImage} 
                      alt="Album Art" 
                      className="rounded-2xl shadow-2xl object-contain max-w-full max-h-[600px]" 
                     />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-4">
                        <button onClick={downloadImage} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                          <Download size={20} />
                        </button>
                        <button onClick={handleGenerate} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                          <RefreshCw size={20} />
                        </button>
                     </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.3 }}
                    className="text-center space-y-6"
                  >
                     <Sparkles size={80} className="mx-auto text-slate-400" />
                     <div className="max-w-xs mx-auto">
                        <h3 className="text-lg font-black uppercase tracking-widest mb-2">Blank Canvas</h3>
                        <p className="text-xs font-bold leading-relaxed">Enter a description to generate art, or upload your own masterpiece.</p>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-[#FF6B6B]/5 p-6 rounded-[2rem] border border-[#FF6B6B]/10 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#FF6B6B]/20 flex items-center justify-center text-[#FF6B6B]">
                  <Sparkles size={20} />
                </div>
                <div className="space-y-0.5">
                   <p className="text-[10px] font-black uppercase tracking-widest text-[#FF6B6B]">Creative Prompt Tip</p>
                   <p className="text-xs font-bold text-slate-300">Adding keywords like "high contrast" or "dreamy lighting" yields better results.</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AlbumCoverCreatorView;
