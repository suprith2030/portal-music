import { v2 as cloudinary } from 'cloudinary';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Configure and return Cloudinary SDK instance if API Key and Secret are present.
 * Supports both individual variables and full CLOUDINARY_URL.
 */
export function getCloudinaryClient() {
  const cloudinaryUrl = (process.env.CLOUDINARY_URL || '').trim();
  if (cloudinaryUrl && cloudinaryUrl.startsWith('cloudinary://')) {
    cloudinary.config({
      cloudinary_url: cloudinaryUrl,
      secure: true,
    });
    return cloudinary;
  }

  const cloudName = (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    'gpgcgup5'
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
 * Example: https://res.cloudinary.com/gpgcgup5/video/upload/v1793378161/ovn9mkmlkni77wdfqcrs.mp3 -> "ovn9mkmlkni77wdfqcrs"
 */
export function extractPublicId(url?: string | null): string | null {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    // Strip version prefix if present, e.g. v1793378161/
    const withoutVersion = parts[1].replace(/^v\d+\//, '');
    // Strip file extension (.mp3, .wav, .m4a, .jpg, etc.)
    return withoutVersion.replace(/\.[^/.]+$/, '');
  } catch (err) {
    console.error('Failed to extract public_id from Cloudinary URL:', url, err);
    return null;
  }
}

/**
 * Permanently delete a media asset from Cloudinary storage.
 * Handles audio/video, image, and raw assets with CDN cache invalidation.
 */
export async function deleteFromCloudinary(
  urlOrPublicId?: string | null,
  resourceType: 'video' | 'image' | 'raw' = 'video'
) {
  const client = getCloudinaryClient();
  if (!client || !urlOrPublicId) {
    return { success: false, reason: 'missing_client_or_id' };
  }

  try {
    const publicId = urlOrPublicId.includes('cloudinary.com')
      ? extractPublicId(urlOrPublicId)
      : urlOrPublicId;

    if (!publicId) return { success: false, reason: 'invalid_public_id' };

    // Try target resource_type
    const res = await client.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });

    if (res.result === 'ok') {
      console.log(`Cloudinary destroyed [${resourceType}] [${publicId}]: ok`);
      return { success: true, result: res };
    }

    // Fallback: if not found under 'video', try 'raw' or 'image'
    if (res.result === 'not found' && resourceType === 'video') {
      const retryRaw = await client.uploader.destroy(publicId, {
        resource_type: 'raw',
        invalidate: true,
      });
      if (retryRaw.result === 'ok') {
        console.log(`Cloudinary destroyed [raw] [${publicId}]: ok`);
        return { success: true, result: retryRaw };
      }
    }

    console.warn(`Cloudinary destroy returned:`, res);
    return { success: res.result === 'ok', result: res };
  } catch (err) {
    console.error('Failed to delete from Cloudinary:', urlOrPublicId, err);
    return { success: false, error: err };
  }
}

/**
 * Clean raw filename or display name into human-readable Title and Artist.
 * Strips music portal watermarks, suffixes, and formats cleanly in uppercase.
 */
export function cleanSongName(raw?: string | null): { title: string; artist: string } {
  if (!raw) return { title: 'UNTITLED TRACK', artist: 'Cloudinary Library' };

  let str = raw
    .replace(/\.[^/.]+$/, '')
    .replace(/\s*-\s*sensongsmp3(\.co)?/gi, '')
    .replace(/\s*-\s*naasongs(\.com|\.co)?/gi, '')
    .replace(/sen\s*songs\s*mp3/gi, '')
    .replace(/naa\s*songs/gi, '')
    .trim();

  // If there is an explicit ' - ' separator for artist
  const parts = str.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      title: parts[0].replace(/[-_]/g, ' ').trim().toUpperCase(),
      artist: parts.slice(1).join(' - ').replace(/[-_]/g, ' ').trim(),
    };
  }

  return {
    title: str.replace(/[-_]/g, ' ').trim().toUpperCase(),
    artist: 'Cloudinary Library',
  };
}

/**
 * Fast, Batched Two-Way Sync between Cloudinary and Supabase:
 * 1. Discovers any new tracks uploaded to Cloudinary (in 'portal-songs' or root) and bulk-inserts to Supabase.
 * 2. Prunes any orphaned tracks in Supabase if deleted in Cloudinary.
 * 3. Uses single-query batch operations to complete in ~1 second.
 */
export async function syncCloudinaryToSupabase(supabase: SupabaseClient | null) {
  const client = getCloudinaryClient();
  if (!client || !supabase) return { added: 0, pruned: 0, total: 0 };

  try {
    // 1. Fetch all audio assets from Cloudinary (with pagination if needed)
    let allAssets: Array<{
      secure_url: string;
      public_id: string;
      display_name?: string;
      filename?: string;
      asset_folder?: string;
      format?: string;
      duration?: number;
      is_audio?: boolean;
    }> = [];

    let next_cursor: string | undefined = undefined;

    do {
      const result = await client.api.resources({
        resource_type: 'video',
        max_results: 500,
        next_cursor,
      });

      if (result.resources && Array.isArray(result.resources)) {
        allAssets = allAssets.concat(result.resources);
      }
      next_cursor = result.next_cursor;
    } while (next_cursor && allAssets.length < 1000);

    const validAudioFormats = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'opus'];

    // Filter for audio tracks (in portal-songs folder or audio format)
    const audioAssets = allAssets.filter((r) => {
      const isFolderMatch = r.asset_folder === 'portal-songs';
      const fmt = (r.format || '').toLowerCase();
      const isAudioFormat = validAudioFormats.includes(fmt) || Boolean(r.is_audio);
      return isFolderMatch || isAudioFormat;
    });

    if (audioAssets.length === 0) {
      return { added: 0, pruned: 0, total: 0 };
    }

    const activeCloudinaryUrls = new Set(
      audioAssets.map((a) => a.secure_url).filter(Boolean)
    );

    // 2. Fetch existing songs from Supabase in ONE single query
    const { data: existingRows, error: fetchErr } = await supabase
      .from('songs')
      .select('id, audio_url');

    if (fetchErr) {
      console.error('Supabase query error during sync:', fetchErr);
      return { added: 0, pruned: 0, total: audioAssets.length };
    }

    const existingUrls = new Set(
      (existingRows || []).map((r: { audio_url: string }) => r.audio_url)
    );

    // 3. Prepare new songs to insert
    const newSongsToInsert: Array<{
      title: string;
      artist: string;
      album: string;
      duration: string;
      audio_url: string;
      cover_url: string;
    }> = [];

    const seenUrlsInBatch = new Set<string>();

    for (const asset of audioAssets) {
      const secureUrl = asset.secure_url;
      if (!secureUrl || existingUrls.has(secureUrl) || seenUrlsInBatch.has(secureUrl)) {
        continue;
      }
      seenUrlsInBatch.add(secureUrl);

      const rawName = asset.display_name || asset.filename || asset.public_id;
      const { title, artist } = cleanSongName(rawName);

      const durationSec = Math.round(asset.duration || 210);
      const mins = Math.floor(durationSec / 60);
      const secs = Math.floor(durationSec % 60);
      const formattedDuration = `${mins}:${secs.toString().padStart(2, '0')}`;

      newSongsToInsert.push({
        title,
        artist,
        album: asset.asset_folder || 'portal-songs',
        duration: formattedDuration,
        audio_url: secureUrl,
        cover_url: '/covers/cyber-pineapple.svg',
      });
    }

    // 4. Batch insert new songs in chunks of 50
    let addedCount = 0;
    if (newSongsToInsert.length > 0) {
      for (let i = 0; i < newSongsToInsert.length; i += 50) {
        const chunk = newSongsToInsert.slice(i, i + 50);
        const { error: insertErr } = await supabase.from('songs').insert(chunk);
        if (!insertErr) {
          addedCount += chunk.length;
        } else {
          console.error('Batch insert error during sync:', insertErr);
        }
      }
    }

    // 5. Two-Way Prune: Delete from Supabase any songs deleted from Cloudinary
    let prunedCount = 0;
    if (activeCloudinaryUrls.size > 0 && existingRows && existingRows.length > 0) {
      const orphanedIds: string[] = [];

      for (const row of existingRows) {
        const url = row.audio_url;
        // Only prune songs that were stored on Cloudinary
        if (url && url.includes('cloudinary.com') && !activeCloudinaryUrls.has(url)) {
          orphanedIds.push(row.id);
        }
      }

      if (orphanedIds.length > 0) {
        // Delete orphaned records in chunks of 50
        for (let i = 0; i < orphanedIds.length; i += 50) {
          const chunk = orphanedIds.slice(i, i + 50);
          const { error: pruneErr } = await supabase
            .from('songs')
            .delete()
            .in('id', chunk);

          if (!pruneErr) {
            prunedCount += chunk.length;
          }
        }
        console.log(`Pruned ${prunedCount} deleted Cloudinary songs from Supabase.`);
      }
    }

    return {
      added: addedCount,
      pruned: prunedCount,
      total: audioAssets.length,
    };
  } catch (err) {
    console.warn('Cloudinary two-way sync warning:', err);
    return { added: 0, pruned: 0, total: 0 };
  }
}
