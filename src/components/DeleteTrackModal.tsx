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
  onDeleteSuccess: (deletedSongId: string, deletedTitle?: string) => void;
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

    const entered = pin.trim();
    if (!entered) {
      setError('PLEASE ENTER SECURITY PIN.');
      return;
    }

    setDeleting(true);

    try {
      // 1. Strict Security PIN pre-check with server API
      const pinCheck = await fetch(`/api/songs?action=verify-pin&pin=${encodeURIComponent(entered)}`);
      if (pinCheck.ok) {
        const pinRes = await pinCheck.json();
        if (pinRes.valid === false) {
          setError('INVALID SECURITY PIN. ACCESS DENIED.');
          setDeleting(false);
          return;
        }
      } else {
        // Fallback local check if server check unreachable
        const expectedPin = (process.env.NEXT_PUBLIC_ADMIN_PIN || '2026')
          .replace(/^["']|["']$/g, '')
          .trim();
        if (entered !== expectedPin) {
          setError('INVALID SECURITY PIN. ACCESS DENIED.');
          setDeleting(false);
          return;
        }
      }

      let purgedSuccessfully = false;
      let failureReason = '';

      // 2. Primary Method: POST /api/songs with action: 'delete'
      // This deletes from Cloudinary storage AND Supabase
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id: song.id,
          title: song.title,
          artist: song.artist,
          audio_url: song.audio_url,
          cover_url: song.cover_url,
          pin: entered,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // If server explicitly denied PIN, abort immediately — NEVER fall back!
      if (res.status === 401 || (data?.error && data.error.includes('PIN'))) {
        setError('INVALID SECURITY PIN. ACCESS DENIED.');
        setDeleting(false);
        return;
      }

      if (res.ok && data.success) {
        purgedSuccessfully = true;
      } else {
        failureReason = data?.error || `Server returned status ${res.status}`;
      }

      // 3. Secondary Method Fallback: DELETE /api/songs only if server had a non-401 error
      if (!purgedSuccessfully) {
        try {
          const delRes = await fetch(
            `/api/songs?id=${encodeURIComponent(song.id)}&pin=${encodeURIComponent(entered)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`,
            {
              method: 'DELETE',
              headers: {
                'x-admin-pin': entered,
              },
            }
          );
          if (delRes.status === 401) {
            setError('INVALID SECURITY PIN. ACCESS DENIED.');
            setDeleting(false);
            return;
          }
          const delData = await delRes.json().catch(() => ({}));
          if (delRes.ok && delData.success) {
            purgedSuccessfully = true;
          }
        } catch (delErr) {
          console.warn('DELETE fallback error:', delErr);
        }
      }

      // 4. Tertiary Fallback: Direct Client Supabase Delete (ONLY if server route was 503/offline, never for 401)
      if (!purgedSuccessfully && res.status >= 500) {
        try {
          const client = getSupabase();
          if (client) {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(song.id);
            if (isUUID) {
              await client.from('songs').delete().eq('id', song.id);
            }
            if (song.title && song.artist) {
              await client
                .from('songs')
                .delete()
                .ilike('title', song.title.trim())
                .ilike('artist', song.artist.trim());
            }
            purgedSuccessfully = true;
          }
        } catch (clientErr) {
          console.warn('Direct client Supabase purge warning:', clientErr);
        }
      }

      if (!purgedSuccessfully) {
        throw new Error(failureReason || 'Failed to purge record from database');
      }

      // 5. Instantly update UI state and re-fetch from database
      onDeleteSuccess(song.id, song.title);
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
                  REQUIRED
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
                className="font-space-mono flex-1 border border-white/30 bg-white/5 py-2 text-[10px] tracking-[0.15em] text-white/70 uppercase hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                [ ABORT ]
              </button>

              <button
                type="submit"
                disabled={deleting || !pin}
                className="font-orbitron flex-1 flex items-center justify-center gap-1.5 border border-red-400 bg-red-600/30 py-2 text-[10px] font-bold tracking-[0.2em] text-red-200 uppercase hover:bg-red-600 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(239,68,68,0.3)] cursor-pointer"
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
