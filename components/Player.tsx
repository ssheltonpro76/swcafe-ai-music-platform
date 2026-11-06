import React, { useState, useEffect, useRef } from 'react';
import { registerUploadedSound } from './unifiedBrowser';

interface PlayerProps {
  track: {
    title: string;
    artist: string;
    cover: string;
    audioUrl?: string;
  };
  onPlay?: (title: string, artist: string, cover: string, audioUrl?: string) => void;
}

const fmtTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const Player: React.FC<PlayerProps> = ({ track, onPlay }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [hint, setHint] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastObjectUrlRef = useRef<string | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  const showHint = (msg: string) => {
    setHint(msg);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(null), 2600);
  };

  // Create the audio element once and wire events
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = 0.7;
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      console.error('Audio load/playback error for', audio.src);
      setIsPlaying(false);
      showHint("Couldn't play this audio file");
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      if (lastObjectUrlRef.current) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
        lastObjectUrlRef.current = null;
      }
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      audioRef.current = null;
    };
  }, []);

  // Load a new track's audio when audioUrl changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextUrl = track.audioUrl;

    if (lastObjectUrlRef.current && lastObjectUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }

    if (nextUrl) {
      if (nextUrl.startsWith('blob:')) lastObjectUrlRef.current = nextUrl;
      audio.pause();
      audio.src = nextUrl;
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      // Autoplay freshly loaded audio (upload/selection is a user gesture)
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    }
  }, [track.audioUrl]);

  // Keep element volume/mute in sync
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.muted = isMuted;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!track.audioUrl || !audio) {
      showHint('No audio loaded — upload a file to play');
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.ended) audio.currentTime = 0;
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.error('Audio play failed', err);
        setIsPlaying(false);
        showHint("Couldn't play this audio file");
      });
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!track.audioUrl || !audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = frac * duration;
    setCurrentTime(audio.currentTime);
  };

  const setVolumeFromBar = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setVolume(frac);
    if (frac > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onPlay) return;
    const url = URL.createObjectURL(file);
    const title = file.name.replace(/\.[^.]+$/, '') || 'Untitled upload';
    // Auto-tag (10.2): register the upload in the Sound Browser — analyzed
    // on-device, fire-and-forget, never blocks playback.
    void registerUploadedSound(file, url, false);
    onPlay(title, 'My Upload', track.cover, url);
  };

  const pct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const volPct = isMuted ? 0 : volume * 100;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-20 bg-[#0a0a0b]/95 backdrop-blur-md border-t border-white/5 px-6 flex items-center justify-between z-50 shadow-2xl select-none text-zinc-200">
      {hint && (
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-[#1a1a1e] border border-white/10 text-zinc-200 text-xs font-medium px-4 py-2 rounded-full shadow-xl whitespace-nowrap">
          {hint}
        </div>
      )}
      {/* Left section: Track Info */}
      <div className="flex items-center gap-4 w-1/3">
        <div className="relative group cursor-pointer overflow-hidden rounded-xl">
          <img 
            src={track.cover} 
            alt="Cover" 
            className="w-14 h-14 object-cover shadow-md shadow-black/40 group-hover:scale-105 transition-transform duration-300" 
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <span className="text-xs">💿</span>
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold tracking-tight truncate text-white hover:text-orange-400 cursor-pointer transition-colors">
            {track.title}
          </h4>
          <p className="text-xs font-medium text-zinc-400 hover:text-zinc-300 cursor-pointer truncate mt-0.5">
            {track.artist}
          </p>
        </div>
        <button 
          onClick={() => setIsLiked(!isLiked)} 
          className="ml-3 text-lg hover:scale-110 active:scale-90 transition-transform"
          title={isLiked ? 'Unlike' : 'Like'}
        >
          {isLiked ? '❤️' : '🤍'}
        </button>
      </div>

      {/* Middle section: Playback Controls */}
      <div className="flex flex-col items-center gap-2 w-1/3">
        <div className="flex items-center gap-6">
          <button className="text-zinc-500 hover:text-white text-sm transition-colors" title="Shuffle">🔀</button>
          <button className="text-lg text-zinc-400 hover:text-white transition-colors" title="Previous">⏮</button>
          <button 
            onClick={togglePlay}
            className="w-11 h-11 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-all active:scale-95 shadow-lg relative group overflow-hidden"
            title={track.audioUrl ? (isPlaying ? 'Pause' : 'Play') : 'No audio loaded'}
          >
            <span className="text-sm font-black select-none -mr-0.5 z-10">
              {isPlaying ? '⏸' : '▶'}
            </span>
          </button>
          <button className="text-lg text-zinc-400 hover:text-white transition-colors" title="Next">⏭</button>
          <button className="text-zinc-500 hover:text-white transition-colors" title="Repeat">🔁</button>
        </div>
        <div className="w-full flex items-center gap-3">
          <span className="text-[10px] font-medium tracking-tight tabular-nums text-zinc-500">{fmtTime(currentTime)}</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer relative group" onClick={seek}>
            <div 
              className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
              style={{ width: `${pct}%`, transition: 'width 0.3s ease' }}
            ></div>
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity"
              style={{ left: `${pct}%` }}
            ></div>
          </div>
          <span className="text-[10px] font-medium tracking-tight tabular-nums text-zinc-500">{fmtTime(duration)}</span>
        </div>
      </div>

      {/* Right section: Master Volume & Display Toggles */}
      <div className="flex items-center justify-end gap-5 w-1/3">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="text-zinc-400 hover:text-white transition-colors"
          title="Upload audio file"
        >
          📁 Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFile}
        />
        <button className="text-zinc-400 hover:text-white transition-colors" title="Show Lyrics">🎙️ Lyrics</button>
        <button className="text-zinc-400 hover:text-white transition-colors" title="Remix and Variation">🎚️ Remix</button>
        <div className="flex items-center gap-2 w-28">
          <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors" title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative" onClick={setVolumeFromBar}>
            <div 
              className="h-full rounded-full bg-zinc-400 group-hover:bg-orange-500 transition-colors"
              style={{ width: `${volPct}%` }}
            ></div>
            <div 
              className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity ${isMuted ? 'hidden' : ''}`}
              style={{ left: `${volPct}%` }}
            ></div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Player;
