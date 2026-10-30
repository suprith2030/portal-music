'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { Song } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { FALLBACK_TRACKS } from '@/lib/fallback-tracks';
import useAudioPlayer from '@/hooks/useAudioPlayer';
import WindowFrame from './WindowFrame';
import SineWaveVisualizer from './SineWaveVisualizer';
import TrackList from './TrackList';
import UploadModal from './UploadModal';
import DeleteModal from './DeleteModal';
import TickerStrip from './TickerStrip';
import HalftoneImage from './HalftoneImage';

export default function PortalAudioOS() {
  const [cloudSongs, setCloudSongs] = useState<Song[]>([]);
  const [libraryMode, setLibraryMode] = useState<'cloud' | 'demos'>('cloud');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTracklist, setShowTracklist] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Active playlist based on mode
  const songs =
    libraryMode === 'cloud' && cloudSongs.length > 0
      ? cloudSongs
      : FALLBACK_TRACKS;

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffle,
    repeatMode,
    analyserNode,
    audioError,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    loadTrack,
    loadCustomSource,
  } = useAudioPlayer(songs, currentIndex, setCurrentIndex);

  // Fetch songs from Supabase or use fallback
  const fetchSongs = useCallback(async () => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        console.log('[Portal OS] Fetching songs from Supabase...');
        const { data, error } = await supabase
          .from('songs')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Portal OS] Supabase error:', error);
          throw error;
        }

        console.log('[Portal OS] Received songs from Supabase:', data);
        if (data && data.length > 0) {
          setCloudSongs(data as Song[]);
          setLibraryMode('cloud');
        } else {
          console.log('[Portal OS] Supabase returned 0 rows, showing sample tracks.');
          setCloudSongs([]);
          setLibraryMode('demos');
        }
      } catch (err) {
        console.error('[Portal OS] Failed to query Supabase, falling back to samples:', err);
        setCloudSongs([]);
        setLibraryMode('demos');
      }
    } else {
      console.warn('[Portal OS] Supabase not configured in client environment, showing fallback tracks.');
      setCloudSongs([]);
      setLibraryMode('demos');
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

  const handleSelectTrack = (index: number) => {
    setCurrentIndex(index);
  };

  // Instant local state update when song is purged
  const handleDeleteSuccess = (deletedId: string) => {
    setCloudSongs((prev) => {
      const remaining = prev.filter((s) => s.id !== deletedId);
      if (remaining.length === 0) {
        setLibraryMode('demos');
        setCurrentIndex(0);
      } else if (currentIndex >= remaining.length) {
        setCurrentIndex(Math.max(0, remaining.length - 1));
      }
      return remaining;
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
              <span className={`h-1.5 w-1.5 rounded-none ${isPlaying ? 'bg-green-400 animate-ping' : 'bg-white/50'}`} />
              <span className="font-space-mono text-[8px] tracking-[0.15em] text-white uppercase">
                {isPlaying ? 'ACTIVE STREAM' : 'IDLE WAVE'}
              </span>
            </div>

            <div className="absolute top-2 right-2 border border-white/30 bg-[#3A30D8]/80 px-2 py-0.5">
              <span className="font-space-mono text-[8px] tracking-[0.15em] text-white/80 uppercase">
                PORTAL // 44.1kHz
              </span>
            </div>

            {/* Audio Stream Error Banner Overlay */}
            {audioError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs p-4 text-center border-2 border-red-500/80">
                <div className="flex items-center gap-1.5 text-red-400 mb-1">
                  <AlertTriangle size={16} className="animate-pulse" />
                  <span className="font-orbitron text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase">
                    AUDIO STREAM OFFLINE // 404
                  </span>
                </div>
                <p className="font-space-mono text-[9px] text-white/80 max-w-xs mb-3">
                  {audioError}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadCustomSource('/audio/neon-drift.wav')}
                    className="font-space-mono border border-green-400 bg-green-500/25 px-2.5 py-1.5 text-[8px] font-bold tracking-[0.15em] text-green-300 uppercase hover:bg-green-500/40 transition-colors cursor-pointer"
                  >
                    ▶ PLAY SYNTH DEMO AUDIO
                  </button>
                  {currentSong && !currentSong.id.startsWith('fallback-') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSongToDelete(currentSong);
                        setShowDeleteModal(true);
                      }}
                      className="font-space-mono border border-red-400 bg-red-500/25 px-2.5 py-1.5 text-[8px] tracking-[0.15em] text-red-300 uppercase hover:bg-red-500/40 transition-colors cursor-pointer"
                    >
                      PURGE BROKEN RECORD
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Track Info Overlay (Bottom) */}
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
                  {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : (currentSong?.duration || '0:00')}
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
              <span>{duration > 0 ? formatTime(duration) : (currentSong?.duration || '0:00')}</span>
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
              className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center border-2 border-white bg-white/15 text-white shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all hover:bg-white/30 hover:scale-105 active:scale-95 cursor-pointer"
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
            {/* Volume control */}
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

            {/* Right utility buttons */}
            <div className="flex items-center gap-2">
              {/* Delete Active Track Button */}
              {currentSong && (
                <button
                  type="button"
                  onClick={() => {
                    setSongToDelete(currentSong);
                    setShowDeleteModal(true);
                  }}
                  className="font-space-mono flex items-center gap-1 border border-white/25 bg-white/5 px-2 py-1.5 text-[9px] tracking-[0.1em] text-white/60 uppercase transition-all hover:border-red-400 hover:bg-red-500/15 hover:text-red-300 cursor-pointer"
                  title="Purge active song (Requires Admin PIN)"
                >
                  <Trash2 size={11} />
                  <span className="hidden sm:inline">PURGE</span>
                </button>
              )}

              {/* Share link button */}
              <button
                type="button"
                onClick={handleShare}
                className="font-space-mono flex items-center gap-1.5 border border-white/30 bg-white/5 px-2.5 py-1.5 text-[9px] tracking-[0.15em] text-white/80 uppercase transition-all hover:bg-white/15 hover:text-white hover:border-white/60 cursor-pointer"
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
                type="button"
                onClick={() => setShowUpload(true)}
                className="font-space-mono flex items-center gap-1.5 border border-white/50 bg-[#463DF5] px-2.5 py-1.5 text-[9px] font-bold tracking-[0.15em] text-white uppercase transition-all hover:bg-white hover:text-[#463DF5] cursor-pointer"
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
            title="TRACKLIST DRAWER"
            noPadding
            className="overflow-hidden shadow-xl"
          >
            {/* Drawer Header Toggle & Vault/Demo Switcher */}
            <div className="flex w-full items-center justify-between border-b border-white/20 bg-white/5 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLibraryMode('cloud');
                    setCurrentIndex(0);
                  }}
                  className={`font-space-mono text-[8px] sm:text-[9px] px-2 py-0.5 border tracking-[0.1em] cursor-pointer transition-all ${
                    libraryMode === 'cloud'
                      ? 'border-green-400 bg-green-500/20 text-green-300 font-bold'
                      : 'border-white/20 text-white/50 hover:text-white hover:border-white/40'
                  }`}
                  title="Switch to Cloud Supabase Vault"
                >
                  ● CLOUD VAULT ({cloudSongs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLibraryMode('demos');
                    setCurrentIndex(0);
                  }}
                  className={`font-space-mono text-[8px] sm:text-[9px] px-2 py-0.5 border tracking-[0.1em] cursor-pointer transition-all ${
                    libraryMode === 'demos'
                      ? 'border-indigo-400 bg-indigo-500/30 text-indigo-200 font-bold'
                      : 'border-white/20 text-white/50 hover:text-white hover:border-white/40'
                  }`}
                  title="Switch to Built-in Synthwave Demos"
                >
                  SYNTH DEMOS ({FALLBACK_TRACKS.length})
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowTracklist(!showTracklist)}
                className="font-space-mono flex items-center gap-1 text-[8px] sm:text-[9px] tracking-[0.15em] text-white/60 hover:text-white cursor-pointer px-1 py-0.5"
              >
                <span>{showTracklist ? 'COLLAPSE' : 'EXPAND'}</span>
                {showTracklist ? (
                  <ChevronUp size={13} />
                ) : (
                  <ChevronDown size={13} />
                )}
              </button>
            </div>

            {/* Expandable list */}
            {showTracklist && (
              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="font-space-mono py-8 text-center text-[10px] tracking-[0.2em] text-white/50">
                    SCANNING AUDIO CHANNELS...
                  </div>
                ) : (
                  <TrackList
                    songs={songs}
                    currentIndex={currentIndex}
                    isPlaying={isPlaying}
                    onSelectTrack={handleSelectTrack}
                    onDeleteTrack={(song) => {
                      setSongToDelete(song);
                      setShowDeleteModal(true);
                    }}
                  />
                )}
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
        onUploadComplete={() => {
          fetchSongs();
          setLibraryMode('cloud');
          setCurrentIndex(0);
        }}
      />

      {/* ── Secure Delete Track Modal ── */}
      <DeleteModal
        isOpen={showDeleteModal}
        song={songToDelete}
        onClose={() => {
          setShowDeleteModal(false);
          setSongToDelete(null);
        }}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
