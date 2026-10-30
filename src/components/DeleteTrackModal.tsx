'use client';

import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import type { Song } from '@/types';
import { getSupabase } from '@/lib/supabase';
import WindowFrame from './WindowFrame';

interface DeleteTrackModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteSuccess: (deletedSongId: string) => void;
}

export default function DeleteTrackModal({
  song,
  isOpen,
  onClose,
  onDeleteSuccess,
}: DeleteTrackModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !song) return null;

  const handleClose = () => {
    if (!deleting) {
      setPin('');
      setError('');
      onClose();
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Verify Admin PIN (accepts configured env pin, 'suprith2030', or default '2026')
    const expectedPin = (process.env.NEXT_PUBLIC_ADMIN_PIN || '2026')
      .replace(/^["']|["']$/g, '')
      .trim();
    const entered = pin.trim();
    if (entered !== expectedPin && entered !== '2026' && entered !== 'suprith2030') {
      setError('INVALID SECURITY PIN. ACCESS DENIED.');
      return;
    }

    setDeleting(true);

    try {
      // 2. Delete song record from Supabase via server API route (most reliable) with client fallback
      let deleted = false;
      try {
        const res = await fetch(`/api/songs?id=${encodeURIComponent(song.id)}`, {
          method: 'DELETE',
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          deleted = true;
        }
      } catch (apiErr) {
        console.warn('API /api/songs DELETE failed, attempting direct Supabase query:', apiErr);
      }

      if (!deleted) {
        const client = getSupabase();
        if (client) {
          const { error: dbError } = await client
            .from('songs')
            .delete()
            .eq('id', song.id);

          if (dbError) throw dbError;
          deleted = true;
        }
      }

      // 3. Immediately update UI state
      onDeleteSuccess(song.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge record');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm">
        <WindowFrame
          title="SECURITY CLEARANCE // PURGE"
          onClose={deleting ? undefined : handleClose}
          className="border-red-400/80 shadow-[0_0_25px_rgba(239,68,68,0.3)]"
        >
          {/* Warning banner */}
          <div className="mb-4 flex items-start gap-2.5 border border-red-400/40 bg-red-950/40 p-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-space-mono text-[10px] tracking-[0.1em] text-red-200 uppercase font-bold">
                CONFIRM TRACK PURGE
              </p>
              <p className="font-space-mono mt-0.5 text-[9px] text-red-300/80">
                This operation will permanently remove this track from the PORTAL archive.
              </p>
            </div>
          </div>

          {/* Track details target */}
          <div className="mb-4 border border-white/20 bg-white/5 p-3">
            <span className="font-space-mono block text-[8px] tracking-[0.2em] text-white/50 uppercase">
              TARGET RECORD
            </span>
            <p className="font-orbitron truncate text-xs font-bold tracking-[0.15em] text-white uppercase mt-0.5">
              {song.title}
            </p>
            <p className="font-space-mono truncate text-[9px] tracking-[0.1em] text-white/60">
              {song.artist} {song.album ? `// ${song.album}` : ''}
            </p>
          </div>

          <form onSubmit={handleDelete} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-space-mono text-[9px] tracking-[0.2em] text-white/80 uppercase">
                  SECURITY PIN
                </label>
                <span className="font-space-mono text-[8px] text-white/40">
                  DEFAULT: 2026
                </span>
              </div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                placeholder="Enter Admin PIN..."
                className="font-space-mono w-full border border-white/40 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-red-400 focus:outline-none transition-colors"
                required
                disabled={deleting}
              />
            </div>

            {error && (
              <div className="font-space-mono border border-red-500/80 bg-red-950/60 p-2 text-[9px] text-red-200">
                ⚠ {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={deleting}
                className="font-space-mono flex-1 border border-white/30 bg-white/5 py-2 text-[10px] tracking-[0.15em] text-white/70 uppercase hover:bg-white/10 hover:text-white transition-colors"
              >
                [ ABORT ]
              </button>

              <button
                type="submit"
                disabled={deleting || !pin}
                className="font-orbitron flex-1 flex items-center justify-center gap-1.5 border border-red-400 bg-red-600/30 py-2 text-[10px] font-bold tracking-[0.2em] text-red-200 uppercase hover:bg-red-600 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(239,68,68,0.3)]"
              >
                {deleting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    PURGING...
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    PURGE RECORD
                  </>
                )}
              </button>
            </div>
          </form>
        </WindowFrame>
      </div>
    </div>
  );
}

