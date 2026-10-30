export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  audio_url: string;
  cover_url: string;
  created_at: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

