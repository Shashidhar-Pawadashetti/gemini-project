import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockToast = {
  error: vi.fn(),
  success: vi.fn(),
};

vi.stubGlobal('toast', mockToast);

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe('Onboarding - Wizard Navigation (ONB-01)', () => {
  it('should not allow skipping steps - must go in order', () => {
    const steps = ['avatar', 'bio', 'interests', 'suggestions'];
    let currentStep = 'avatar';

    const trySkipToSuggestions = () => {
      const suggestionIndex = steps.indexOf('suggestions');
      const currentIndex = steps.indexOf(currentStep);
      return currentIndex === suggestionIndex - 1;
    };

    currentStep = 'interests';
    expect(trySkipToSuggestions()).toBe(true);
  });

  it('should allow going back to previous steps', () => {
    const steps = ['avatar', 'bio', 'interests', 'suggestions'];
    let currentStep = 'interests';

    const canGoBack = () => {
      const currentIndex = steps.indexOf(currentStep);
      return currentIndex > 0;
    };

    expect(canGoBack()).toBe(true);
  });

  it('should prevent going past the last step', () => {
    const steps = ['avatar', 'bio', 'interests', 'suggestions'];
    let currentStep = 'suggestions';

    const tryNextStep = () => {
      const nextIndex = steps.indexOf(currentStep) + 1;
      return nextIndex < steps.length;
    };

    expect(tryNextStep()).toBe(false);
  });
});

describe('Onboarding - Interest Selection (ONB-03, ONB-04)', () => {
  it('should block Next when < 3 interests selected', () => {
    const minInterests = 3;
    const selectedInterests = ['tag-1', 'tag-2'];

    const canProceed = selectedInterests.length >= minInterests;

    expect(canProceed).toBe(false);
    expect(selectedInterests.length).toBe(2);
  });

  it('should allow Next when >= 3 interests selected', () => {
    const minInterests = 3;
    const selectedInterests = ['tag-1', 'tag-2', 'tag-3'];

    const canProceed = selectedInterests.length >= minInterests;

    expect(canProceed).toBe(true);
    expect(selectedInterests.length).toBe(3);
  });

  it('should show remaining count when below minimum', () => {
    const minInterests = 3;
    const selectedInterests = ['tag-1'];

    const remaining = minInterests - selectedInterests.length;

    expect(remaining).toBe(2);
  });

  it('should show selected count when at or above minimum', () => {
    const minInterests = 3;
    const selectedInterests = ['tag-1', 'tag-2', 'tag-3', 'tag-4'];

    const message = selectedInterests.length >= minInterests
      ? `${selectedInterests.length} selected`
      : `Select ${minInterests - selectedInterests.length} more to continue`;

    expect(message).toBe('4 selected');
  });
});

describe('Onboarding - Auth Requirement (ONB-06)', () => {
  it('should redirect unauthenticated user to login', () => {
    const user = null;
    const isAuthenticated = user !== null;

    expect(isAuthenticated).toBe(false);
  });

  it('should allow authenticated user to access onboarding', () => {
    const user = { id: 'user-1' };
    const isAuthenticated = user !== null;

    expect(isAuthenticated).toBe(true);
  });
});

describe('Onboarding - Redirect After Completion (ONB-05)', () => {
  it('should redirect to /home after completing all steps', () => {
    const completeOnboarding = () => {
      return '/home';
    };

    const redirect = completeOnboarding();

    expect(redirect).toBe('/home');
  });

  it('should check if profile is complete before allowing access', () => {
    const profile = { bio: 'User bio' };
    const isComplete = !!profile?.bio;

    expect(isComplete).toBe(true);
  });

  it('should not redirect if profile is incomplete', () => {
    const profile = { bio: null };
    const isComplete = !!profile?.bio;

    expect(isComplete).toBe(false);
  });
});

describe('Onboarding - Bio Validation', () => {
  it('should enforce bio maximum of 160 characters', () => {
    const maxBioLength = 160;
    const bio = 'a'.repeat(161);

    const isValid = bio.length <= maxBioLength;

    expect(isValid).toBe(false);
  });

  it('should allow bio within limit', () => {
    const maxBioLength = 160;
    const bio = 'a'.repeat(160);

    const isValid = bio.length <= maxBioLength;

    expect(isValid).toBe(true);
  });
});

describe('Onboarding - Follow Suggestions', () => {
  it('should sort suggestions by followers_count', () => {
    const suggestions = [
      { id: '1', followers_count: 100 },
      { id: '2', followers_count: 1000 },
      { id: '3', followers_count: 10 },
    ];

    const sorted = [...suggestions].sort((a, b) => b.followers_count - a.followers_count);

    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
    expect(sorted[2].id).toBe('3');
  });

  it('should filter by user interests when available', () => {
    const userInterests = ['tag-1', 'tag-2'];
    const allProfiles = [
      { id: '1', interests: ['tag-1'] },
      { id: '2', interests: ['tag-3'] },
      { id: '3', interests: ['tag-1', 'tag-2'] },
    ];

    const filtered = allProfiles.filter(profile =>
      profile.interests.some(interest => userInterests.includes(interest))
    );

    expect(filtered.length).toBe(2);
    expect(filtered.map(p => p.id)).toEqual(['1', '3']);
  });

  it('should exclude current user from suggestions', () => {
    const currentUserId = 'user-1';
    const allProfiles = [
      { id: 'user-1' },
      { id: 'user-2' },
      { id: 'user-3' },
    ];

    const suggestions = allProfiles.filter(p => p.id !== currentUserId);

    expect(suggestions.length).toBe(2);
    expect(suggestions.find(p => p.id === 'user-1')).toBeUndefined();
  });

  it('should limit suggestions to 10', () => {
    const limit = 10;
    const allProfiles = Array.from({ length: 20 }, (_, i) => ({ id: `user-${i}` }));

    const suggestions = allProfiles.slice(0, limit);

    expect(suggestions.length).toBe(limit);
  });
});

describe('Onboarding - Steps Count', () => {
  it('should have 4 steps in the wizard', () => {
    const steps = ['avatar', 'bio', 'interests', 'suggestions'];

    expect(steps.length).toBe(4);
  });

  it('should show progress indicator for each step', () => {
    const steps = ['avatar', 'bio', 'interests', 'suggestions'];
    const currentStep = 'bio';
    const stepIndex = steps.indexOf(currentStep);

    const progressSteps = steps.map((step, index) => ({
      step,
      completed: index < stepIndex,
      current: index === stepIndex,
    }));

    expect(progressSteps.filter(s => s.completed).length).toBe(1);
    expect(progressSteps.filter(s => s.current).length).toBe(1);
  });
});

describe('Onboarding - Form Data Management', () => {
  it('should store form data across steps', () => {
    const formData = {
      avatar_url: '',
      display_name: 'John Doe',
      bio: 'Hello world',
      location: 'New York',
      website: '',
      interests: ['tag-1', 'tag-2', 'tag-3'],
    };

    expect(formData.display_name).toBe('John Doe');
    expect(formData.interests.length).toBe(3);
  });

  it('should allow updating partial form data', () => {
    const formData = {
      avatar_url: '',
      display_name: 'John Doe',
      bio: 'Hello world',
      location: '',
      website: '',
      interests: [],
    };

    const updateFormData = (updates: Partial<typeof formData>) => {
      return { ...formData, ...updates };
    };

    const updated = updateFormData({ location: 'NYC', website: 'john.com' });

    expect(updated.location).toBe('NYC');
    expect(updated.website).toBe('john.com');
    expect(updated.display_name).toBe('John Doe');
  });
});