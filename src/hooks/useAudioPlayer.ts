'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Song, RepeatMode } from '@/types';

export default function useAudioPlayer(
  songs: Song[],
  currentIndex: number,
  setCurrentIndex: Dispatch<SetStateAction<number>>
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const contextInitRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');

  // Expose analyserNode directly as state-like value for canvas visualizer
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Create the <audio> element once
  useEffect(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = 'metadata';
      el.crossOrigin = 'anonymous';
      audioRef.current = el;
    }

    const audio = audioRef.current;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Initialize Web Audio API on first user gesture
  const initAudioContext = useCallback(() => {
    if (contextInitRef.current || !audioRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setAnalyserNode(analyser);
      contextInitRef.current = true;
    } catch (e) {
      console.warn('AudioContext initialization note:', e);
    }
  }, []);

  // ─── Playback ───
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Ensure audio has a source if not set yet
    if (!audio.src && songs.length > 0 && songs[currentIndex]?.audio_url) {
      audio.src = songs[currentIndex].audio_url;
      audio.load();
    }

    if (!audio.src) return;

    initAudioContext();
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    try {
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error('Playback error:', e);
    }
  }, [initAudioContext, songs, currentIndex]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  // ─── Track loading ───
  const loadTrack = useCallback((song: Song) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (song.audio_url && audio.src !== song.audio_url) {
      audio.src = song.audio_url;
      audio.load();
    }
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // ─── Navigation ───
  const getRandomIndex = useCallback(
    (exclude: number) => {
      if (songs.length <= 1) return 0;
      let r: number;
      do {
        r = Math.floor(Math.random() * songs.length);
      } while (r === exclude);
      return r;
    },
    [songs.length]
  );

  const next = useCallback(() => {
    if (songs.length === 0) return;
    if (isShuffle) {
      setCurrentIndex(getRandomIndex(currentIndex));
    } else {
      setCurrentIndex((currentIndex + 1) % songs.length);
    }
  }, [songs.length, currentIndex, isShuffle, getRandomIndex, setCurrentIndex]);

  const previous = useCallback(() => {
    if (songs.length === 0) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (isShuffle) {
      setCurrentIndex(getRandomIndex(currentIndex));
    } else {
      setCurrentIndex((currentIndex - 1 + songs.length) % songs.length);
    }
  }, [songs.length, currentIndex, isShuffle, getRandomIndex, setCurrentIndex]);

  // ─── Auto advance on track ended ───
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      if (isShuffle) {
        setCurrentIndex(getRandomIndex(currentIndex));
        return;
      }
      const nextIdx = currentIndex + 1;
      if (nextIdx >= songs.length) {
        if (repeatMode === 'all') {
          setCurrentIndex(0);
        } else {
          setIsPlaying(false);
        }
      } else {
        setCurrentIndex(nextIdx);
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [
    songs.length,
    currentIndex,
    repeatMode,
    isShuffle,
    getRandomIndex,
    setCurrentIndex,
  ]);

  // Auto-play on track change if was already playing
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    wasPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onCanPlay = () => {
      if (wasPlayingRef.current) {
        audio.play().catch(() => {});
      }
    };
    audio.addEventListener('canplay', onCanPlay);
    return () => audio.removeEventListener('canplay', onCanPlay);
  }, []);

  // ─── Seek & Volume ───
  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || 0));
    setCurrentTime(audio.currentTime);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    if (audioRef.current) audioRef.current.volume = clamped;
    setVolumeState(clamped);
  }, []);

  const toggleShuffle = useCallback(() => setIsShuffle((p) => !p), []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((p) => {
      if (p === 'off') return 'all';
      if (p === 'all') return 'one';
      return 'off';
    });
  }, []);

  // ─── Browser navigator.mediaSession API (Mobile Lock Screen Controls) ───
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('mediaSession' in navigator) ||
      songs.length === 0
    ) {
      return;
    }
    if (currentIndex < 0 || currentIndex >= songs.length) return;

    const song = songs[currentIndex];

    try {
      const fullArtworkUrl = song.cover_url
        ? new URL(song.cover_url, window.location.origin).href
        : '';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'PORTAL AUDIO',
        artist: song.artist || 'SYSTEM OS',
        album: song.album || 'PORTAL',
        artwork: fullArtworkUrl
          ? [
              { src: fullArtworkUrl, sizes: '96x96', type: 'image/svg+xml' },
              { src: fullArtworkUrl, sizes: '256x256', type: 'image/svg+xml' },
              { src: fullArtworkUrl, sizes: '512x512', type: 'image/svg+xml' },
            ]
          : [],
      });

      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => previous());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('seekto', (d) => {
        if (d.seekTime != null) seek(d.seekTime);
      });
    } catch (e) {
      console.warn('MediaSession handler setup:', e);
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      } catch {}
    };
  }, [songs, currentIndex, play, pause, next, previous, seek]);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffle,
    repeatMode,
    analyserNode,
    play,
    pause,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    loadTrack,
  };
}
