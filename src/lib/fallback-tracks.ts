import type { Song } from '@/types';

export const FALLBACK_TRACKS: Song[] = [
  {
    id: 'fallback-1',
    title: 'NEON DRIFT',
    artist: 'SYNTHKORE',
    album: 'Cyber Dreams Vol. 1',
    duration: '0:30',
    audio_url: '/audio/neon-drift.wav',
    cover_url: '/covers/cyber-pineapple.svg',
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-2',
    title: 'MIDNIGHT PROTOCOL',
    artist: 'DATAVOID',
    album: 'Terminal Access',
    duration: '0:30',
    audio_url: '/audio/midnight-protocol.wav',
    cover_url: '/covers/cyber-hand.svg',
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-3',
    title: 'CRYSTALLINE GRID',
    artist: 'PORTAL SYSTEMS',
    album: 'AUDIO OS',
    duration: '0:30',
    audio_url: '/audio/crystalline-grid.wav',
    cover_url: '/covers/crystal-portal.svg',
    created_at: new Date().toISOString(),
  },
];
