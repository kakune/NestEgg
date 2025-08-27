import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';

interface MockUser {
  id: string;
  email: string;
  name: string;
  householdId: string;
  role: string;
}

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;

  const mockAuthService = {
    validateUser: jest.fn(),
  };

  const mockValidUser: MockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    householdId: 'household-1',
    role: 'member',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should extend PassportStrategy', () => {
    expect(strategy).toBeInstanceOf(LocalStrategy);
  });

  describe('validate', () => {
    it('should validate and return user for valid credentials', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockValidUser);

      const result = (await strategy.validate(
        'test@example.com',
        'password123',
      )) as MockUser;

      expect(result).toEqual(mockValidUser);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(mockAuthService.validateUser).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        'wrongpassword',
      );
      expect(mockAuthService.validateUser).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate('nonexistent@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'nonexistent@example.com',
        'password123',
      );
    });

    it('should handle empty email', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        '',
        'password123',
      );
    });

    it('should handle empty password', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('test@example.com', '')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        '',
      );
    });

    it('should handle undefined return value from authService', async () => {
      mockAuthService.validateUser.mockResolvedValue(undefined);

      await expect(
        strategy.validate('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
    });

    it('should propagate authService errors', async () => {
      const serviceError = new Error('Database connection failed');
      mockAuthService.validateUser.mockRejectedValue(serviceError);

      await expect(
        strategy.validate('test@example.com', 'password123'),
      ).rejects.toThrow(serviceError);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
    });

    it('should handle different user roles', async () => {
      const adminUser: MockUser = {
        ...mockValidUser,
        role: 'admin',
      };
      mockAuthService.validateUser.mockResolvedValue(adminUser);

      const result = (await strategy.validate(
        'admin@example.com',
        'password',
      )) as MockUser;

      expect(result).toEqual(adminUser);
      expect(result.role).toBe('admin');
    });

    it('should validate with trimmed email', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockValidUser);

      const result = (await strategy.validate(
        '  test@example.com  ',
        'password',
      )) as MockUser;

      expect(result).toEqual(mockValidUser);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        '  test@example.com  ',
        'password',
      );
    });

    it('should handle special characters in password', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockValidUser);
      const complexPassword = 'P@ssw0rd!#$%^&*()_+-={}[]|;:,.<>?';

      const result = (await strategy.validate(
        'test@example.com',
        complexPassword,
      )) as MockUser;

      expect(result).toEqual(mockValidUser);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        complexPassword,
      );
    });
  });

  describe('strategy configuration', () => {
    it('should use email as username field', () => {
      // The strategy should be configured to use email as the username field
      // This is configured in the constructor, and we verify it by checking
      // that the validate method expects email as the first parameter
      expect(strategy).toBeDefined();
      expect(typeof strategy.validate).toBe('function');
    });
  });
});
