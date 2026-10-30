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

// GET /api/songs - Fetch all songs from Supabase
export async function GET() {
  try {
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
      .order('title', { ascending: true });

    if (error) {
      console.error('Supabase query error in /api/songs:', error);
      return NextResponse.json(
        { songs: [], isConfigured: true, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      songs: data || [],
      isConfigured: true,
      count: data ? data.length : 0,
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

// POST /api/songs - Insert a new song record into Supabase
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, artist, album, duration, audio_url, cover_url } = body;

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
            'Supabase is not configured on the server. Please verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from('songs')
      .insert({
        title: String(title).trim(),
        artist: String(artist || 'Unknown Artist').trim(),
        album: String(album || 'Single').trim(),
        duration: String(duration || '3:00').trim(),
        audio_url: String(audio_url).trim(),
        cover_url: String(cover_url || '').trim(),
      })
      .select();

    if (error) {
      console.error('Supabase insert error in /api/songs:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      song: data ? data[0] : null,
    });
  } catch (err) {
    console.error('Server error in /api/songs POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/songs - Delete a song record by ID
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

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
