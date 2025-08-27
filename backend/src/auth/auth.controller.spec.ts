import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRole } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    createPersonalAccessToken: jest.fn(),
    revokePersonalAccessToken: jest.fn(),
  };

  const mockUser = {
    userId: 'user-1',
    email: 'test@example.com',
    householdId: 'household-1',
    role: UserRole.member,
    sessionId: 'session-1',
  };

  const mockAuthResponse = {
    access_token: 'jwt-token',
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      householdId: 'household-1',
      role: UserRole.member,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile();

    controller = module.get<AuthController>(AuthController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'StrongPassword123!',
        name: 'New User',
      };

      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it('should handle registration with household name', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'StrongPassword123!',
        name: 'New User',
        householdName: 'New Household',
      };

      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const error = new Error('Invalid credentials');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow(error);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('logout', () => {
    it('should logout a user with session', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      await controller.logout('session-123');

      expect(mockAuthService.logout).toHaveBeenCalledWith('session-123');
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });

    it('should handle logout without session', async () => {
      // Test with an undefined session which should be handled by the controller
      const result = await controller.logout('' as string);

      expect(result).toBeUndefined();
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('should handle logout with empty session', async () => {
      await controller.logout('');

      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return user profile', () => {
      const result = controller.getProfile(mockUser);

      expect(result).toEqual({
        user: {
          id: mockUser.userId,
          email: mockUser.email,
          householdId: mockUser.householdId,
          role: mockUser.role,
        },
      });
    });

    it('should handle different user roles', () => {
      const adminUser = {
        ...mockUser,
        role: UserRole.admin,
      };

      const result = controller.getProfile(adminUser);

      expect(result.user.role).toBe(UserRole.admin);
    });
  });

  describe('createPersonalAccessToken', () => {
    it('should create a personal access token', async () => {
      const createPatDto = {
        name: 'API Token',
        expiresIn: '30d',
      };

      const mockResponse = {
        token: 'pat-token-123',
        id: 'token-id-123',
      };

      mockAuthService.createPersonalAccessToken.mockResolvedValue(mockResponse);

      const result = await controller.createPersonalAccessToken(
        'user-1',
        createPatDto,
      );

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.createPersonalAccessToken).toHaveBeenCalledWith(
        'user-1',
        createPatDto,
      );
      expect(mockAuthService.createPersonalAccessToken).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should handle token creation with custom expiration', async () => {
      const createPatDto = {
        name: 'Short-lived Token',
        expiresIn: '1h',
      };

      const mockResponse = {
        token: 'pat-token-short',
        id: 'token-id-short',
      };

      mockAuthService.createPersonalAccessToken.mockResolvedValue(mockResponse);

      const result = await controller.createPersonalAccessToken(
        'user-2',
        createPatDto,
      );

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.createPersonalAccessToken).toHaveBeenCalledWith(
        'user-2',
        createPatDto,
      );
    });
  });

  describe('revokePersonalAccessToken', () => {
    it('should revoke a personal access token', async () => {
      mockAuthService.revokePersonalAccessToken.mockResolvedValue(undefined);

      await controller.revokePersonalAccessToken('user-1', 'token-id-123');

      expect(mockAuthService.revokePersonalAccessToken).toHaveBeenCalledWith(
        'user-1',
        'token-id-123',
      );
      expect(mockAuthService.revokePersonalAccessToken).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should handle token not found', async () => {
      const error = new Error('Token not found');
      mockAuthService.revokePersonalAccessToken.mockRejectedValue(error);

      await expect(
        controller.revokePersonalAccessToken('user-1', 'invalid-token'),
      ).rejects.toThrow(error);

      expect(mockAuthService.revokePersonalAccessToken).toHaveBeenCalledWith(
        'user-1',
        'invalid-token',
      );
    });

    it('should handle unauthorized token revocation', async () => {
      const error = new Error('Unauthorized');
      mockAuthService.revokePersonalAccessToken.mockRejectedValue(error);

      await expect(
        controller.revokePersonalAccessToken('user-2', 'token-id-123'),
      ).rejects.toThrow(error);

      expect(mockAuthService.revokePersonalAccessToken).toHaveBeenCalledWith(
        'user-2',
        'token-id-123',
      );
    });
  });
});
