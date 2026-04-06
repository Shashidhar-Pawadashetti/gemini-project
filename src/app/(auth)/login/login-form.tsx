'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type LoginError = {
  code: 'UNAUTHORIZED' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE';
  message: string;
  retryAfter?: number;
};

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          setCountdown(retryAfter);
          setError({
            code: 'RATE_LIMITED',
            message: 'Too many login attempts. Please wait.',
            retryAfter,
          });
          startCountdown(retryAfter);
        } else if (response.status === 503) {
          setError({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service temporarily unavailable. Please try again later.',
          });
        } else if (response.status === 500) {
          setError({
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong. Please try again.',
          });
        } else {
          setError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password.',
          });
        }
        return;
      }

      router.push('/home');
      router.refresh();
    } catch {
      setError({
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startCountdown = (seconds: number) => {
    let remaining = seconds;
    const interval = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setError(null);
        setCountdown(null);
      }
    }, 1000);
  };

  const handleRetry = () => {
    setError(null);
    setCountdown(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Enter your credentials to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 text-sm rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p>{error.message}</p>
                {countdown !== null && (
                  <p className="text-xs mt-1">Retry in {countdown} seconds</p>
                )}
                {error.code === 'INTERNAL_ERROR' && (
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-sm underline mt-1"
                    onClick={handleRetry}
                  >
                    Try again
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || countdown !== null}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : countdown !== null ? (
              `Wait ${countdown}s`
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
