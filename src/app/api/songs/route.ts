import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getServerSupabase() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  const supabaseUrl = rawUrl.replace(/^["']|["']$/g, '').trim();
  const supabaseAnonKey = rawKey.replace(/^["']|["']$/g, '').trim();

  if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return null;
}

function getAdminPin(): string {
  const raw =
    process.env.ADMIN_PIN ||
    process.env.NEXT_PUBLIC_ADMIN_PIN ||
    '2026';
  return raw.replace(/^["']|["']$/g, '').trim();
}

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

// GET /api/songs - Fetch all songs or verify PIN
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Optional PIN verification endpoint: /api/songs?action=verify-pin&pin=...
    if (searchParams.get('action') === 'verify-pin') {
      const pin = (searchParams.get('pin') || '').trim();
      const expected = getAdminPin();
      return NextResponse.json({ valid: pin === expected });
    }

    const supabase = getServerSupabase();

    if (!supabase) {
      return NextResponse.json({
        songs: [],
        isConfigured: false,
        message: 'Supabase environment variables not configured on server.',
      });
    }

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase query error in /api/songs:', error);
      return NextResponse.json(
        { songs: [], isConfigured: true, error: error.message },
        { status: 500 }
      );
    }

    // Deduplicate songs by title + artist (case-insensitive) to ensure NO duplicate tracks in UI
    const uniqueSongs: Array<(typeof data)[0]> = [];
    const seen = new Set<string>();

    if (data) {
      for (const song of data) {
        const key = `${(song.title || '').trim().toLowerCase()}:::${(song.artist || '').trim().toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSongs.push(song);
        }
      }
    }

    // Sort alphabetically by title
    uniqueSongs.sort((a, b) =>
      (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
    );

    return NextResponse.json({
      songs: uniqueSongs,
      isConfigured: true,
      count: uniqueSongs.length,
      rawCount: data ? data.length : 0,
    });
  } catch (err) {
    console.error('Server error in /api/songs GET:', err);
    return NextResponse.json(
      {
        songs: [],
        isConfigured: false,
        error: err instanceof Error ? err.message : 'Unknown server error',
      },
      { status: 500 }
    );
  }
}

// POST /api/songs - Insert/Update song OR Purge song (via action: 'delete')
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, title, artist, album, duration, audio_url, cover_url, pin, id } = body;

    // 1. Strict Security PIN verification
    const expectedPin = getAdminPin();
    const enteredPin = String(pin || '').trim();

    if (!enteredPin || enteredPin !== expectedPin) {
      return NextResponse.json(
        { error: 'INVALID SECURITY PIN. ACCESS DENIED.' },
        { status: 401 }
      );
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            'Supabase is not configured on the server. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        },
        { status: 503 }
      );
    }

    // ── Handle Action: DELETE (via robust POST method) ──
    if (action === 'delete') {
      let totalDeleted = 0;

      // 1. Delete by UUID if valid
      if (isValidUUID(id)) {
        const { data: delById, error: errById } = await supabase
          .from('songs')
          .delete()
          .eq('id', id.trim())
          .select();

        if (errById) {
          console.warn('Purge by ID warning:', errById.message);
        } else if (delById) {
          totalDeleted += delById.length;
        }
      }

      // 2. Also delete any duplicate rows with same Title & Artist
      if (title && artist) {
        const { data: delByTitle, error: errByTitle } = await supabase
          .from('songs')
          .delete()
          .ilike('title', String(title).trim())
          .ilike('artist', String(artist).trim())
          .select();

        if (errByTitle) {
          console.warn('Purge by title/artist warning:', errByTitle.message);
        } else if (delByTitle) {
          totalDeleted += delByTitle.length;
        }
      }

      // 3. Also delete by audio_url if provided
      if (audio_url) {
        const { data: delByAudio } = await supabase
          .from('songs')
          .delete()
          .eq('audio_url', String(audio_url).trim())
          .select();

        if (delByAudio) {
          totalDeleted += delByAudio.length;
        }
      }

      return NextResponse.json({
        success: true,
        action: 'delete',
        deletedCount: totalDeleted,
        deletedId: id,
      });
    }

    // ── Handle Action: INSERT / UPDATE (Upload) ──
    if (!title || !audio_url) {
      return NextResponse.json(
        { error: 'Title and audio_url are required.' },
        { status: 400 }
      );
    }

    const trimmedTitle = String(title).trim();
    const trimmedArtist = String(artist || 'Unknown Artist').trim();
    const trimmedAlbum = String(album || 'Single').trim();
    const trimmedDuration = String(duration || '3:00').trim();
    const trimmedAudioUrl = String(audio_url).trim();
    const trimmedCoverUrl = String(cover_url || '').trim();

    // Deduplication Check: Look for existing track with same Title & Artist
    const { data: existingSongs, error: searchError } = await supabase
      .from('songs')
      .select('id, title, artist')
      .ilike('title', trimmedTitle)
      .ilike('artist', trimmedArtist)
      .limit(1);

    if (searchError) {
      console.warn('Deduplication lookup warning:', searchError.message);
    }

    let songRecord;
    let isUpdated = false;

    if (existingSongs && existingSongs.length > 0) {
      // Track already exists: UPDATE the existing row to prevent duplicate rows in DB
      const existingId = existingSongs[0].id;
      const { data: updatedData, error: updateError } = await supabase
        .from('songs')
        .update({
          album: trimmedAlbum,
          duration: trimmedDuration,
          audio_url: trimmedAudioUrl,
          cover_url: trimmedCoverUrl,
        })
        .eq('id', existingId)
        .select();

      if (updateError) {
        console.error('Supabase update error in /api/songs:', updateError);
        return NextResponse.json(
          { error: `Database error during update: ${updateError.message}` },
          { status: 500 }
        );
      }
      songRecord = updatedData ? updatedData[0] : null;
      isUpdated = true;
    } else {
      // New track: INSERT new record
      const { data: insertedData, error: insertError } = await supabase
        .from('songs')
        .insert({
          title: trimmedTitle,
          artist: trimmedArtist,
          album: trimmedAlbum,
          duration: trimmedDuration,
          audio_url: trimmedAudioUrl,
          cover_url: trimmedCoverUrl,
        })
        .select();

      if (insertError) {
        console.error('Supabase insert error in /api/songs:', insertError);
        return NextResponse.json(
          { error: `Database error during insert: ${insertError.message}` },
          { status: 500 }
        );
      }
      songRecord = insertedData ? insertedData[0] : null;
    }

    return NextResponse.json({
      success: true,
      updated: isUpdated,
      song: songRecord,
    });
  } catch (err) {
    console.error('Server error in /api/songs POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/songs - Purge a song record by ID/Title with strict PIN verification
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const title = searchParams.get('title');
    const artist = searchParams.get('artist');
    const pin = searchParams.get('pin') || request.headers.get('x-admin-pin') || '';

    // 1. Strict Security PIN verification
    const expectedPin = getAdminPin();
    const enteredPin = String(pin).trim();

    if (!enteredPin || enteredPin !== expectedPin) {
      return NextResponse.json(
        { error: 'INVALID SECURITY PIN. ACCESS DENIED.' },
        { status: 401 }
      );
    }

    if (!id && !title) {
      return NextResponse.json(
        { error: 'Song ID or Title is required for deletion.' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured on the server.' },
        { status: 503 }
      );
    }

    let deletedCount = 0;

    // Purge by UUID if valid
    if (isValidUUID(id)) {
      const { data: delById, error: errById } = await supabase
        .from('songs')
        .delete()
        .eq('id', (id || '').trim())
        .select();

      if (errById) {
        console.warn('DELETE route by ID warning:', errById.message);
      } else if (delById) {
        deletedCount += delById.length;
      }
    }

    // Also purge all duplicates by title & artist if provided
    if (title && artist) {
      const { data: delByTitle } = await supabase
        .from('songs')
        .delete()
        .ilike('title', title.trim())
        .ilike('artist', artist.trim())
        .select();

      if (delByTitle) {
        deletedCount += delByTitle.length;
      }
    }

    return NextResponse.json({ success: true, deletedId: id, deletedCount });
  } catch (err) {
    console.error('Server error in /api/songs DELETE:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}
