import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '../(auth)/register/register-form';
import * as nextNavigation from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

const createMockFetch = (options?: {
  usernameAvailable?: boolean;
  registrationSuccess?: boolean;
  registrationError?: number;
}) => {
  return vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('/api/auth/check-username')) {
      return {
        ok: true,
        json: async () => ({ available: options?.usernameAvailable ?? true }),
      };
    }
    if (url.includes('/api/auth/register')) {
      if (options?.registrationError) {
        return {
          ok: false,
          status: options.registrationError,
          json: async () => ({ error: 'ERROR', message: 'Test error' }),
          headers: { get: () => null } as unknown as Headers,
        };
      }
      return {
        ok: options?.registrationSuccess ?? true,
        status: options?.registrationSuccess ? 201 : 400,
        json: async () => ({ user: { id: 'mock-user-id' } }),
        headers: { get: () => null } as unknown as Headers,
      };
    }
    return { ok: false, status: 500, json: async () => ({ error: 'ERROR' }) };
  });
};

describe('RegistrationState transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('REG-01: Valid registration → /onboarding', async () => {
    const mockPush = vi.fn();
    const mockRefresh = vi.fn();
    
    vi.mocked(nextNavigation.useRouter).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    } as any);

    global.fetch = createMockFetch({
      usernameAvailable: true,
      registrationSuccess: true,
    });

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/username/i), 'johndoe');
    await user.type(screen.getByLabelText(/password/i), 'Password1');
    
    const dobInput = screen.getByLabelText(/date of birth/i);
    await user.type(dobInput, '1995-01-15');

    await waitFor(() => {
      expect(screen.getByText(/username available/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('REG-02: Username taken → username_taken state', async () => {
    global.fetch = createMockFetch({
      usernameAvailable: false,
    });

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/username/i), 'takenuser');

    await waitFor(() => {
      expect(screen.getByText(/username taken/i)).toBeInTheDocument();
    });
  });

  it('REG-03: Password < 8 chars → blocked', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/username/i), 'johndoe');
    await user.type(screen.getByLabelText(/password/i), 'Pass1');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    expect(submitButton).toBeDisabled();
  });

  it('REG-04: Age < 18 → age_rejected state', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/username/i), 'johndoe');
    await user.type(screen.getByLabelText(/password/i), 'Password1');

    const dobInput = screen.getByLabelText(/date of birth/i);
    await user.type(dobInput, '2015-01-15');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/must be at least 18/i)).toBeInTheDocument();
    });
  });

  it('REG-06: Duplicate email → error_email_taken', async () => {
    const mockPush = vi.fn();
    const mockRefresh = vi.fn();
    
    vi.mocked(nextNavigation.useRouter).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    } as any);

    global.fetch = createMockFetch({
      usernameAvailable: true,
      registrationSuccess: false,
      registrationError: 409,
    });

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/username/i), 'newuser');
    await user.type(screen.getByLabelText(/password/i), 'Password1');
    await user.type(screen.getByLabelText(/date of birth/i), '1995-01-15');

    await waitFor(() => {
      expect(screen.getByText(/username available/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('REG-07: Network error → error_network', async () => {
    global.fetch = createMockFetch({
      usernameAvailable: true,
      registrationSuccess: false,
      registrationError: 500,
    });

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/username/i), 'johndoe');
    await user.type(screen.getByLabelText(/password/i), 'Password1');
    await user.type(screen.getByLabelText(/date of birth/i), '1995-01-15');

    await waitFor(() => {
      expect(screen.getByText(/username available/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('debounced username check triggers after 400ms', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true }),
    });
    global.fetch = fetchSpy;

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/username/i), 'user1');
    
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 450));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('submit button disabled while validating username', async () => {
    const fetchSpy = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ available: true }),
      }), 100))
    );
    global.fetch = fetchSpy;

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/username/i), 'validuser');

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const submitButton = screen.getByRole('button', { name: /create account/i });
    expect(submitButton).toHaveAttribute('disabled');
  });
});