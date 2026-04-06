import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  display_name: z.string()
    .min(1, 'Display name is required')
    .max(60, 'Display name must be at most 60 characters'),
  date_of_birth: z.string().refine((date) => {
    const dob = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      return age - 1 >= 18;
    }
    return age >= 18;
  }, 'You must be at least 18 years old'),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid form data',
          status: 422,
        },
        { status: 422 }
      );
    }

    const { email, password, username, display_name, date_of_birth } = parsed.data;

    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (existingUsername) {
      return NextResponse.json(
        { error: 'CONFLICT', message: 'Username already taken', status: 409 },
        { status: 409 }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
          display_name,
          date_of_birth,
        },
      },
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'CONFLICT', message: 'An account with this email already exists', status: 409 },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: authError.message, status: 422 },
        { status: 422 }
      );
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: username.toLowerCase(),
        display_name,
        date_of_birth,
      });

      if (profileError) {
        console.error('[API /auth/register] Profile creation error:', profileError);
      }
    }

    return NextResponse.json(
      { user: authData.user, session: authData.session },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API /auth/register]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
