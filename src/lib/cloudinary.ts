import { v2 as cloudinary } from 'cloudinary';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Configure and return Cloudinary SDK instance if API Key and Secret are present.
 */
export function getCloudinaryClient() {
  const cloudName = (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    ''
  ).replace(/^["']|["']$/g, '').trim();

  const apiKey = (
    process.env.CLOUDINARY_API_KEY ||
    process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ||
    ''
  ).replace(/^["']|["']$/g, '').trim();

  const apiSecret = (
    process.env.CLOUDINARY_API_SECRET ||
    ''
  ).replace(/^["']|["']$/g, '').trim();

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return cloudinary;
  }
  return null;
}

/**
 * Extract the Cloudinary public_id from any Cloudinary URL.
 * Example: https://res.cloudinary.com/gpgcgup5/video/upload/v1793373985/my_folder/track_1.mp3 -> "my_folder/track_1"
 */
export function extractPublicId(url?: string | null): string | null {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    // Strip version prefix if present, e.g. v1793373985/
    const withoutVersion = parts[1].replace(/^v\d+\//, '');
    // Strip file extension (.mp3, .wav, .m4a, .jpg, etc.)
    return withoutVersion.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}

/**
 * Delete a file directly from Cloudinary storage.
 */
export async function deleteFromCloudinary(
  url?: string | null,
  resourceType: 'video' | 'image' = 'video'
): Promise<boolean> {
  const client = getCloudinaryClient();
  if (!client) {
    console.warn(
      'Cloudinary API credentials (CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) not found. Remote Cloudinary asset deletion skipped.'
    );
    return false;
  }

  const publicId = extractPublicId(url);
  if (!publicId) return false;

  try {
    const res = await client.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    console.log(`Cloudinary destroy (${resourceType}) for "${publicId}":`, res);
    return res.result === 'ok';
  } catch (err) {
    console.error(`Failed to destroy Cloudinary asset "${publicId}":`, err);
    return false;
  }
}

/**
 * Two-way Sync:
 * Scans Cloudinary for any audio files (including tracks uploaded directly in the Cloudinary web console)
 * and automatically adds them to Supabase so they appear in the app immediately.
 */
export async function syncCloudinaryToSupabase(supabase: SupabaseClient | null) {
  const client = getCloudinaryClient();
  if (!client || !supabase) return [];

  try {
    // Audio files in Cloudinary are categorized under resource_type: 'video'
    const result = await client.api.resources({
      resource_type: 'video',
      max_results: 100,
    });

    const resources = result.resources || [];
    const validAudioFormats = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'opus'];

    // Filter for audio resources
    const audioAssets = resources.filter((r: { format?: string; is_audio?: boolean }) => {
      const fmt = (r.format || '').toLowerCase();
      return validAudioFormats.includes(fmt) || Boolean(r.is_audio);
    });

    // Check each audio asset against Supabase
    for (const asset of audioAssets) {
      const secureUrl = asset.secure_url;
      if (!secureUrl) continue;

      const { data: existing } = await supabase
        .from('songs')
        .select('id')
        .eq('audio_url', secureUrl)
        .limit(1);

      if (!existing || existing.length === 0) {
        // Clean filename into title
        const filename = (asset.public_id || '').split('/').pop() || 'UNTITLED AUDIO';
        const cleanTitle = filename
          .replace(/[-_]/g, ' ')
          .replace(/\.[^/.]+$/, '')
          .toUpperCase()
          .trim();

        const durationSec = Math.round(asset.duration || 180);
        const mins = Math.floor(durationSec / 60);
        const secs = Math.floor(durationSec % 60);
        const formattedDuration = `${mins}:${secs.toString().padStart(2, '0')}`;

        // Insert track into Supabase so it reflects in the app
        await supabase.from('songs').insert({
          title: cleanTitle,
          artist: 'Cloudinary Library',
          album: 'Cloudinary Uploads',
          duration: formattedDuration,
          audio_url: secureUrl,
          cover_url: '/covers/cyber-pineapple.svg',
        });
      }
    }

    return audioAssets;
  } catch (err) {
    console.warn('Cloudinary two-way sync note:', err);
    return [];
  }
}
