import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let categoriesService: CategoriesService;

  const mockUser = {
    userId: 'user-1',
    householdId: 'household-1',
    role: 'admin' as any,
  };

  const mockCategory = {
    id: 'category-1',
    name: 'Test Category',
    parentId: null,
    description: 'Test Description',
    householdId: 'household-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCategoryWithChildren = {
    ...mockCategory,
    children: [],
    parent: null,
  };

  const mockCategoriesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getCategoryTree: jest.fn(),
    getCategoryPath: jest.fn(),
    getCategoryStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
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

    controller = module.get<CategoriesController>(CategoriesController);
    categoriesService = module.get<CategoriesService>(CategoriesService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const mockCategories = [mockCategoryWithChildren];
      mockCategoriesService.findAll.mockResolvedValue(mockCategories);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(mockCategories);
      expect(mockCategoriesService.findAll).toHaveBeenCalledWith({
        userId: mockUser.userId,
        householdId: mockUser.householdId,
        role: mockUser.role,
      });
    });

    it('should pass correct auth context', async () => {
      mockCategoriesService.findAll.mockResolvedValue([]);

      await controller.findAll(mockUser);

      expect(mockCategoriesService.findAll).toHaveBeenCalledWith({
        userId: 'user-1',
        householdId: 'household-1',
        role: 'admin',
      });
    });
  });

  describe('getCategoryTree', () => {
    it('should return category tree', async () => {
      const mockTree = [mockCategoryWithChildren];
      mockCategoriesService.getCategoryTree.mockResolvedValue(mockTree);

      const result = await controller.getCategoryTree(mockUser);

      expect(result).toEqual(mockTree);
      expect(mockCategoriesService.getCategoryTree).toHaveBeenCalledWith({
        userId: mockUser.userId,
        householdId: mockUser.householdId,
        role: mockUser.role,
      });
    });
  });

  describe('findOne', () => {
    it('should return a specific category', async () => {
      mockCategoriesService.findOne.mockResolvedValue(mockCategoryWithChildren);

      const result = await controller.findOne('category-1', mockUser);

      expect(result).toEqual(mockCategoryWithChildren);
      expect(mockCategoriesService.findOne).toHaveBeenCalledWith(
        'category-1',
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });

    it('should pass correct category ID and auth context', async () => {
      mockCategoriesService.findOne.mockResolvedValue(mockCategoryWithChildren);

      await controller.findOne('test-id', mockUser);

      expect(mockCategoriesService.findOne).toHaveBeenCalledWith(
        'test-id',
        {
          userId: 'user-1',
          householdId: 'household-1',
          role: 'admin',
        }
      );
    });
  });

  describe('getCategoryPath', () => {
    it('should return category path', async () => {
      const mockPath = [mockCategory];
      mockCategoriesService.getCategoryPath.mockResolvedValue(mockPath);

      const result = await controller.getCategoryPath('category-1', mockUser);

      expect(result).toEqual(mockPath);
      expect(mockCategoriesService.getCategoryPath).toHaveBeenCalledWith(
        'category-1',
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });
  });

  describe('getCategoryStats', () => {
    it('should return category statistics', async () => {
      const mockStats = {
        category: mockCategory,
        statistics: {
          directTransactions: 5,
          directAmount: 1000,
          descendantTransactions: 2,
          descendantAmount: 500,
          totalTransactions: 7,
          totalAmount: 1500,
          childrenCount: 1,
        },
      };
      mockCategoriesService.getCategoryStats.mockResolvedValue(mockStats);

      const result = await controller.getCategoryStats('category-1', mockUser);

      expect(result).toEqual(mockStats);
      expect(mockCategoriesService.getCategoryStats).toHaveBeenCalledWith(
        'category-1',
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });
  });

  describe('create', () => {
    const createCategoryDto = {
      name: 'New Category',
      description: 'New Description',
    };

    it('should create a new category', async () => {
      mockCategoriesService.create.mockResolvedValue(mockCategory);

      const result = await controller.create(createCategoryDto, mockUser);

      expect(result).toEqual(mockCategory);
      expect(mockCategoriesService.create).toHaveBeenCalledWith(
        createCategoryDto,
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });

    it('should handle create with parent ID', async () => {
      const createCategoryDtoWithParent = {
        ...createCategoryDto,
        parentId: 'parent-category',
      };
      mockCategoriesService.create.mockResolvedValue(mockCategory);

      const result = await controller.create(createCategoryDtoWithParent, mockUser);

      expect(result).toEqual(mockCategory);
      expect(mockCategoriesService.create).toHaveBeenCalledWith(
        createCategoryDtoWithParent,
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });

    it('should pass correct auth context for different user roles', async () => {
      const memberUser = { ...mockUser, role: 'member' };
      mockCategoriesService.create.mockResolvedValue(mockCategory);

      await controller.create(createCategoryDto, memberUser);

      expect(mockCategoriesService.create).toHaveBeenCalledWith(
        createCategoryDto,
        {
          userId: memberUser.userId,
          householdId: memberUser.householdId,
          role: 'member',
        }
      );
    });
  });

  describe('update', () => {
    const updateCategoryDto = {
      name: 'Updated Category',
      description: 'Updated Description',
    };

    it('should update a category', async () => {
      const updatedCategory = { ...mockCategory, ...updateCategoryDto };
      mockCategoriesService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update('category-1', updateCategoryDto, mockUser);

      expect(result).toEqual(updatedCategory);
      expect(mockCategoriesService.update).toHaveBeenCalledWith(
        'category-1',
        updateCategoryDto,
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { name: 'New Name Only' };
      const updatedCategory = { ...mockCategory, name: 'New Name Only' };
      mockCategoriesService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update('category-1', partialUpdate, mockUser);

      expect(result).toEqual(updatedCategory);
      expect(mockCategoriesService.update).toHaveBeenCalledWith(
        'category-1',
        partialUpdate,
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });

    it('should handle parent ID changes', async () => {
      const updateWithNewParent = {
        ...updateCategoryDto,
        parentId: 'new-parent-id',
      };
      const updatedCategory = { ...mockCategory, ...updateWithNewParent };
      mockCategoriesService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update('category-1', updateWithNewParent, mockUser);

      expect(result).toEqual(updatedCategory);
      expect(mockCategoriesService.update).toHaveBeenCalledWith(
        'category-1',
        updateWithNewParent,
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });

    it('should pass correct category ID and auth context', async () => {
      mockCategoriesService.update.mockResolvedValue(mockCategory);

      await controller.update('test-category-id', updateCategoryDto, mockUser);

      expect(mockCategoriesService.update).toHaveBeenCalledWith(
        'test-category-id',
        updateCategoryDto,
        {
          userId: 'user-1',
          householdId: 'household-1',
          role: 'admin',
        }
      );
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      mockCategoriesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('category-1', mockUser);

      expect(result).toBeUndefined();
      expect(mockCategoriesService.remove).toHaveBeenCalledWith(
        'category-1',
        {
          userId: mockUser.userId,
          householdId: mockUser.householdId,
          role: mockUser.role,
        }
      );
    });

    it('should pass correct category ID and auth context', async () => {
      mockCategoriesService.remove.mockResolvedValue(undefined);

      await controller.remove('test-delete-id', mockUser);

      expect(mockCategoriesService.remove).toHaveBeenCalledWith(
        'test-delete-id',
        {
          userId: 'user-1',
          householdId: 'household-1',
          role: 'admin',
        }
      );
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Service error');
      mockCategoriesService.remove.mockRejectedValue(serviceError);

      await expect(controller.remove('category-1', mockUser))
        .rejects.toThrow('Service error');
    });
  });

  describe('auth context creation', () => {
    it('should create consistent auth context across all methods', async () => {
      const testUser = {
        userId: 'test-user',
        householdId: 'test-household',
        role: 'member',
      };

      const expectedAuthContext = {
        userId: 'test-user',
        householdId: 'test-household',
        role: 'member',
      };

      // Mock all service methods
      mockCategoriesService.findAll.mockResolvedValue([]);
      mockCategoriesService.findOne.mockResolvedValue(mockCategory);
      mockCategoriesService.create.mockResolvedValue(mockCategory);
      mockCategoriesService.update.mockResolvedValue(mockCategory);
      mockCategoriesService.remove.mockResolvedValue(undefined);
      mockCategoriesService.getCategoryTree.mockResolvedValue([]);
      mockCategoriesService.getCategoryPath.mockResolvedValue([]);
      mockCategoriesService.getCategoryStats.mockResolvedValue({});

      // Test all methods
      await controller.findAll(testUser);
      await controller.getCategoryTree(testUser);
      await controller.findOne('test-id', testUser);
      await controller.getCategoryPath('test-id', testUser);
      await controller.getCategoryStats('test-id', testUser);
      await controller.create({ name: 'Test' }, testUser);
      await controller.update('test-id', { name: 'Updated' }, testUser);
      await controller.remove('test-id', testUser);

      // Verify all service methods were called with the same auth context
      expect(mockCategoriesService.findAll).toHaveBeenCalledWith(expectedAuthContext);
      expect(mockCategoriesService.getCategoryTree).toHaveBeenCalledWith(expectedAuthContext);
      expect(mockCategoriesService.findOne).toHaveBeenCalledWith('test-id', expectedAuthContext);
      expect(mockCategoriesService.getCategoryPath).toHaveBeenCalledWith('test-id', expectedAuthContext);
      expect(mockCategoriesService.getCategoryStats).toHaveBeenCalledWith('test-id', expectedAuthContext);
      expect(mockCategoriesService.create).toHaveBeenCalledWith({ name: 'Test' }, expectedAuthContext);
      expect(mockCategoriesService.update).toHaveBeenCalledWith('test-id', { name: 'Updated' }, expectedAuthContext);
      expect(mockCategoriesService.remove).toHaveBeenCalledWith('test-id', expectedAuthContext);
    });
  });

  describe('error handling', () => {
    it('should propagate service errors', async () => {
      const serviceError = new Error('Service Error');
      mockCategoriesService.findAll.mockRejectedValue(serviceError);

      await expect(controller.findAll(mockUser)).rejects.toThrow('Service Error');
    });

    it('should propagate service errors from findOne', async () => {
      const serviceError = new Error('Not Found Error');
      mockCategoriesService.findOne.mockRejectedValue(serviceError);

      await expect(controller.findOne('category-1', mockUser)).rejects.toThrow('Not Found Error');
    });

    it('should propagate service errors from create', async () => {
      const serviceError = new Error('Validation Error');
      mockCategoriesService.create.mockRejectedValue(serviceError);

      await expect(controller.create({ name: 'Test' }, mockUser)).rejects.toThrow('Validation Error');
    });

    it('should propagate service errors from update', async () => {
      const serviceError = new Error('Update Error');
      mockCategoriesService.update.mockRejectedValue(serviceError);

      await expect(controller.update('category-1', { name: 'Updated' }, mockUser))
        .rejects.toThrow('Update Error');
    });
  });
});