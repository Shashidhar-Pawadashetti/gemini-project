'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordStrengthMeter } from '@/components/password-strength';
import { toast } from 'sonner';

type RegistrationState =
  | 'idle'
  | 'validating_username'
  | 'username_taken'
  | 'username_available'
  | 'submitting'
  | 'age_verifying'
  | 'age_verified'
  | 'age_rejected'
  | 'age_uncertain'
  | 'id_verification_pending'
  | 'id_verification_approved'
  | 'id_verification_rejected'
  | 'error_network'
  | 'error_email_taken'
  | 'error_validation'
  | 'error_rate_limited'
  | 'success';

const FTC_BANNER_TEXT = "By creating an account, you confirm that you are 18 years of age or older. Pulse uses age verification to comply with FTC regulations and does not allow access to users under 18 years of age.";

export function RegisterForm() {
  const router = useRouter();
  const [state, setState] = useState<RegistrationState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const usernameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    username: '',
    date_of_birth: '',
  });

  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (username.length < 3) return;

    setState('validating_username');

    try {
      const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await response.json();

      if (data.available) {
        setState('username_available');
      } else {
        setState('username_taken');
      }
    } catch {
      setState('idle');
    }
  }, []);

  useEffect(() => {
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
    }

    if (formData.username.length >= 3) {
      usernameTimeoutRef.current = setTimeout(() => {
        checkUsernameAvailability(formData.username);
      }, 400);
    } else {
      setState('idle');
    }

    return () => {
      if (usernameTimeoutRef.current) {
        clearTimeout(usernameTimeoutRef.current);
      }
    };
  }, [formData.username, checkUsernameAvailability]);

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setState('submitting');

    if (state === 'username_taken') {
      setErrorMessage('Username is already taken');
      setState('error_validation');
      return;
    }

    if (formData.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      setState('error_validation');
      return;
    }

    if (!/[A-Z]/.test(formData.password)) {
      setErrorMessage('Password must contain at least one uppercase letter');
      setState('error_validation');
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      setErrorMessage('Password must contain at least one number');
      setState('error_validation');
      return;
    }

    const age = calculateAge(formData.date_of_birth);
    if (age < 18) {
      setState('age_rejected');
      setErrorMessage('You must be at least 18 years old to use Pulse.');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          display_name: `${formData.first_name} ${formData.last_name}`.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setState('error_email_taken');
          setErrorMessage('An account with this email already exists.');
        } else if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          setCountdown(retryAfter);
          setState('error_rate_limited');
          setErrorMessage(`Too many registration attempts. Please wait ${retryAfter} seconds.`);
          startCountdown(retryAfter);
        } else if (response.status === 422) {
          setState('error_validation');
          setErrorMessage(data.message || 'Invalid form data. Please check your inputs.');
        } else if (response.status === 503) {
          setState('error_network');
          setErrorMessage('Service temporarily unavailable. Please try again later.');
        } else {
          setState('error_network');
          setErrorMessage('Something went wrong. Please try again.');
        }
        return;
      }

      setState('success');
      toast.success('Account created! Redirecting to onboarding...');
      router.push('/onboarding');
      router.refresh();
    } catch {
      setState('error_network');
      setErrorMessage('Something went wrong. Please try again.');
      toast.error('Failed to create account. Please try again.');
    }
  };

  const startCountdown = (seconds: number) => {
    let remaining = seconds;
    const interval = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setState('idle');
        setErrorMessage('');
        setCountdown(null);
      }
    }, 1000);
  };

  const getUsernameStatus = () => {
    switch (state) {
      case 'validating_username':
        return { text: 'Checking...', color: 'text-muted-foreground', icon: <Loader2 className="h-3 w-3 animate-spin" /> };
      case 'username_taken':
        return { text: 'Username taken', color: 'text-destructive', icon: <AlertCircle className="h-3 w-3" /> };
      case 'username_available':
        return { text: 'Username available', color: 'text-green-600', icon: <CheckCircle2 className="h-3 w-3" /> };
      default:
        return null;
    }
  };

  const usernameStatus = getUsernameStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Fill in your details to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">{FTC_BANNER_TEXT}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(state === 'error_validation' || state === 'error_email_taken' || state === 'error_network' || state === 'error_rate_limited' || state === 'age_rejected') && errorMessage && (
            <div className="flex items-start gap-2 p-3 text-sm rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          {state === 'age_rejected' && (
            <div className="flex items-start gap-2 p-3 text-sm rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">Age Requirement Not Met</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  You must be at least 18 years old to create a Pulse account.
                  If you believe this is an error, please contact support.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                type="text"
                placeholder="John"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                disabled={state === 'submitting'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                type="text"
                placeholder="Doe"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                disabled={state === 'submitting'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={state === 'submitting'}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                type="text"
                placeholder="yourname"
                value={formData.username}
                onChange={(e) => setFormData({
                  ...formData,
                  username: e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '')
                })}
                required
                disabled={state === 'submitting'}
                minLength={3}
                maxLength={30}
                className="pr-16"
              />
              {formData.username.length >= 3 && usernameStatus && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs flex items-center gap-1 ${usernameStatus.color}`}>
                  {usernameStatus.icon}
                  {usernameStatus.text}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters with uppercase and number"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={state === 'submitting'}
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={formData.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              required
              disabled={state === 'submitting'}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              You must be 18 or older to register for Pulse
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              state === 'submitting' ||
              state === 'validating_username' ||
              state === 'username_taken' ||
              countdown !== null
            }
          >
            {state === 'submitting' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : countdown !== null ? (
              `Please wait ${countdown}s`
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
