import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const hasRealSupabase = !!SUPABASE_URL && !!SUPABASE_KEY;

const integrationTest = hasRealSupabase ? describe : describe.skip;

integrationTest('Auth API Integration Tests', () => {
  let testUserEmail: string;
  let testUsername: string;

  beforeAll(() => {
    testUserEmail = `test-${Date.now()}@example.com`;
    testUsername = `testuser${Date.now()}`;
  });

  afterAll(async () => {
    if (hasRealSupabase) {
      // Clean up test user from Supabase Auth
      const { createClient } = require('@supabase/supabase-js');
      const adminClient = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      
      try {
        await adminClient.auth.admin.deleteUser(
          (await adminClient.auth.getUserByEmail(testUserEmail)).data.user?.id
        );
      } catch (e) {
        // User may not exist, ignore cleanup errors
      }
    }
  });

  it('REG-04: Server validates age >= 18 via Zod', async () => {
    if (!hasRealSupabase) {
      console.log('Skipping: No real Supabase configured');
      return;
    }

    const mockRequest = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserEmail,
        password: 'Password1',
        username: testUsername,
        display_name: 'Test User',
        date_of_birth: '2015-01-15', // Age < 18
      }),
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(mockRequest as any);
    
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toBe('VALIDATION_ERROR');
    expect(data.message).toContain('18');
  });

  it('REG-03: Server validates password >= 8 chars, uppercase, number', async () => {
    if (!hasRealSupabase) {
      console.log('Skipping: No real Supabase configured');
      return;
    }

    const mockRequest = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserEmail,
        password: 'weak', // Too short, no uppercase, no number
        username: testUsername,
        display_name: 'Test User',
        date_of_birth: '1995-01-15',
      }),
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(mockRequest as any);
    
    expect(response.status).toBe(422);
    
    const data = await response.json();
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('Username check API works', async () => {
    if (!hasRealSupabase) {
      console.log('Skipping: No real Supabase configured');
      return;
    }

    const mockRequest = new Request(
      `http://localhost:3000/api/auth/check-username?username=${testUsername}`,
      { method: 'GET' }
    );

    const { GET } = await import('@/app/api/auth/check-username/route');
    const response = await GET(mockRequest as any);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('available');
  });
});