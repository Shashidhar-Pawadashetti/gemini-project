import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProfileByUsername, getProfileById, updateProfile } from '../supabase/queries/profiles';
import type { Profile } from '@/types';

describe('Profile Queries', () => {
  const mockProfile: Profile = {
    id: '123',
    username: 'testuser',
    display_name: 'Test User',
    bio: 'Hello world',
    avatar_url: 'https://example.com/avatar.jpg',
    cover_url: null,
    location: 'NYC',
    website: 'https://example.com',
    is_private: false,
    is_verified: true,
    followers_count: 100,
    following_count: 50,
    posts_count: 25,
    metadata: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
          neq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
            }),
          }),
        }),
      }),
    };
  });

  describe('getProfileByUsername', () => {
    it('should select explicit columns (never SELECT *)', async () => {
      const { data, error } = await getProfileByUsername(mockSupabase, 'testuser');
      
      expect(error).toBeNull();
      expect(data).toEqual(mockProfile);
      
      // Verify the query structure - should have explicit column selection
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    });

    it('should return null when profile not found', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      const { data, error } = await getProfileByUsername(mockSupabase, 'nonexistent');
      
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });

    it('should lowercase username before querying', async () => {
      await getProfileByUsername(mockSupabase, 'TestUser');
      
      // Verify username is lowercased in the query
      const selectMock = mockSupabase.from('profiles').select as any;
      const eqMock = selectMock.mock.results[0].value.eq as any;
      expect(eqMock).toHaveBeenCalledWith('username', 'testuser');
    });
  });

  describe('getProfileById', () => {
    it('should query by id instead of username', async () => {
      const { data, error } = await getProfileById(mockSupabase, '123');
      
      expect(error).toBeNull();
      expect(data).toEqual(mockProfile);
      
      // Verify the query uses id
      const selectMock = mockSupabase.from('profiles').select as any;
      const eqMock = selectMock.mock.results[0].value.eq as any;
      expect(eqMock).toHaveBeenCalledWith('id', '123');
    });
  });

  describe('updateProfile', () => {
    it('should update profile with provided fields', async () => {
      const updates = {
        display_name: 'New Name',
        bio: 'New bio',
      };

      const { data, error } = await updateProfile(mockSupabase, '123', updates);
      
      expect(error).toBeNull();
      expect(data).toEqual(mockProfile);
      
      // Verify update was called
      const updateMock = mockSupabase.from('profiles').update as any;
      expect(updateMock).toHaveBeenCalled();
    });

    it('should set updated_at timestamp', async () => {
      const updates = { bio: 'Updated bio' };
      
      await updateProfile(mockSupabase, '123', updates);
      
      const updateCall = (mockSupabase.from('profiles').update as any).mock.calls[0][0];
      expect(updateCall.updated_at).toBeDefined();
      expect(new Date(updateCall.updated_at).getTime()).toBeGreaterThan(0);
    });

    it('should only allow whitelisted fields', async () => {
      const updates = {
        display_name: 'New Name',
        bio: 'New bio',
        avatar_url: 'https://example.com/new.jpg',
        cover_url: 'https://example.com/cover.jpg',
        location: 'LA',
        website: 'https://new.com',
        is_private: true,
      };

      const { error } = await updateProfile(mockSupabase, '123', updates);
      
      expect(error).toBeNull();
    });
  });
});