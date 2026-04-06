import { test, expect, Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const hasRealSupabase = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

async function checkLocalStorageEmpty(page: Page) {
  const keys = await page.evaluate(() => {
    const result: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) result.push(key);
    }
    return result;
  });

  const authKeys = keys.filter((key: string) => 
    key.includes('supabase') || key.includes('token') || key.includes('auth')
  );
  
  expect(authKeys).toHaveLength(0);
}

async function checkSessionStorageEmpty(page: Page) {
  const keys = await page.evaluate(() => {
    const result: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key) result.push(key);
    }
    return result;
  });

  const authKeys = keys.filter((key: string) => 
    key.includes('supabase') || key.includes('token') || key.includes('auth')
  );
  
  expect(authKeys).toHaveLength(0);
}

test('Unauthenticated /home → /login?redirect=', async ({ page }) => {
  await page.goto('/home');
  await page.waitForURL('**/login?redirect=**', { timeout: 10000 });
  expect(page.url()).toContain('/login');
});

test('Unauthenticated /onboarding → /login?redirect=', async ({ page }) => {
  await page.goto('/onboarding');
  await page.waitForURL('**/login?redirect=**', { timeout: 10000 });
  expect(page.url()).toContain('/login');
});

test('Unauthenticated /messages → /login?redirect=', async ({ page }) => {
  await page.goto('/messages');
  await page.waitForURL('**/login?redirect=**', { timeout: 10000 });
  expect(page.url()).toContain('/login');
});

test('Unauthenticated /profile/test → /login?redirect=', async ({ page }) => {
  await page.goto('/profile/test');
  await page.waitForURL('**/login?redirect=**', { timeout: 10000 });
  expect(page.url()).toContain('/login');
});

test('Unauthenticated /search → /login?redirect=', async ({ page }) => {
  await page.goto('/search');
  await page.waitForURL('**/login?redirect=**', { timeout: 10000 });
  expect(page.url()).toContain('/login');
});

test('Root / is public', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(page.url()).toBe('http://localhost:3000/');
});

test('Login page is public', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/login');
});

test('Register page is public', async ({ page }) => {
  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/register');
});

if (hasRealSupabase) {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPass123';
  const testUsername = `testuser${Date.now()}`;

  test('REG-01: Registration → /onboarding', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('input[id="first_name"]', 'John');
    await page.fill('input[id="last_name"]', 'Doe');
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="username"]', testUsername);
    await page.fill('input[id="password"]', testPassword);
    await page.fill('input[id="date_of_birth"]', '1995-01-15');
    
    await page.waitForSelector('text=/username (available|taken)/i', { timeout: 15000 });
    
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/onboarding', { timeout: 20000 });
  });

  test('Login with valid credentials → /home', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/home', { timeout: 20000 });
  });

  test('Session persists after refresh', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home');
    
    await page.reload();
    await page.waitForURL('**/home', { timeout: 10000 });
  });

  test('Security: No tokens in localStorage', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home');
    await checkLocalStorageEmpty(page);
  });

  test('Security: No tokens in sessionStorage', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home');
    await checkSessionStorageEmpty(page);
  });
}