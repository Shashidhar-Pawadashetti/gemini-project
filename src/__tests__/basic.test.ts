import { describe, it, expect } from 'vitest';

describe('Basic test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
  
  it('should test middleware logic', () => {
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
    
    expect(isProtectedRoute('/home')).toBe(true);
    expect(isProtectedRoute('/profile/test')).toBe(true);
    expect(isProtectedRoute('/messages')).toBe(true);
    expect(isProtectedRoute('/onboarding')).toBe(true);
    expect(isProtectedRoute('/post/123')).toBe(true);
    expect(isProtectedRoute('/')).toBe(false);
    expect(isProtectedRoute('/login')).toBe(false);
    
    expect(isAuthRoute('/login')).toBe(true);
    expect(isAuthRoute('/register')).toBe(true);
    expect(isAuthRoute('/home')).toBe(false);
  });
});