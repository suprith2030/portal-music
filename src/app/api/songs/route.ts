import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// GET /api/songs - Fetch all songs or verify PIN
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

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

// POST /api/songs - Insert or update song with strict PIN verification & deduplication
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, artist, album, duration, audio_url, cover_url, pin } = body;

    // 1. Strict Security PIN verification
    const expectedPin = getAdminPin();
    const enteredPin = String(pin || '').trim();

    if (!enteredPin || enteredPin !== expectedPin) {
      return NextResponse.json(
        { error: 'INVALID SECURITY PIN. ACCESS DENIED.' },
        { status: 401 }
      );
    }

    // 2. Validate payload
    if (!title || !audio_url) {
      return NextResponse.json(
        { error: 'Title and audio_url are required.' },
        { status: 400 }
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

    const trimmedTitle = String(title).trim();
    const trimmedArtist = String(artist || 'Unknown Artist').trim();
    const trimmedAlbum = String(album || 'Single').trim();
    const trimmedDuration = String(duration || '3:00').trim();
    const trimmedAudioUrl = String(audio_url).trim();
    const trimmedCoverUrl = String(cover_url || '').trim();

    // 3. Deduplication Check: Look for existing track with same Title & Artist
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

// DELETE /api/songs - Purge a song record by ID with strict PIN verification
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
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

    if (!id) {
      return NextResponse.json(
        { error: 'Song ID is required for deletion.' },
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

    const { error } = await supabase.from('songs').delete().eq('id', id);

    if (error) {
      console.error('Supabase delete error in /api/songs:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('Server error in /api/songs DELETE:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}
