'use client';

import React, { useMemo } from 'react';

/**
 * Mood-based bot expressions for the retro-futuristic player.
 *
 * States:
 *   - idle:     No song loaded, sleeping face (zzZ)
 *   - playing:  Vibing, dancing, happy expressions
 *   - paused:   Curious, waiting, blinking
 *   - loading:  Buffering, searching
 *   - error:    Sad, broken, glitching
 *   - shuffle:  Dizzy, wild, random excitement
 */

type MoodBotProps = {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  hasError: boolean;
  isShuffle: boolean;
  hasSong: boolean;
  /** Progress 0-1 through the track for mid-song expression transitions */
  progress: number;
};

// Expression sets with multiple variants for variety
const EXPRESSIONS = {
  idle: {
    faces: ['(  ̳• · • ̳)', '( ᴗ̤ .̮ ᴗ̤ )', '( ˘ ᵕ ˘ )', '(  ₋ᴗ₋  )'],
    bubbles: [
      'zzZ… waiting for tunes',
      'load a song, human!',
      'the archive is quiet…',
      '*yawns in 8-bit*',
    ],
    color: 'text-white/50',
    bgColor: 'bg-white/5',
    borderColor: 'border-white/20',
    emoji: '💤',
  },
  playing: {
    faces: ['♪ (◕‿◕) ♪', '₊˚ʚ(◠‿◠)ɞ˚₊', '♫ \\(^o^)/ ♫', '(ノ◕ヮ◕)ノ♪', '(˶ᵔ ᵕ ᵔ˶)'],
    bubbles: [
      'vibing so hard rn !!',
      'this beat is fire 🔥',
      'dancing in the matrix~',
      'frequency locked in ✨',
      'volume UP, world OFF',
    ],
    color: 'text-green-300',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/40',
    emoji: '🎵',
  },
  paused: {
    faces: ['(  ° ᴗ °  )', '( ˙▿˙ )', '(•̀ᴗ•́)', '(  ̤ᴗ ̤ )'],
    bubbles: [
      'hmm? why did we stop?',
      'press play, I dare u',
      '*taps foot impatiently*',
      'the silence is loud…',
    ],
    color: 'text-yellow-200',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    emoji: '⏸',
  },
  loading: {
    faces: ['( ◉ ᴗ ◉ )', '(⊙_⊙)', '( •̀ ᴗ •́ )✧'],
    bubbles: [
      'scanning frequencies…',
      'loading sonic data…',
      'connecting to archive…',
    ],
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-400/10',
    borderColor: 'border-cyan-400/30',
    emoji: '📡',
  },
  error: {
    faces: ['(╥_╥)', '(ᗒᗩᗕ)', '(  ；ᗝ；  )', '(ノ_<。)'],
    bubbles: [
      'ow!! signal lost…',
      'audio file is MIA!',
      'something broke (╥_╥)',
      '*static noises* help!!',
    ],
    color: 'text-red-300',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
    emoji: '💔',
  },
  shuffle: {
    faces: ['(≧◡≦)', '(ᗒᗨᗕ)', '(⌐■_■)', '\\(★ω★)/'],
    bubbles: [
      'random mode go brrr!',
      'surprise me, matrix!',
      'chaos is beautiful ✨',
      'shuffle = adventure!',
    ],
    color: 'text-purple-300',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
    emoji: '🎲',
  },
} as const;

type MoodKey = keyof typeof EXPRESSIONS;

export default function MoodBot({
  isPlaying,
  isPaused,
  isLoading,
  hasError,
  isShuffle,
  hasSong,
  progress,
}: MoodBotProps) {
  // Determine current mood
  const mood: MoodKey = useMemo(() => {
    if (hasError) return 'error';
    if (isLoading) return 'loading';
    if (!hasSong) return 'idle';
    if (isPlaying && isShuffle) return 'shuffle';
    if (isPlaying) return 'playing';
    if (isPaused) return 'paused';
    return 'idle';
  }, [isPlaying, isPaused, isLoading, hasError, isShuffle, hasSong]);

  // Pick a variant from the set deterministically based on progress so it changes mid-song
  const variantIndex = useMemo(() => {
    const expr = EXPRESSIONS[mood];
    return Math.floor(progress * 10) % expr.faces.length;
  }, [mood, progress]);

  const expr = EXPRESSIONS[mood];
  const face = expr.faces[variantIndex % expr.faces.length];
  const bubble = expr.bubbles[variantIndex % expr.bubbles.length];

  // Animation class based on mood
  const animClass = useMemo(() => {
    if (mood === 'playing' || mood === 'shuffle') return 'animate-bounce';
    if (mood === 'loading') return 'animate-pulse';
    if (mood === 'error') return 'animate-pulse';
    return '';
  }, [mood]);

  return (
    <div
      className={`flex items-center gap-2.5 border ${expr.borderColor} ${expr.bgColor} backdrop-blur-xs px-3 py-2 transition-all duration-500 select-none`}
    >
      {/* Bot Face */}
      <div
        className={`${animClass} shrink-0 text-center`}
        style={{ minWidth: '2.5rem' }}
      >
        <div className="text-lg leading-none" aria-hidden="true">
          {expr.emoji}
        </div>
        <div
          className={`font-space-mono text-[9px] ${expr.color} mt-0.5 tracking-tight whitespace-nowrap`}
        >
          {face}
        </div>
      </div>

      {/* Speech Bubble */}
      <div className="relative min-w-0 flex-1">
        {/* Triangle pointer */}
        <div
          className={`absolute -left-1 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[5px] ${
            mood === 'playing'
              ? 'border-r-green-400/40'
              : mood === 'error'
              ? 'border-r-red-400/30'
              : mood === 'shuffle'
              ? 'border-r-purple-400/30'
              : 'border-r-white/20'
          }`}
        />
        <div
          className={`font-space-mono text-[8px] ${expr.color} tracking-[0.1em] uppercase truncate pl-1`}
        >
          {bubble}
        </div>
      </div>

      {/* Mood Indicator Bar */}
      <div className="shrink-0 flex flex-col items-center gap-0.5">
        <div className="flex gap-px">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`w-1 transition-all duration-300 ${
                mood === 'playing'
                  ? 'bg-green-400'
                  : mood === 'shuffle'
                  ? 'bg-purple-400'
                  : mood === 'error'
                  ? 'bg-red-400'
                  : mood === 'paused'
                  ? 'bg-yellow-400'
                  : 'bg-white/30'
              }`}
              style={{
                height:
                  mood === 'playing' || mood === 'shuffle'
                    ? `${4 + Math.sin((progress * 20 + i * 1.5) * Math.PI) * 4}px`
                    : '3px',
                opacity: mood === 'idle' ? 0.3 : 0.7 + i * 0.06,
              }}
            />
          ))}
        </div>
        <span className="font-space-mono text-[6px] text-white/30 uppercase tracking-widest">
          MOOD
        </span>
      </div>
    </div>
  );
}
