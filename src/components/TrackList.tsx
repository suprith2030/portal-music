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
  onDeleteTrack: (song: Song) => void;
}

export default function TrackList({
  songs,
  currentIndex,
  isPlaying,
  onSelectTrack,
  onDeleteTrack,
}: TrackListProps) {
  if (songs.length === 0) {
    return (
      <div className="font-space-mono flex items-center justify-center py-8 text-[10px] tracking-[0.2em] text-white/40 uppercase">
        NO TRACKS LOADED // INITIALIZE UPLOAD
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/10">
      {songs.map((song, index) => {
        const isActive = index === currentIndex;
        return (
          <div
            key={song.id}
            className={`group flex w-full items-center justify-between gap-3 px-3 py-2.5 transition-colors ${
              isActive ? 'bg-white/15' : 'hover:bg-white/5'
            }`}
          >
            {/* Clickable track selection & play zone */}
            <div
              onClick={() => onSelectTrack(index)}
              className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer"
            >
              {/* Cover thumbnail */}
              <div className="relative h-10 w-10 shrink-0 border border-white/30 bg-[#463DF5]/50 overflow-hidden">
                {song.cover_url ? (
                  <HalftoneImage
                    src={song.cover_url}
                    alt={song.title}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="font-orbitron text-[8px] text-white/50">
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

              {/* Title & Artist */}
              <div className="min-w-0 flex-1">
                <div
                  className={`font-orbitron truncate text-[11px] tracking-[0.15em] uppercase font-bold ${
                    isActive ? 'text-white drop-shadow-[0_0_8px_white]' : 'text-white/85'
                  }`}
                >
                  {song.title}
                </div>
                <div className="font-space-mono truncate text-[9px] tracking-[0.1em] text-white/60">
                  {song.artist} {song.album ? `// ${song.album}` : ''}
                </div>
              </div>

              {/* Duration */}
              <span className="font-space-mono shrink-0 text-[9px] tracking-[0.1em] text-white/50">
                {song.duration}
              </span>
            </div>

            {/* Right side controls: Track index + Secure Delete button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-space-mono w-5 text-right text-[8px] tracking-[0.1em] text-white/30 select-none">
                {String(index + 1).padStart(2, '0')}
              </span>

              {/* Secure Delete Track Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTrack(song);
                }}
                className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/20 border border-transparent hover:border-red-400/50 transition-all cursor-pointer"
                title={`Purge "${song.title}" from audio database`}
                aria-label={`Delete ${song.title}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
