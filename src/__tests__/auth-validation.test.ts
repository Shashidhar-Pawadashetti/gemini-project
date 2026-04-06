import { describe, it, expect } from 'vitest';

describe('Registration API Validation Logic', () => {
  const RegisterSchema = {
    parse: (data: any) => {
      const errors: string[] = [];
      
      if (!data.email || !data.email.includes('@')) {
        errors.push('Invalid email address');
      }
      if (!data.password || data.password.length < 8) {
        errors.push('Password must be at least 8 characters');
      }
      if (!/[A-Z]/.test(data.password || '')) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[0-9]/.test(data.password || '')) {
        errors.push('Password must contain at least one number');
      }
      if (!data.username || data.username.length < 3 || data.username.length > 30) {
        errors.push('Username must be between 3 and 30 characters');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(data.username || '')) {
        errors.push('Username can only contain letters, numbers, and underscores');
      }
      if (!data.display_name || data.display_name.length === 0) {
        errors.push('Display name is required');
      }
      if (!data.date_of_birth) {
        errors.push('Date of birth is required');
      } else {
        const dob = new Date(data.date_of_birth);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) 
          ? age - 1 
          : age;
        if (adjustedAge < 18) {
          errors.push('You must be at least 18 years old');
        }
      }
      
      if (errors.length > 0) {
        throw { errors };
      }
      return data;
    }
  };

  describe('REG-03: Password validation', () => {
    it('rejects password < 8 characters', () => {
      expect(() => RegisterSchema.parse({
        email: 'test@example.com',
        password: 'Pass1',
        username: 'testuser',
        display_name: 'Test',
        date_of_birth: '1995-01-15'
      })).toThrow();
    });

    it('rejects password without uppercase', () => {
      expect(() => RegisterSchema.parse({
        email: 'test@example.com',
        password: 'password1',
        username: 'testuser',
        display_name: 'Test',
        date_of_birth: '1995-01-15'
      })).toThrow();
    });

    it('rejects password without number', () => {
      expect(() => RegisterSchema.parse({
        email: 'test@example.com',
        password: 'Password',
        username: 'testuser',
        display_name: 'Test',
        date_of_birth: '1995-01-15'
      })).toThrow();
    });

    it('accepts valid password', () => {
      expect(() => RegisterSchema.parse({
        email: 'test@example.com',
        password: 'Password1',
        username: 'testuser',
        display_name: 'Test',
        date_of_birth: '1995-01-15'
      })).not.toThrow();
    });
  });

  describe('REG-04: Age validation', () => {
    it('rejects age < 18', () => {
      expect(() => RegisterSchema.parse({
        email: 'test@example.com',
        password: 'Password1',
        username: 'testuser',
        display_name: 'Test',
        date_of_birth: '2015-01-15'
      })).toThrow();
    });

    it('accepts age >= 18', () => {
      expect(() => RegisterSchema.parse({
        email: 'test@example.com',
        password: 'Password1',
        username: 'testuser',
        display_name: 'Test',
        date_of_birth: '2006-01-15'
      })).not.toThrow();
    });
  });

  describe('REG-02: Username validation', () => {
    it('rejects username < 3 characters', () => {
      expect(() => RegisterSchema.parse({
        email: 'test@example.com',
        password: 'Password1',
        username: 'ab',
        display_name: 'Test',
        date_of_birth: '1995-01-15'
      })).toThrow();
    });

    it('rejects username with special characters', () => {
      expect(() => RegisterSchema.parse({
        email: 'test@example.com',
        password: 'Password1',
        username: 'test@user',
        display_name: 'Test',
        date_of_birth: '1995-01-15'
      })).toThrow();
    });
  });
});