import { cn } from '../utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-200');
      expect(result).toBe('text-red-500 bg-blue-200');
    });

    it('should handle conditional class names', () => {
      const result = cn('base-class', {
        'conditional-class': true,
        'not-applied': false,
      });
      expect(result).toBe('base-class conditional-class');
    });

    it('should merge Tailwind classes correctly', () => {
      // This test verifies tailwind-merge is working
      const result = cn('px-2', 'px-4'); // px-4 should override px-2
      expect(result).toBe('px-4');
    });

    it('should handle undefined and null values', () => {
      const result = cn('base', undefined, null, 'end');
      expect(result).toBe('base end');
    });

    it('should handle arrays', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });
  });
});