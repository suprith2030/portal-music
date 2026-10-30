'use client';

import React from 'react';
import { Play, Pause, Trash2 } from 'lucide-react';
import type { Song } from '@/types';
import HalftoneImage from './HalftoneImage';

interface TrackListProps {
  songs: Song[];
  currentIndex: number;
  isPlaying: boolean;
  onSelectTrack: (index: number) => void;
  onRequestDelete?: (song: Song) => void;
  currentSongId?: string;
}

export default function TrackList({
  songs,
  currentIndex,
  isPlaying,
  onSelectTrack,
  onRequestDelete,
  currentSongId,
}: TrackListProps) {
  if (songs.length === 0) {
    return (
      <div className="font-space-mono flex items-center justify-center py-8 text-[10px] tracking-[0.2em] text-white/40 uppercase">
        NO MATCHING TRACKS FOUND // SEARCH OR UPLOAD
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/10">
      {songs.map((song, index) => {
        // Match active status either by song ID or index
        const isActive = currentSongId
          ? song.id === currentSongId
          : index === currentIndex;

        return (
          <div
            key={song.id}
            onClick={() => onSelectTrack(index)}
            className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer select-none ${
              isActive ? 'bg-white/15' : 'hover:bg-white/5'
            }`}
          >
            {/* Cover thumbnail */}
            <div className="relative h-10 w-10 shrink-0 border border-white/30 bg-[#463DF5]/40 overflow-hidden">
              {song.cover_url ? (
                <HalftoneImage
                  src={song.cover_url}
                  alt={song.title}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-orbitron text-[8px] text-white/40">
                    ◈
                  </span>
                </div>
              )}

              {/* Play/Pause overlay */}
              <div
                className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {isActive && isPlaying ? (
                  <Pause size={12} className="text-white" />
                ) : (
                  <Play size={12} className="text-white ml-0.5" />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div
                className={`font-orbitron truncate text-[11px] tracking-[0.15em] uppercase font-semibold ${
                  isActive ? 'text-white' : 'text-white/85'
                }`}
              >
                {song.title}
              </div>
              <div className="font-space-mono truncate text-[9px] tracking-[0.1em] text-white/50">
                {song.artist} {song.album ? `// ${song.album}` : ''}
              </div>
            </div>

            {/* Duration */}
            <span className="font-space-mono shrink-0 text-[10px] tracking-[0.1em] text-white/40">
              {song.duration}
            </span>

            {/* Delete track button */}
            {onRequestDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDelete(song);
                }}
                className="shrink-0 p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/15 border border-transparent hover:border-red-400/40 transition-all opacity-70 group-hover:opacity-100"
                title={`Purge "${song.title}"`}
                aria-label={`Delete ${song.title}`}
              >
                <Trash2 size={12} />
              </button>
            )}

            {/* Index label */}
            <span className="font-space-mono w-5 shrink-0 text-right text-[9px] tracking-[0.1em] text-white/25">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
