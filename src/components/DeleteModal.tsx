'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import type { Song } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import WindowFrame from './WindowFrame';

interface DeleteModalProps {
  isOpen: boolean;
  song: Song | null;
  onClose: () => void;
  onDeleteSuccess: (deletedSongId: string) => void;
}

export default function DeleteModal({
  isOpen,
  song,
  onClose,
  onDeleteSuccess,
}: DeleteModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen || !song) return null;

  const handleClose = () => {
    if (!loading) {
      setPin('');
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Verify Admin PIN (client-side check against env with fallback to '2026')
    const expectedPin = process.env.NEXT_PUBLIC_ADMIN_PIN || '2026';
    if (pin.trim() !== expectedPin) {
      setError('SECURITY CLEARANCE REJECTED // INVALID ADMIN PIN');
      return;
    }

    setLoading(true);

    try {
      // 2. Delete from Supabase PostgreSQL table if configured and record exists in DB
      if (supabase && isSupabaseConfigured && !song.id.startsWith('fallback-')) {
        const { error: dbError } = await supabase
          .from('songs')
          .delete()
          .eq('id', song.id);

        if (dbError) throw dbError;
      }

      setSuccess(true);

      // 3. Instantly notify parent to update local state without requiring page reload
      setTimeout(() => {
        onDeleteSuccess(song.id);
        setPin('');
        setLoading(false);
        setSuccess(false);
        onClose();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Database delete query failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm">
        <WindowFrame
          title="PURGE TRACK // SECURITY OVERRIDE"
          onClose={loading ? undefined : handleClose}
        >
          {/* Target Track Information Card */}
          <div className="mb-4 border border-red-500/40 bg-red-950/30 p-3">
            <div className="flex items-center gap-2 mb-1.5 text-red-300">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="font-space-mono text-[9px] font-bold tracking-[0.2em] uppercase">
                TARGET IDENTIFIED FOR PURGE
              </span>
            </div>
            <div className="font-orbitron truncate text-xs font-bold tracking-[0.15em] text-white uppercase">
              {song.title}
            </div>
            <div className="font-space-mono truncate text-[9px] tracking-[0.1em] text-white/60">
              {song.artist} {song.album ? `// ${song.album}` : ''}
            </div>
            <div className="font-space-mono mt-1 text-[8px] text-red-400/80 tracking-[0.1em]">
              RECORD ID: {song.id.slice(0, 16)}...
            </div>
          </div>

          <form onSubmit={handleDelete} className="space-y-3.5">
            {/* PIN Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-space-mono text-[9px] tracking-[0.2em] text-white/80 uppercase">
                  ENTER ADMIN SECURITY PIN
                </label>
                <span className="font-space-mono text-[8px] text-white/40">
                  DEFAULT: 2026
                </span>
              </div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="font-space-mono w-full border border-white/40 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-red-400 focus:outline-none transition-colors"
                placeholder="Enter PIN (e.g. 2026)..."
                autoFocus
                required
                disabled={loading || success}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="font-space-mono border border-red-400/80 bg-red-950/50 p-2 text-[8px] tracking-[0.1em] text-red-300">
                ⚠ {error}
              </div>
            )}

            {/* Success Feedback */}
            {success && (
              <div className="font-space-mono flex items-center gap-2 border border-green-400/80 bg-green-950/50 p-2 text-[9px] tracking-[0.1em] text-green-300">
                <CheckCircle2 size={13} className="text-green-400" />
                <span>PURGED FROM SYSTEM // UPDATING STREAM</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading || success}
                className="font-space-mono flex-1 border border-white/30 bg-white/5 py-2 text-[9px] tracking-[0.15em] text-white/80 uppercase hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
              >
                CANCEL
              </button>

              <button
                type="submit"
                disabled={loading || success || !pin.trim()}
                className="font-orbitron flex-1 flex items-center justify-center gap-1.5 border border-red-400 bg-red-600/30 py-2 text-[9px] font-bold tracking-[0.2em] text-red-200 uppercase hover:bg-red-600 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.3)]"
              >
                {loading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    PURGING...
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    CONFIRM PURGE
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

