'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Plus,
  Share2,
  ChevronDown,
  ChevronUp,
  Check,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Song } from '@/types';
import { getSupabase } from '@/lib/supabase';
import { FALLBACK_TRACKS } from '@/lib/fallback-tracks';
import useAudioPlayer from '@/hooks/useAudioPlayer';
import WindowFrame from './WindowFrame';
import SineWaveVisualizer from './SineWaveVisualizer';
import TrackList from './TrackList';
import UploadModal from './UploadModal';
import DeleteTrackModal from './DeleteTrackModal';
import TickerStrip from './TickerStrip';
import HalftoneImage from './HalftoneImage';

// Helper to sort songs alphabetically by title
const sortAlphabetical = (trackList: Song[]): Song[] =>
  [...trackList].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  );

export default function PortalAudioOS() {
  const [songs, setSongs] = useState<Song[]>(() => sortAlphabetical(FALLBACK_TRACKS));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTracklist, setShowTracklist] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffle,
    repeatMode,
    analyserNode,
    togglePlay,
    pause,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    loadTrack,
  } = useAudioPlayer(songs, currentIndex, setCurrentIndex);

  // Fetch songs from Supabase (server API route first, direct client fallback) or fallback tracks
  const fetchSongs = useCallback(async () => {
    setLoading(true);
    let loadedSongs: Song[] | null = null;

    // 1. Primary: Server API route (bypasses client build-time env variable inlining issues on Vercel)
    try {
      const res = await fetch('/api/songs', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.songs) && json.songs.length > 0) {
          loadedSongs = json.songs as Song[];
        }
      }
    } catch (e) {
      console.warn('API /api/songs GET failed, attempting direct Supabase query:', e);
    }

    // 2. Secondary fallback: Direct Supabase client query
    if (!loadedSongs) {
      const client = getSupabase();
      if (client) {
        try {
          const { data, error } = await client
            .from('songs')
            .select('*')
            .order('title', { ascending: true });

          if (!error && data && data.length > 0) {
            loadedSongs = data as Song[];
          }
        } catch (e) {
          console.warn('Direct client Supabase query failed:', e);
        }
      }
    }

    // 3. Update state with retrieved database songs or default fallback tracks
    if (loadedSongs && loadedSongs.length > 0) {
      setSongs(sortAlphabetical(loadedSongs));
    } else {
      setSongs(sortAlphabetical(FALLBACK_TRACKS));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Handle deep linking via ?track=id
  useEffect(() => {
    if (songs.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track');
    if (trackId) {
      const idx = songs.findIndex((s) => s.id === trackId);
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    }
  }, [songs]);

  // Load track when index changes
  useEffect(() => {
    if (songs.length > 0 && songs[currentIndex]) {
      loadTrack(songs[currentIndex]);
    }
  }, [currentIndex, songs, loadTrack]);

  const currentSong = songs[currentIndex] ?? null;

  // Real-time filtered search list
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.album && s.album.toLowerCase().includes(q))
    );
  }, [songs, searchQuery]);

  const formatTime = (t: number) => {
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleShare = async () => {
    if (!currentSong) return;
    const url = `${window.location.origin}${window.location.pathname}?track=${currentSong.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copy Portal Link:', url);
    }
  };

  // Map filtered track selection back to main sorted songs array
  const handleSelectFilteredTrack = (filteredIdx: number) => {
    const target = filteredSongs[filteredIdx];
    if (!target) return;
    const originalIdx = songs.findIndex((s) => s.id === target.id);
    if (originalIdx >= 0) {
      setCurrentIndex(originalIdx);
    }
  };

  // Trigger delete modal for a track
  const handleRequestDelete = (song: Song) => {
    setSongToDelete(song);
    setShowDeleteModal(true);
  };

  // Handle successful deletion: instantly remove from state and adjust player
  const handleDeleteSuccess = (deletedSongId: string) => {
    setSongs((prev) => {
      const updated = prev.filter((s) => s.id !== deletedSongId);

      if (updated.length === 0) {
        setCurrentIndex(0);
        pause();
      } else if (songs[currentIndex]?.id === deletedSongId) {
        // If active track was deleted, advance or fall back to last track
        const nextIdx = Math.min(currentIndex, updated.length - 1);
        setCurrentIndex(nextIdx);
        loadTrack(updated[nextIdx]);
      } else {
        // Recalculate current index in the updated list
        const activeId = songs[currentIndex]?.id;
        const newIdx = updated.findIndex((s) => s.id === activeId);
        if (newIdx >= 0) {
          setCurrentIndex(newIdx);
        }
      }
      return updated;
    });
  };

  const repeatIcon = () => {
    switch (repeatMode) {
      case 'one':
        return <Repeat1 size={16} />;
      default:
        return <Repeat size={16} />;
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-gradient-to-br from-[#F3B8F8] via-[#E29BF7] to-[#D88FF5] p-4 pb-16 md:p-8 md:pb-20">
      {/* ── Retro Structural Grid & Dashed Alignment Lines ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(to right, #FFFFFF 1px, transparent 1px), linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="absolute left-1/2 top-0 h-full w-px border-l border-dashed border-white/40" />
        <div className="absolute left-0 top-1/4 h-px w-full border-t border-dashed border-white/30" />
        <div className="absolute left-0 top-3/4 h-px w-full border-t border-dashed border-white/30" />

        <span className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 text-[9px] text-white/50 select-none">
          ▼
        </span>
        <span className="absolute left-1/2 top-3/4 -translate-x-1/2 -translate-y-1/2 text-[9px] text-white/50 select-none">
          ▲
        </span>
      </div>

      {/* ── Top Header Text & Geometric Micro-UI ── */}
      <div className="relative z-10 mb-6 text-center">
        <div className="inline-flex items-center gap-2 border border-white/60 bg-[#463DF5]/30 px-3 py-0.5 backdrop-blur-xs mb-2">
          <span className="h-1.5 w-1.5 bg-white animate-pulse" />
          <span className="font-space-mono text-[9px] font-bold tracking-[0.25em] text-white uppercase">
            TRUE GAME CHANGING
          </span>
        </div>

        <h1 className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-black tracking-[0.35em] text-white drop-shadow-[0_4px_16px_rgba(70,61,245,0.45)] select-none">
          PORTAL
        </h1>

        <p className="font-space-mono mt-1 text-[10px] sm:text-[11px] tracking-[0.3em] text-white/90 uppercase font-medium">
          ui/ux // tracks // queue // motion
        </p>

        <p className="font-caveat mt-1 text-base sm:text-lg text-white/75 font-semibold">
          retro-futuristic cyber-terminal audio experience
        </p>
      </div>

      {/* ── Main Indigo OS Player Window ── */}
      <div className="relative z-10 w-full max-w-lg">
        <WindowFrame title="AUDIO SYSTEM OS" className="relative shadow-2xl">
          {/* Main Visualizer & Halftone Cover Art Screen */}
          <div className="relative mb-4 aspect-[16/10] overflow-hidden border border-white/40 bg-[#463DF5]">
            {currentSong?.cover_url ? (
              <HalftoneImage
                src={currentSong.cover_url}
                alt={currentSong.title}
                className="absolute inset-0"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-[#463DF5] to-[#3A30D8]" />
            )}

            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <SineWaveVisualizer
                analyserNode={analyserNode}
                isPlaying={isPlaying}
              />
            </div>

            <div className="absolute top-2 left-2 flex items-center gap-1.5 border border-white/30 bg-[#3A30D8]/80 px-2 py-0.5">
              <span
                className={`h-1.5 w-1.5 rounded-none ${
                  isPlaying ? 'bg-green-400 animate-ping' : 'bg-white/50'
                }`}
              />
              <span className="font-space-mono text-[8px] tracking-[0.15em] text-white uppercase">
                {isPlaying ? 'ACTIVE STREAM' : 'IDLE WAVE'}
              </span>
            </div>

            <div className="absolute top-2 right-2 border border-white/30 bg-[#3A30D8]/80 px-2 py-0.5">
              <span className="font-space-mono text-[8px] tracking-[0.15em] text-white/80 uppercase">
                PORTAL // A-Z SORTED
              </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#1B1464]/95 via-[#3A30D8]/70 to-transparent px-4 pb-3 pt-10">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-orbitron truncate text-lg sm:text-xl font-bold tracking-[0.2em] text-white uppercase drop-shadow-sm">
                    {currentSong?.title ?? 'NO CARRIER'}
                  </h2>
                  <p className="font-space-mono truncate text-[10px] tracking-[0.15em] text-white/70">
                    {currentSong?.artist ?? '---'} // {currentSong?.album ?? '---'}
                  </p>
                </div>
                <div className="font-space-mono text-[10px] tracking-[0.15em] text-white/50 shrink-0">
                  {formatTime(currentTime)} /{' '}
                  {duration > 0
                    ? formatTime(duration)
                    : currentSong?.duration || '0:00'}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Scrubber */}
          <div className="mb-3 px-1">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className="portal-slider w-full"
              aria-label="Seek timeline"
            />
            <div className="font-space-mono mt-1.5 flex justify-between text-[9px] tracking-[0.15em] text-white/60">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40">// TIMELINE SCRUB //</span>
              <span>
                {duration > 0
                  ? formatTime(duration)
                  : currentSong?.duration || '0:00'}
              </span>
            </div>
          </div>

          {/* Core Playback Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 my-2">
            <button
              onClick={toggleShuffle}
              className={`p-2 transition-colors border border-transparent ${
                isShuffle
                  ? 'border-white/60 bg-white/20 text-white'
                  : 'text-white/50 hover:text-white hover:border-white/30'
              }`}
              title="Toggle Shuffle"
              aria-label="Toggle Shuffle"
            >
              <Shuffle size={16} />
            </button>

            <button
              onClick={previous}
              className="p-2 text-white/80 transition-colors hover:text-white hover:bg-white/10 border border-white/20 active:translate-y-0.5"
              title="Previous Track"
              aria-label="Previous Track"
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={togglePlay}
              className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center border-2 border-white bg-white/15 text-white shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all hover:bg-white/30 hover:scale-105 active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>

            <button
              onClick={next}
              className="p-2 text-white/80 transition-colors hover:text-white hover:bg-white/10 border border-white/20 active:translate-y-0.5"
              title="Next Track"
              aria-label="Next Track"
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-2 transition-colors border border-transparent ${
                repeatMode !== 'off'
                  ? 'border-white/60 bg-white/20 text-white'
                  : 'text-white/50 hover:text-white hover:border-white/30'
              }`}
              title={`Repeat: ${repeatMode.toUpperCase()}`}
              aria-label={`Repeat: ${repeatMode.toUpperCase()}`}
            >
              {repeatIcon()}
            </button>
          </div>

          {/* Volume + Utility Action Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.7)}
                className="text-white/60 hover:text-white p-1"
                aria-label="Toggle mute"
              >
                {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="portal-slider-sm w-16 sm:w-20"
                aria-label="Volume slider"
              />
              <span className="font-space-mono text-[8px] text-white/50 w-6">
                {Math.round(volume * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Purge current song button */}
              {currentSong && (
                <button
                  onClick={() => handleRequestDelete(currentSong)}
                  className="font-space-mono flex items-center gap-1 border border-red-400/40 bg-red-900/20 px-2 py-1.5 text-[9px] tracking-[0.1em] text-red-200 uppercase transition-all hover:border-red-400 hover:bg-red-800/40"
                  title="Purge current track record"
                >
                  <Trash2 size={11} className="text-red-300" />
                  PURGE
                </button>
              )}

              {/* Share link button */}
              <button
                onClick={handleShare}
                className="font-space-mono flex items-center gap-1.5 border border-white/30 bg-white/5 px-2.5 py-1.5 text-[9px] tracking-[0.15em] text-white/80 uppercase transition-all hover:bg-white/15 hover:text-white hover:border-white/60"
                title="Copy shareable portal link"
              >
                {copied ? (
                  <>
                    <Check size={11} className="text-green-300" />
                    <span className="text-green-300">LINK COPIED!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={11} />
                    SHARE
                  </>
                )}
              </button>

              {/* Upload trigger */}
              <button
                onClick={() => setShowUpload(true)}
                className="font-space-mono flex items-center gap-1.5 border border-white/50 bg-[#463DF5] px-2.5 py-1.5 text-[9px] font-bold tracking-[0.15em] text-white uppercase transition-all hover:bg-white hover:text-[#463DF5]"
              >
                <Plus size={11} />
                + UPLOAD
              </button>
            </div>
          </div>
        </WindowFrame>

        {/* Vertical Dashed Connector Line */}
        <div className="flex flex-col items-center my-1 select-none pointer-events-none">
          <div className="h-4 w-px border-l border-dashed border-white/50" />
          <span className="text-[8px] text-white/50 -mt-0.5">▼</span>
        </div>

        {/* Tracklist Drawer Window */}
        <div>
          <WindowFrame
            title="TRACKLIST ARCHIVE // A-Z"
            noPadding
            className="overflow-hidden shadow-xl"
          >
            {/* Drawer Header Toggle */}
            <button
              onClick={() => setShowTracklist(!showTracklist)}
              className="font-space-mono flex w-full items-center justify-between border-b border-white/20 bg-white/5 px-4 py-2.5 text-[10px] tracking-[0.2em] text-white/80 uppercase transition-colors hover:bg-white/10 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-white/70" />
                <span>
                  {songs.length} TRACK{songs.length !== 1 ? 'S' : ''} ARCHIVED
                </span>
                {searchQuery && (
                  <span className="text-indigo-300 text-[9px]">
                    ({filteredSongs.length} MATCHING)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-white/60">
                <span>{showTracklist ? 'COLLAPSE' : 'EXPAND'}</span>
                {showTracklist ? (
                  <ChevronUp size={13} />
                ) : (
                  <ChevronDown size={13} />
                )}
              </div>
            </button>

            {/* Expandable Track Search & List */}
            {showTracklist && (
              <div>
                {/* Search Bar Input */}
                <div className="flex items-center gap-2 border-b border-white/20 bg-[#2A1FA8]/60 px-3.5 py-2">
                  <Search size={13} className="text-white/60 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="SEARCH ARCHIVE // TITLE, ARTIST, ALBUM..."
                    className="font-space-mono w-full bg-transparent text-[10px] tracking-[0.15em] text-white placeholder-white/40 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-white/50 hover:text-white flex items-center p-0.5"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {loading ? (
                    <div className="font-space-mono py-8 text-center text-[10px] tracking-[0.2em] text-white/50">
                      SCANNING AUDIO CHANNELS...
                    </div>
                  ) : (
                    <TrackList
                      songs={filteredSongs}
                      currentIndex={currentIndex}
                      isPlaying={isPlaying}
                      onSelectTrack={handleSelectFilteredTrack}
                      onRequestDelete={handleRequestDelete}
                      currentSongId={currentSong?.id}
                    />
                  )}
                </div>
              </div>
            )}
          </WindowFrame>
        </div>
      </div>

      {/* ── Fixed Cyber-Terminal Ticker Strip ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <TickerStrip />
      </div>

      {/* ── Mobile-Friendly Upload Modal ── */}
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUploadComplete={fetchSongs}
      />

      {/* ── Secure Delete Track Modal ── */}
      <DeleteTrackModal
        song={songToDelete}
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSongToDelete(null);
        }}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
