'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AvatarStep } from './steps/avatar-step';
import { BioStep } from './steps/bio-step';
import { InterestsStep } from './steps/interests-step';
import { SuggestionsStep } from './steps/suggestions-step';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface OnboardingWizardProps {
  userId: string;
}

type Step = 'avatar' | 'bio' | 'interests' | 'suggestions';
const steps: Step[] = ['avatar', 'bio', 'interests', 'suggestions'];

export function OnboardingWizard({ userId }: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('avatar');
  const [formData, setFormData] = useState({
    avatar_url: '',
    display_name: '',
    bio: '',
    location: '',
    website: '',
    interests: [] as string[],
  });
  const stepIndex = steps.indexOf(currentStep);

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    } else {
      router.push('/home');
    }
  };

  const prevStep = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'avatar':
        return (
          <AvatarStep
            userId={userId}
            onNext={nextStep}
            onUpdate={(avatar_url) => updateFormData({ avatar_url })}
          />
        );
      case 'bio':
        return (
          <BioStep
            userId={userId}
            initialData={{ display_name: formData.display_name, bio: formData.bio, location: formData.location, website: formData.website }}
            onNext={nextStep}
            onUpdate={updateFormData}
          />
        );
      case 'interests':
        return (
          <InterestsStep
            userId={userId}
            selectedInterests={formData.interests}
            onNext={nextStep}
            onUpdate={(interests) => updateFormData({ interests })}
          />
        );
      case 'suggestions':
        return (
          <SuggestionsStep
            userId={userId}
            selectedInterests={formData.interests}
            onComplete={() => router.push('/home')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-center">Welcome to Pulse</h1>
          <p className="text-muted-foreground text-center mt-1">
            Let&apos;s set up your profile
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index < stepIndex || (index === stepIndex && step === 'suggestions' && currentStep === 'suggestions')
                    ? 'bg-primary text-primary-foreground'
                    : index === stepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < stepIndex ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${
                  index < stepIndex ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-lg border p-6">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
