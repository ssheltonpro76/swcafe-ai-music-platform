import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MidiNote, midiName, makeNoteId } from './midi';

/**
 * Piano-roll editor for one MIDI lane — original implementation.
 * Click empty grid to add a note, drag a note to move it, drag its right
 * edge to resize it, double-click a note to delete it. Click a piano key
 * to preview that pitch.
 */

const ROW_H = 18;
const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const SNAP = 0.05; // seconds

interface Props {
  notes: MidiNote[];
  onChange: (notes: MidiNote[]) => void;
  /** Visible timeline length in seconds. */
  duration: number;
  color: string;
  pxPerSec?: number;
  onPreviewNote?: (midi: number) => void;
}

const PianoRoll: React.FC<Props> = ({ notes, onChange, duration, color, pxPerSec = 46, onPreviewNote }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    mode: 'move' | 'resize';
    id: string;
    startX: number;
    startY: number;
    orig: MidiNote;
  } | null>(null);

  const { low, high } = useMemo(() => {
    if (notes.length === 0) return { low: 48, high: 71 }; // C3..B4
    const pitches = notes.map(n => n.pitch);
    return {
      low: Math.max(24, Math.min(...pitches) - 2),
      high: Math.min(108, Math.max(...pitches) + 2),
    };
  }, [notes]);
  const rows = high - low + 1;
  const width = Math.max(320, Math.ceil((duration || 30) * pxPerSec) + 8);
  const height = rows * ROW_H;

  const pitchAtY = (y: number): number => {
    const row = Math.floor(y / ROW_H);
    return Math.max(low, Math.min(high, high - row));
  };
  const timeAtX = (x: number): number => Math.max(0, x / pxPerSec);

  const gridPos = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = gridRef.current?.getBoundingClientRect();
    return { x: (e.clientX - (rect?.left ?? 0)) + (gridRef.current?.scrollLeft ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const { x, y } = gridPos(e);
    const pitch = pitchAtY(y);
    const t = Math.round(timeAtX(x) / SNAP) * SNAP;
    const note: MidiNote = { id: makeNoteId(), pitch, start: t, end: Math.min(duration || t + 0.5, t + 0.5), velocity: 90 };
    onChange([...notes, note]);
    setSelectedId(note.id);
    onPreviewNote?.(pitch);
  };

  const handleNotePointerDown = (e: React.PointerEvent, note: MidiNote) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const mode: 'move' | 'resize' = e.clientX > rect.right - 9 ? 'resize' : 'move';
    dragRef.current = { mode, id: note.id, startX: e.clientX, startY: e.clientY, orig: note };
    setSelectedId(note.id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleNotePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const dt = Math.round((dx / pxPerSec) / SNAP) * SNAP;
    const dp = Math.round(dy / ROW_H);
    onChange(notes.map(n => {
      if (n.id !== drag.id) return n;
      if (drag.mode === 'resize') {
        const len = Math.max(0.1, (drag.orig.end - drag.orig.start) + dt);
        return { ...n, end: Math.min(duration || Infinity, drag.orig.start + len) };
      }
      const len = drag.orig.end - drag.orig.start;
      const start = Math.max(0, drag.orig.start + dt);
      const pitch = Math.max(0, Math.min(127, drag.orig.pitch - dp));
      return { ...n, start, end: start + len, pitch };
    }));
  };

  const handleNotePointerUp = () => { dragRef.current = null; };

  const deleteNote = (id: string) => {
    onChange(notes.filter(n => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Delete / Backspace removes the selected note (unless typing in a field).
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNote(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, notes]);

  const timeMarks: number[] = [];
  for (let t = 0; t <= (duration || 30); t += 5) timeMarks.push(t);

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Piano roll — click grid to add a note · drag to move · drag right edge to resize · double-click to delete</span>
        <span className="text-[9px] font-mono text-zinc-600">{notes.length} notes</span>
      </div>
      <div className="flex min-h-0">
        {/* Piano keys */}
        <div className="w-14 shrink-0 border-r border-white/10 select-none" style={{ height }}>
          {Array.from({ length: rows }).map((_, i) => {
            const pitch = high - i;
            const isWhite = WHITE.has(pitch % 12);
            const isC = pitch % 12 === 0;
            return (
              <button
                key={pitch}
                onClick={() => onPreviewNote?.(pitch)}
                className={`w-full flex items-center justify-end pr-1.5 border-b ${isWhite ? 'bg-[#e8e8e8] text-zinc-700 hover:bg-white' : 'bg-[#222226] text-zinc-400 hover:bg-[#2c2c31]'} border-black/30`}
                style={{ height: ROW_H }}
                title={midiName(pitch)}
              >
                {isC && <span className="text-[8px] font-black font-mono">{midiName(pitch)}</span>}
              </button>
            );
          })}
        </div>
        {/* Grid */}
        <div
          ref={gridRef}
          className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative cursor-crosshair"
          style={{ height }}
          onPointerDown={handleGridPointerDown}
        >
          <div className="relative" style={{ width, height }}>
            {/* Pitch rows */}
            {Array.from({ length: rows }).map((_, i) => {
              const pitch = high - i;
              const isWhite = WHITE.has(pitch % 12);
              return (
                <div
                  key={pitch}
                  className={`absolute left-0 right-0 border-b ${isWhite ? 'bg-white/[0.02]' : 'bg-black/30'} border-white/5`}
                  style={{ top: i * ROW_H, height: ROW_H }}
                />
              );
            })}
            {/* Time gridlines */}
            {timeMarks.map(t => (
              <div key={t} className="absolute top-0 bottom-0 border-l border-white/10 pointer-events-none" style={{ left: t * pxPerSec }}>
                <span className="absolute top-0.5 left-1 text-[8px] font-mono text-zinc-600">{t}s</span>
              </div>
            ))}
            {/* Notes */}
            {notes.map(note => {
              const top = (high - note.pitch) * ROW_H;
              const left = note.start * pxPerSec;
              const w = Math.max(8, (note.end - note.start) * pxPerSec);
              const isSelected = selectedId === note.id;
              return (
                <div
                  key={note.id}
                  onPointerDown={e => handleNotePointerDown(e, note)}
                  onPointerMove={handleNotePointerMove}
                  onPointerUp={handleNotePointerUp}
                  onDoubleClick={() => deleteNote(note.id)}
                  onClick={e => { e.stopPropagation(); setSelectedId(note.id); }}
                  className={`absolute rounded-[3px] border cursor-grab active:cursor-grabbing touch-none ${isSelected ? 'ring-2 ring-white/70 z-10' : ''}`}
                  style={{
                    top: top + 1.5, left, width: w, height: ROW_H - 3,
                    backgroundColor: color, borderColor: 'rgba(255,255,255,0.35)', opacity: 0.92,
                  }}
                  title={`${midiName(note.pitch)} · ${note.start.toFixed(2)}s – ${note.end.toFixed(2)}s · vel ${note.velocity}`}
                >
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-black text-black/60 truncate" style={{ maxWidth: w - 12 }}>
                    {midiName(note.pitch)}
                  </span>
                  <span className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" title="Drag to resize" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selectedId && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/5">
          <button
            onClick={() => deleteNote(selectedId)}
            className="px-2 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-[9px] font-black uppercase text-red-300 hover:bg-red-500/25"
          >
            Delete selected note
          </button>
          <span className="text-[9px] text-zinc-600">Tip: press Delete while a note is selected to remove it.</span>
        </div>
      )}
    </div>
  );
};

export default PianoRoll;
