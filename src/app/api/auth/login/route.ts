import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Email and password are required', status: 400 },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: error.message, status: 401 },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: data.user, session: data.session }, { status: 200 });
  } catch (error) {
    console.error('[API /auth/login]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
