import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'No file provided', status: 400 },
        { status: 400 }
      );
    }

    // Server-side validation - type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, and WebP images are allowed', status: 400 },
        { status: 400 }
      );
    }

    // Server-side validation - size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'FILE_TOO_LARGE', message: 'File must be less than 10MB', status: 400 },
        { status: 400 }
      );
    }

    // Generate signed URL for direct upload to Supabase Storage
    const fileName = `${user.id}/avatar-${Date.now()}.${file.type.split('/')[1]}`;
    
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('avatars')
      .createSignedUploadUrl(fileName);

    if (signedUrlError || !signedUrlData) {
      console.error('[API /upload/avatar] Failed to create signed URL:', signedUrlError);
      return NextResponse.json(
        { error: 'UPLOAD_FAILED', message: 'Failed to create upload URL', status: 500 },
        { status: 500 }
      );
    }

    // Upload the file directly to Supabase Storage using the signed URL
    const uploadResponse = await fetch(signedUrlData.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!uploadResponse.ok) {
      console.error('[API /upload/avatar] Storage upload failed:', uploadResponse.status);
      return NextResponse.json(
        { error: 'UPLOAD_FAILED', message: 'Failed to upload file to storage', status: 500 },
        { status: 500 }
      );
    }

    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update user profile with avatar URL
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[API /upload/avatar] Profile update error:', profileError);
    }

    return NextResponse.json({
      avatar_url: publicUrl,
      width: 400,
      height: 400
    }, { status: 200 });

  } catch (error) {
    console.error('[API /upload/avatar]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}