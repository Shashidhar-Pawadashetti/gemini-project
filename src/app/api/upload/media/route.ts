import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'text/plain', 'application/pdf'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 4;

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
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'No files provided', status: 400 },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: 'TOO_MANY_FILES', message: `Maximum ${MAX_FILES} files allowed`, status: 400 },
        { status: 400 }
      );
    }

    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Server-side validation - type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`Invalid file type for ${file.name}. Allowed: jpeg, png, webp, gif, mp4, webm, text, pdf`);
        continue;
      }

      // Server-side validation - size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} is too large. Maximum size is 10MB`);
        continue;
      }

      // Generate unique filename
      const extension = file.name.split('.').pop() || 'bin';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
      
      // Create signed upload URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('media')
        .createSignedUploadUrl(fileName);

      if (signedUrlError || !signedUrlData) {
        console.error('[API /upload/media] Failed to create signed URL:', signedUrlError);
        errors.push(`Failed to upload ${file.name}`);
        continue;
      }

      // Upload directly to Supabase Storage
      const uploadResponse = await fetch(signedUrlData.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: Buffer.from(await file.arrayBuffer()),
      });

      if (!uploadResponse.ok) {
        console.error('[API /upload/media] Storage upload failed:', uploadResponse.status);
        errors.push(`Failed to upload ${file.name}`);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    if (uploadedUrls.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'UPLOAD_FAILED', message: errors.join(', '), status: 400 },
        { status: 400 }
      );
    }

    return NextResponse.json({
      urls: uploadedUrls,
      errors: errors.length > 0 ? errors : null
    }, { status: 200 });

  } catch (error) {
    console.error('[API /upload/media]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}