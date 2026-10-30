'use client';

import React, { useState, useRef } from 'react';
import { Music, Image as ImageIcon, Loader2, CheckCircle2, AlertTriangle, Disc3 } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import WindowFrame from './WindowFrame';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface CloudinaryResponse {
  secure_url: string;
  duration?: number;
  error?: {
    message: string;
  };
}

interface ID3Metadata {
  title?: string;
  artist?: string;
  album?: string;
  embeddedCover?: File;
  coverPreviewUrl?: string;
}

export default function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  const [pin, setPin] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [embeddedCover, setEmbeddedCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [detectedTags, setDetectedTags] = useState<ID3Metadata | null>(null);
  const [readingTags, setReadingTags] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPin('');
    setTitle('');
    setArtist('');
    setAlbum('');
    setAudioFile(null);
    setCoverFile(null);
    setEmbeddedCover(null);
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverPreview(null);
    setDetectedTags(null);
    setReadingTags(false);
    setUploading(false);
    setProgress(0);
    setStatus('');
    setSuccess(false);
    setError('');
  };

  const handleClose = () => {
    if (!uploading) {
      reset();
      onClose();
    }
  };

  /**
   * Parse ID3 tags (title, artist, album, picture) from a local audio file
   * using jsmediatags (loaded via browser dist bundle to prevent SSR conflicts).
   */
  async function parseID3Tags(file: File): Promise<ID3Metadata> {
    return new Promise(async (resolve) => {
      try {
        // Dynamically import the browser distribution bundle of jsmediatags
        // @ts-expect-error - jsmediatags browser dist bundle
        const jsmediatagsModule = await import('jsmediatags/dist/jsmediatags.min.js');
        const reader = jsmediatagsModule.default || jsmediatagsModule;

        if (!reader || typeof reader.read !== 'function') {
          resolve({});
          return;
        }

        reader.read(file, {
          onSuccess: (tag: {
            tags?: {
              title?: string;
              artist?: string;
              album?: string;
              picture?: { format?: string; data?: number[] };
            };
          }) => {
            const { title: rawTitle, artist: rawArtist, album: rawAlbum, picture } = tag.tags || {};
            let extractedCover: File | undefined = undefined;
            let previewUrl: string | undefined = undefined;

            if (picture && picture.data && picture.data.length > 0) {
              try {
                const byteArray = new Uint8Array(picture.data);
                const format = picture.format || 'image/jpeg';
                const ext = format.split('/')[1] || 'jpg';
                const blob = new Blob([byteArray], { type: format });
                extractedCover = new File([blob], `embedded-art.${ext}`, {
                  type: format,
                });
                previewUrl = URL.createObjectURL(blob);
              } catch (e) {
                console.warn('Could not parse embedded artwork:', e);
              }
            }

            resolve({
              title: rawTitle ? String(rawTitle).trim() : undefined,
              artist: rawArtist ? String(rawArtist).trim() : undefined,
              album: rawAlbum ? String(rawAlbum).trim() : undefined,
              embeddedCover: extractedCover,
              coverPreviewUrl: previewUrl,
            });
          },
          onError: (err: unknown) => {
            console.warn('jsmediatags reader note:', err);
            resolve({});
          },
        });
      } catch (err) {
        console.warn('jsmediatags error:', err);
        resolve({});
      }
    });
  }

  function cleanFileName(fileName: string): string {
    const base = fileName.replace(/\.[^/.]+$/, '');
    return base.trim() || 'Untitled Track';
  }

  /**
   * Handle audio file selection and automatically extract ID3 metadata.
   */
  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAudioFile(file);

    if (!file) {
      setDetectedTags(null);
      setEmbeddedCover(null);
      setCoverPreview(null);
      return;
    }

    setReadingTags(true);
    const tags = await parseID3Tags(file);
    setDetectedTags(tags);
    setReadingTags(false);

    // Auto-populate inputs if currently empty
    if (!title.trim()) {
      if (tags.title) {
        setTitle(tags.title);
      } else {
        setTitle(cleanFileName(file.name));
      }
    }

    if (!artist.trim() && tags.artist) {
      setArtist(tags.artist);
    }

    if (!album.trim() && tags.album) {
      setAlbum(tags.album);
    }

    // Auto-assign embedded cover if no manual cover selected
    if (tags.embeddedCover) {
      setEmbeddedCover(tags.embeddedCover);
      if (!coverFile && tags.coverPreviewUrl) {
        setCoverPreview(tags.coverPreviewUrl);
      }
    }
  };

  /**
   * Handle manual cover art selection.
   */
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);
    if (file) {
      setCoverPreview(URL.createObjectURL(file));
    } else if (embeddedCover && detectedTags?.coverPreviewUrl) {
      setCoverPreview(detectedTags.coverPreviewUrl);
    } else {
      setCoverPreview(null);
    }
  };

  /**
   * Direct unsigned browser upload to Cloudinary using XMLHttpRequest
   * to preserve the real-time upload progress bar.
   */
  function uploadToCloudinary(
    file: File,
    cloudName: string,
    uploadPreset: string,
    onProgress: (pct: number) => void
  ): Promise<CloudinaryResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

      xhr.open('POST', url, true);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const data: CloudinaryResponse = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
            resolve(data);
          } else {
            const errMsg = data?.error?.message || `Cloudinary upload failed (${xhr.status})`;
            reject(new Error(errMsg));
          }
        } catch {
          reject(new Error(`Invalid response received from Cloudinary (${xhr.status})`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during file transmission to Cloudinary'));
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      xhr.send(formData);
    });
  }

  function getAudioDuration(file: File): Promise<string> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        const mins = Math.floor(audio.duration / 60);
        const secs = Math.floor(audio.duration % 60);
        resolve(`${mins}:${secs.toString().padStart(2, '0')}`);
        URL.revokeObjectURL(audio.src);
      });
      audio.addEventListener('error', () => resolve('3:00'));
      audio.src = URL.createObjectURL(file);
    });
  }

  function formatSecondsToDuration(sec: number): string {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) return;

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      // 1. Verify Admin PIN (accepts configured env pin, 'suprith2030', or default '2026')
      const expectedPin = (process.env.NEXT_PUBLIC_ADMIN_PIN || '2026')
        .replace(/^["']|["']$/g, '')
        .trim();
      const entered = pin.trim();
      if (entered !== expectedPin && entered !== '2026' && entered !== 'suprith2030') {
        throw new Error(`Invalid Admin PIN.`);
      }

      // 2. Validate Cloudinary configuration
      const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '')
        .replace(/^["']|["']$/g, '')
        .trim();
      const uploadPreset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '')
        .replace(/^["']|["']$/g, '')
        .trim();

      if (!cloudName || !uploadPreset) {
        throw new Error(
          'Cloudinary is not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local.'
        );
      }

      // 3. Fallback resolution for metadata if fields were left blank:
      // Title: user input -> ID3 title -> clean filename without extension
      const finalTitle =
        title.trim() ||
        detectedTags?.title ||
        cleanFileName(audioFile.name);

      // Artist: user input -> ID3 artist -> "Unknown Artist"
      const finalArtist =
        artist.trim() ||
        detectedTags?.artist ||
        'Unknown Artist';

      // Album: user input -> ID3 album -> "Single"
      const finalAlbum =
        album.trim() ||
        detectedTags?.album ||
        'Single';

      // 4. Determine cover art file to upload:
      // Priority: embedded MP3 cover -> optional cover image upload -> retro placeholder
      const targetCoverFile = embeddedCover || coverFile || null;

      // 5. Pre-read local audio duration as fallback
      const localDuration = await getAudioDuration(audioFile);

      // 6. Upload audio directly to Cloudinary
      setStatus('TRANSMITTING AUDIO TO CLOUDINARY...');
      const audioResult = await uploadToCloudinary(
        audioFile,
        cloudName,
        uploadPreset,
        (pct) => {
          const maxPct = targetCoverFile ? 70 : 90;
          setProgress(Math.round((pct / 100) * maxPct));
        }
      );

      // 7. Upload cover image if available, else use default retro placeholder
      let coverUrl = '';
      if (targetCoverFile) {
        setStatus('TRANSMITTING COVER ART TO CLOUDINARY...');
        const coverResult = await uploadToCloudinary(
          targetCoverFile,
          cloudName,
          uploadPreset,
          (pct) => {
            setProgress(70 + Math.round((pct / 100) * 20));
          }
        );
        coverUrl = coverResult.secure_url;
      } else {
        coverUrl = '/covers/cyber-pineapple.svg';
        setProgress(90);
      }

      // Determine final duration (prefer Cloudinary reported duration if available)
      const finalDuration =
        audioResult.duration && audioResult.duration > 0
          ? formatSecondsToDuration(audioResult.duration)
          : localDuration;

      // 8. Write metadata row to Supabase via server API route (most reliable on Vercel deployments)
      setStatus('ARCHIVING METADATA IN SUPABASE...');
      let saved = false;
      let saveErrorMessage = '';

      // Primary: Call server-side /api/songs route
      try {
        const res = await fetch('/api/songs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: finalTitle,
            artist: finalArtist,
            album: finalAlbum,
            duration: finalDuration,
            audio_url: audioResult.secure_url,
            cover_url: coverUrl,
          }),
        });

        const resData = await res.json().catch(() => ({}));
        if (res.ok && resData.success) {
          saved = true;
        } else {
          saveErrorMessage = resData?.error || `Server responded with ${res.status}`;
        }
      } catch (apiErr) {
        saveErrorMessage = apiErr instanceof Error ? apiErr.message : 'Network failure';
      }

      // Fallback: Direct client Supabase call if available
      if (!saved) {
        const client = getSupabase();
        if (client) {
          const { error: dbError } = await client.from('songs').insert({
            title: finalTitle,
            artist: finalArtist,
            album: finalAlbum,
            duration: finalDuration,
            audio_url: audioResult.secure_url,
            cover_url: coverUrl,
          });
          if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
          }
          saved = true;
        }
      }

      // If both server route and client fallback could not save, fail fast with a clear error
      if (!saved) {
        throw new Error(
          `Failed to save song to Supabase: ${saveErrorMessage || 'Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'}`
        );
      }

      setProgress(100);
      setStatus('PORTAL UPLOAD COMPLETE // SEQUENCE LOCKED');
      setSuccess(true);

      setTimeout(() => {
        onUploadComplete();
        handleClose();
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload transmission failed');
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md">
        <WindowFrame
          title="INITIALIZE UPLOAD // CLOUDINARY"
          onClose={uploading ? undefined : handleClose}
        >
          {/* Info Banner */}
          <div className="mb-4 border border-white/20 bg-white/5 p-2.5">
            <p className="font-space-mono text-[9px] tracking-[0.1em] text-white/70">
              DIRECT CLOUDINARY BROWSER TRANSMISSION. ID3 metadata & embedded artwork auto-extracted from MP3 files.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* PIN */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-space-mono text-[9px] tracking-[0.2em] text-white/80 uppercase">
                  SECURITY PIN
                </label>
                <span className="font-space-mono text-[8px] text-white/40">
                  DEFAULT: 2026
                </span>
              </div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="font-space-mono w-full border border-white/40 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white focus:outline-none transition-colors"
                placeholder="Enter PIN (e.g. 2026)..."
                required
                disabled={uploading}
              />
            </div>

            {/* Title & Artist */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-space-mono text-[9px] tracking-[0.2em] text-white/80 uppercase">
                    TRACK TITLE
                  </label>
                  <span className="font-space-mono text-[7px] text-white/40 uppercase">
                    AUTO ID3
                  </span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-space-mono w-full border border-white/40 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white focus:outline-none transition-colors"
                  placeholder={audioFile ? cleanFileName(audioFile.name) : 'Auto from ID3 / name'}
                  disabled={uploading}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-space-mono text-[9px] tracking-[0.2em] text-white/80 uppercase">
                    ARTIST
                  </label>
                  <span className="font-space-mono text-[7px] text-white/40 uppercase">
                    AUTO ID3
                  </span>
                </div>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="font-space-mono w-full border border-white/40 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white focus:outline-none transition-colors"
                  placeholder="Auto or Unknown Artist"
                  disabled={uploading}
                />
              </div>
            </div>

            {/* Album */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-space-mono text-[9px] tracking-[0.2em] text-white/80 uppercase">
                  ALBUM / RELEASE
                </label>
                <span className="font-space-mono text-[7px] text-white/40 uppercase">
                  AUTO ID3
                </span>
              </div>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="font-space-mono w-full border border-white/40 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white focus:outline-none transition-colors"
                placeholder="Auto or 'Single'..."
                disabled={uploading}
              />
            </div>

            {/* File Selectors */}
            <div className="grid grid-cols-2 gap-3">
              {/* Audio Selector */}
              <div>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,audio/*"
                  onChange={handleAudioSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className={`font-space-mono flex w-full items-center justify-center gap-1.5 border px-2 py-2.5 text-[9px] tracking-[0.15em] uppercase transition-all ${
                    audioFile
                      ? 'border-green-400 bg-green-500/20 text-green-300 font-bold'
                      : 'border-white/40 bg-white/5 text-white/70 hover:border-white hover:text-white'
                  }`}
                  disabled={uploading}
                >
                  {readingTags ? (
                    <Loader2 size={13} className="animate-spin text-white" />
                  ) : (
                    <Music size={13} />
                  )}
                  <span className="truncate">
                    {readingTags
                      ? 'READING ID3...'
                      : audioFile
                      ? audioFile.name
                      : 'SELECT AUDIO (.MP3)'}
                  </span>
                </button>
              </div>

              {/* Cover Art Selector with Thumbnail Preview */}
              <div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className={`font-space-mono flex w-full items-center justify-center gap-1.5 border px-2 py-2.5 text-[9px] tracking-[0.15em] uppercase transition-all ${
                    coverPreview
                      ? 'border-indigo-300 bg-indigo-500/20 text-white font-bold'
                      : 'border-white/40 bg-white/5 text-white/70 hover:border-white hover:text-white'
                  }`}
                  disabled={uploading}
                >
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover Preview"
                      className="h-4 w-4 object-cover border border-white/60"
                    />
                  ) : (
                    <ImageIcon size={13} />
                  )}
                  <span className="truncate">
                    {coverFile
                      ? coverFile.name
                      : embeddedCover
                      ? 'EMBEDDED COVER'
                      : 'COVER ART'}
                  </span>
                </button>
              </div>
            </div>

            {/* ID3 Extraction Status Tag */}
            {detectedTags && (
              <div className="font-space-mono flex items-center justify-between border border-white/20 bg-white/5 px-2.5 py-1.5 text-[8px] tracking-[0.1em] text-white/80">
                <div className="flex items-center gap-1.5 truncate">
                  <Disc3 size={11} className="text-indigo-300 shrink-0" />
                  <span className="truncate">
                    ID3: {detectedTags.title || 'No Title'} // {detectedTags.artist || 'No Artist'}
                  </span>
                </div>
                {embeddedCover && (
                  <span className="shrink-0 text-green-300 font-bold ml-2">
                    [ARTWORK ✓]
                  </span>
                )}
              </div>
            )}

            {/* Progress Bar & Sequence Status */}
            {uploading && (
              <div className="space-y-1.5 border border-white/30 bg-[#2A1FA8]/60 p-2.5">
                <div className="h-2 w-full overflow-hidden border border-white/30 bg-black/40">
                  <div
                    className="h-full bg-white transition-all duration-300 shadow-[0_0_8px_white]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="font-space-mono flex items-center justify-between text-[8px] tracking-[0.15em] text-white">
                  <div className="flex items-center gap-1.5 truncate">
                    {success ? (
                      <CheckCircle2 size={11} className="text-green-400" />
                    ) : (
                      <Loader2 size={11} className="animate-spin text-white" />
                    )}
                    <span className="truncate">{status}</span>
                  </div>
                  <span className="shrink-0">{progress}%</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="font-space-mono flex items-start gap-2 border border-red-400/80 bg-red-950/40 p-2.5 text-[9px] text-red-200">
                <AlertTriangle size={13} className="shrink-0 text-red-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={uploading || !audioFile}
              className="font-orbitron w-full border-2 border-white bg-white/20 py-2.5 text-xs font-bold tracking-[0.25em] text-white uppercase transition-all hover:bg-white hover:text-[#463DF5] disabled:opacity-40 disabled:hover:bg-white/20 disabled:hover:text-white cursor-pointer disabled:cursor-not-allowed shadow-[0_0_10px_rgba(255,255,255,0.2)]"
            >
              {uploading ? 'TRANSMITTING...' : '▶ TRANSMIT TO CLOUDINARY'}
            </button>
          </form>
        </WindowFrame>
      </div>
    </div>
  );
}
