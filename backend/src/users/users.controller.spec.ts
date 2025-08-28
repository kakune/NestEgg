import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import type { PublicUser } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'test@example.com',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockAdminUser: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'admin@example.com',
    householdId: 'household-1',
    role: UserRole.admin,
  };

  const mockPublicUser: PublicUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    householdId: 'household-1',
    role: UserRole.member,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changePassword: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile();

    controller = module.get<UsersController>(UsersController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users in the household', async () => {
      const mockUsers = [mockPublicUser];
      mockUsersService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(mockUsers);
      expect(mockUsersService.findAll).toHaveBeenCalledWith(mockUser);
      expect(mockUsersService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no users exist', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual([]);
      expect(mockUsersService.findAll).toHaveBeenCalledWith(mockUser);
    });

    it('should handle multiple users', async () => {
      const multipleUsers = [
        mockPublicUser,
        {
          ...mockPublicUser,
          id: 'user-2',
          email: 'user2@example.com',
          username: 'user2',
          name: 'User Two',
        },
      ];
      mockUsersService.findAll.mockResolvedValue(multipleUsers);

      const result = await controller.findAll(mockUser);

      expect(result).toHaveLength(2);
      expect(result).toEqual(multipleUsers);
    });
  });

  describe('findOne', () => {
    it('should return a specific user', async () => {
      mockUsersService.findOne.mockResolvedValue(mockPublicUser);

      const result = await controller.findOne('user-1', mockUser);

      expect(result).toEqual(mockPublicUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-1', mockUser);
      expect(mockUsersService.findOne).toHaveBeenCalledTimes(1);
    });

    it('should handle user not found', async () => {
      const error = new Error('User not found');
      mockUsersService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('invalid-id', mockUser)).rejects.toThrow(
        error,
      );
      expect(mockUsersService.findOne).toHaveBeenCalledWith(
        'invalid-id',
        mockUser,
      );
    });

    it('should handle unauthorized access', async () => {
      const error = new Error('Unauthorized');
      mockUsersService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('user-2', mockUser)).rejects.toThrow(
        error,
      );
    });
  });

  describe('create', () => {
    it('should create a new user (admin only)', async () => {
      const createUserDto = {
        email: 'newuser@example.com',
        username: 'newuser',
        name: 'New User',
        role: UserRole.member,
        householdId: 'household-1',
      };

      const newUser: PublicUser = {
        id: 'user-new',
        email: 'newuser@example.com',
        username: 'newuser',
        name: 'New User',
        householdId: 'household-1',
        role: UserRole.member,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockUsersService.create.mockResolvedValue(newUser);

      const result = await controller.create(createUserDto, mockAdminUser);

      expect(result).toEqual(newUser);
      expect(mockUsersService.create).toHaveBeenCalledWith(
        createUserDto,
        mockAdminUser,
      );
      expect(mockUsersService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors', async () => {
      const createUserDto = {
        email: 'invalid-email',
        username: 'invaliduser',
        name: '',
        role: UserRole.member,
        householdId: 'household-1',
      };

      const error = new Error('Validation failed');
      mockUsersService.create.mockRejectedValue(error);

      await expect(
        controller.create(createUserDto, mockAdminUser),
      ).rejects.toThrow(error);
      expect(mockUsersService.create).toHaveBeenCalledWith(
        createUserDto,
        mockAdminUser,
      );
    });

    it('should handle duplicate email', async () => {
      const createUserDto = {
        email: 'existing@example.com',
        username: 'existinguser',
        name: 'Duplicate User',
        role: UserRole.member,
        householdId: 'household-1',
      };

      const error = new Error('Email already exists');
      mockUsersService.create.mockRejectedValue(error);

      await expect(
        controller.create(createUserDto, mockAdminUser),
      ).rejects.toThrow(error);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const updatedUser = {
        ...mockPublicUser,
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-1', updateUserDto, mockUser);

      expect(result).toEqual(updatedUser);
      expect(mockUsersService.update).toHaveBeenCalledWith(
        'user-1',
        updateUserDto,
        mockUser,
      );
      expect(mockUsersService.update).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const updateUserDto = {
        name: 'New Name Only',
      };

      const updatedUser = {
        ...mockPublicUser,
        name: 'New Name Only',
      };

      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-1', updateUserDto, mockUser);

      expect(result).toEqual(updatedUser);
      expect(mockUsersService.update).toHaveBeenCalledWith(
        'user-1',
        updateUserDto,
        mockUser,
      );
    });

    it('should handle user not found', async () => {
      const updateUserDto = { name: 'Updated' };
      const error = new Error('User not found');
      mockUsersService.update.mockRejectedValue(error);

      await expect(
        controller.update('invalid-id', updateUserDto, mockUser),
      ).rejects.toThrow(error);
    });
  });

  describe('changePassword', () => {
    it('should change user password', async () => {
      const changePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
      };

      mockUsersService.changePassword.mockResolvedValue(undefined);

      const result = await controller.changePassword(
        'user-1',
        changePasswordDto,
        mockUser,
      );

      expect(result).toBeUndefined();
      expect(mockUsersService.changePassword).toHaveBeenCalledWith(
        'user-1',
        changePasswordDto,
        mockUser,
      );
      expect(mockUsersService.changePassword).toHaveBeenCalledTimes(1);
    });

    it('should handle incorrect current password', async () => {
      const changePasswordDto = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword456!',
      };

      const error = new Error('Current password is incorrect');
      mockUsersService.changePassword.mockRejectedValue(error);

      await expect(
        controller.changePassword('user-1', changePasswordDto, mockUser),
      ).rejects.toThrow(error);
    });

    it('should handle weak new password', async () => {
      const changePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'weak',
      };

      const error = new Error('Password does not meet requirements');
      mockUsersService.changePassword.mockRejectedValue(error);

      await expect(
        controller.changePassword('user-1', changePasswordDto, mockUser),
      ).rejects.toThrow(error);
    });

    it('should prevent unauthorized password change', async () => {
      const changePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
      };

      const error = new Error('Unauthorized');
      mockUsersService.changePassword.mockRejectedValue(error);

      await expect(
        controller.changePassword('user-2', changePasswordDto, mockUser),
      ).rejects.toThrow(error);
    });
  });

  describe('remove', () => {
    it('should remove a user (admin only)', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('user-1', mockAdminUser);

      expect(result).toBeUndefined();
      expect(mockUsersService.remove).toHaveBeenCalledWith(
        'user-1',
        mockAdminUser,
      );
      expect(mockUsersService.remove).toHaveBeenCalledTimes(1);
    });

    it('should handle user not found', async () => {
      const error = new Error('User not found');
      mockUsersService.remove.mockRejectedValue(error);

      await expect(
        controller.remove('invalid-id', mockAdminUser),
      ).rejects.toThrow(error);
      expect(mockUsersService.remove).toHaveBeenCalledWith(
        'invalid-id',
        mockAdminUser,
      );
    });

    it('should prevent self-deletion', async () => {
      const error = new Error('Cannot delete yourself');
      mockUsersService.remove.mockRejectedValue(error);

      await expect(controller.remove('admin-1', mockAdminUser)).rejects.toThrow(
        error,
      );
    });

    it('should prevent deletion of last admin', async () => {
      const error = new Error('Cannot delete the last admin');
      mockUsersService.remove.mockRejectedValue(error);

      await expect(
        controller.remove('other-admin', mockAdminUser),
      ).rejects.toThrow(error);
    });
  });
});
