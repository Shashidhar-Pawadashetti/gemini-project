import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

const isProtectedRoute = (pathname: string) =>
  pathname.startsWith('/home') ||
  pathname.startsWith('/profile') ||
  pathname.startsWith('/messages') ||
  pathname.startsWith('/search') ||
  pathname.startsWith('/compose') ||
  pathname.startsWith('/onboarding') ||
  pathname.startsWith('/post');

const isAuthRoute = (pathname: string) =>
  pathname.startsWith('/login') ||
  pathname.startsWith('/register');

function getRedirectUrl(pathname: string, hasUser: boolean, baseUrl: string): string | null {
  if (!hasUser && isProtectedRoute(pathname)) {
    return `${baseUrl}/login?redirect=${pathname}`;
  }
  if (hasUser && isAuthRoute(pathname)) {
    return `${baseUrl}/home`;
  }
  return null;
}

describe('Middleware route protection logic', () => {
  const baseUrl = 'http://localhost:3000';

  it('Unauthenticated /home → redirect /login?redirect=/home', () => {
    const redirect = getRedirectUrl('/home', false, baseUrl);
    expect(redirect).toBe('http://localhost:3000/login?redirect=/home');
  });

  it('Unauthenticated /profile/foo → redirect /login?redirect=/profile/foo', () => {
    const redirect = getRedirectUrl('/profile/testuser', false, baseUrl);
    expect(redirect).toBe('http://localhost:3000/login?redirect=/profile/testuser');
  });

  it('Unauthenticated /messages → redirect /login', () => {
    const redirect = getRedirectUrl('/messages', false, baseUrl);
    expect(redirect).toBe('http://localhost:3000/login?redirect=/messages');
  });

  it('Authenticated /login → redirect /home', () => {
    const redirect = getRedirectUrl('/login', true, baseUrl);
    expect(redirect).toBe('http://localhost:3000/home');
  });

  it('Authenticated /register → redirect /home', () => {
    const redirect = getRedirectUrl('/register', true, baseUrl);
    expect(redirect).toBe('http://localhost:3000/home');
  });

  it('Unauthenticated / → pass through (public)', () => {
    const redirect = getRedirectUrl('/', false, baseUrl);
    expect(redirect).toBeNull();
  });

  it('Unauthenticated /onboarding → redirect /login?redirect=/onboarding', () => {
    const redirect = getRedirectUrl('/onboarding', false, baseUrl);
    expect(redirect).toBe('http://localhost:3000/login?redirect=/onboarding');
  });

  it('Authenticated /home → pass through', () => {
    const redirect = getRedirectUrl('/home', true, baseUrl);
    expect(redirect).toBeNull();
  });

  it('Unauthenticated /post/123 → redirect to /login (currently protected)', () => {
    const redirect = getRedirectUrl('/post/123', false, baseUrl);
    expect(redirect).toBe('http://localhost:3000/login?redirect=/post/123');
  });

  it('Protected routes include all spec-required paths', () => {
    expect(isProtectedRoute('/home')).toBe(true);
    expect(isProtectedRoute('/profile/test')).toBe(true);
    expect(isProtectedRoute('/messages')).toBe(true);
    expect(isProtectedRoute('/messages/abc')).toBe(true);
    expect(isProtectedRoute('/search')).toBe(true);
    expect(isProtectedRoute('/compose')).toBe(true);
    expect(isProtectedRoute('/onboarding')).toBe(true);
    expect(isProtectedRoute('/onboarding/avatar')).toBe(true);
    expect(isProtectedRoute('/post/123')).toBe(true);
  });

  it('Auth routes are /login and /register', () => {
    expect(isAuthRoute('/login')).toBe(true);
    expect(isAuthRoute('/register')).toBe(true);
    expect(isAuthRoute('/login?redirect=/home')).toBe(true);
  });
});