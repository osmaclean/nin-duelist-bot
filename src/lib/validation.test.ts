import { describe, expect, it } from 'vitest';
import { sanitizeText, validateScore } from './validation';

describe('lib/validation', () => {
  describe('sanitizeText', () => {
    it('should pass through normal text', () => {
      expect(sanitizeText('Hello world')).toBe('Hello world');
    });

    it('should neutralize @everyone', () => {
      expect(sanitizeText('@everyone look!')).toBe('@\u200beveryone look!');
    });

    it('should neutralize @here', () => {
      expect(sanitizeText('@here check this')).toBe('@\u200bhere check this');
    });

    it('should be case-insensitive for mentions', () => {
      expect(sanitizeText('@EVERYONE @Here')).toBe('@\u200bEVERYONE @\u200bHere');
    });

    it('should trim whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });

    it('should truncate to maxLength', () => {
      const long = 'a'.repeat(600);
      expect(sanitizeText(long, 100)).toHaveLength(100);
    });

    it('should use default maxLength of 500', () => {
      const long = 'a'.repeat(600);
      expect(sanitizeText(long)).toHaveLength(500);
    });
  });

  describe('validateScore', () => {
    it('should accept 1-0 for MD1', () => {
      expect(validateScore('MD1', 1, 0)).toBe(true);
    });

    it('should reject other scores for MD1', () => {
      expect(validateScore('MD1', 2, 0)).toBe(false);
      expect(validateScore('MD1', 2, 1)).toBe(false);
      expect(validateScore('MD1', 0, 1)).toBe(false);
    });

    it('should accept 2-0 and 2-1 for MD3', () => {
      expect(validateScore('MD3', 2, 0)).toBe(true);
      expect(validateScore('MD3', 2, 1)).toBe(true);
    });

    it('should reject other scores for MD3', () => {
      expect(validateScore('MD3', 1, 0)).toBe(false);
      expect(validateScore('MD3', 3, 0)).toBe(false);
      expect(validateScore('MD3', 1, 2)).toBe(false);
      expect(validateScore('MD3', 0, 2)).toBe(false);
    });

    it('should reject negative scores', () => {
      expect(validateScore('MD1', -1, 0)).toBe(false);
      expect(validateScore('MD3', 2, -1)).toBe(false);
    });

    it('should reject non-integer scores', () => {
      expect(validateScore('MD1', 1.5, 0)).toBe(false);
      expect(validateScore('MD3', 2, 0.5)).toBe(false);
    });
  });
});
