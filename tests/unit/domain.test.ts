import { describe, it, expect } from 'vitest';
import { TripRules } from '../../src/domain/rules/trip-rules.js';
import { PasswordRules } from '../../src/domain/rules/password-rules.js';
import { TripStateMachine } from '../../src/domain/state-machines/trip-status.js';
import { UserStateMachine } from '../../src/domain/state-machines/user-status.js';

describe('Domain Rules & State Machines', () => {
  describe('PasswordRules (BR-009)', () => {
    it('should accept valid passwords with >= 8 chars, letter and number', () => {
      expect(() => PasswordRules.validate('SecurePass123')).not.toThrow();
    });

    it('should reject passwords shorter than 8 characters', () => {
      expect(() => PasswordRules.validate('Pass1')).toThrow(/at least 8 characters/);
    });

    it('should reject passwords without numbers', () => {
      expect(() => PasswordRules.validate('PasswordOnly')).toThrow(/at least one digit/);
    });

    it('should reject passwords without letters', () => {
      expect(() => PasswordRules.validate('123456789')).toThrow(/at least one letter/);
    });
  });

  describe('TripRules (BR-001, BR-002)', () => {
    it('should accept valid trip dates where startDate <= endDate', () => {
      expect(() => TripRules.validateTripDates('2026-06-01', '2026-06-15')).not.toThrow();
    });

    it('should reject invalid trip dates where startDate > endDate', () => {
      expect(() => TripRules.validateTripDates('2026-06-15', '2026-06-01')).toThrow(/start date must be before or equal/);
    });

    it('should accept stop dates falling strictly inside parent trip dates', () => {
      expect(() =>
        TripRules.validateStopDates('2026-06-02', '2026-06-05', '2026-06-01', '2026-06-15')
      ).not.toThrow();
    });

    it('should reject stop dates falling outside parent trip dates', () => {
      expect(() =>
        TripRules.validateStopDates('2026-05-28', '2026-06-05', '2026-06-01', '2026-06-15')
      ).toThrow(/must fall within trip date range/);
    });

    it('should accept item dates falling within stop date range', () => {
      expect(() => TripRules.validateItemDate('2026-06-03', '2026-06-02', '2026-06-05')).not.toThrow();
    });

    it('should reject item dates falling outside stop date range', () => {
      expect(() => TripRules.validateItemDate('2026-06-06', '2026-06-02', '2026-06-05')).toThrow(/must fall within stop date range/);
    });
  });

  describe('TripStateMachine (BR-023, BR-024)', () => {
    it('should allow draft -> planned only when stopCount >= 1', () => {
      expect(TripStateMachine.isValidTransition('draft', 'planned', 0)).toBe(false);
      expect(TripStateMachine.isValidTransition('draft', 'planned', 1)).toBe(true);
    });

    it('should allow planned -> ongoing and ongoing -> completed', () => {
      expect(TripStateMachine.isValidTransition('planned', 'ongoing')).toBe(true);
      expect(TripStateMachine.isValidTransition('ongoing', 'completed')).toBe(true);
    });

    it('should forbid transitions out of completed or cancelled (terminal states)', () => {
      expect(TripStateMachine.isValidTransition('completed', 'ongoing')).toBe(false);
      expect(TripStateMachine.isValidTransition('cancelled', 'planned')).toBe(false);
    });
  });

  describe('UserStateMachine (BR-016, ARCH-030)', () => {
    it('should forbid suspending an admin user', () => {
      expect(() => UserStateMachine.assertStatusChange('admin', 'active', 'suspended')).toThrow(
        /Admin users cannot be suspended/
      );
    });

    it('should allow suspending regular users', () => {
      expect(() => UserStateMachine.assertStatusChange('user', 'active', 'suspended')).not.toThrow();
    });
  });
});
