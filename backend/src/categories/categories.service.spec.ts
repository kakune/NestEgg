/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CategoriesService,
  AuthContext,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { Category, UserRole } from '@prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    householdId: 'household-1',
    role: UserRole.admin,
  };

  const mockCategory: Category = {
    id: 'category-1',
    name: 'Test Category',
    parentId: null,
    description: 'Test Description',
    householdId: 'household-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockChildCategory: Category = {
    id: 'category-2',
    name: 'Child Category',
    parentId: 'category-1',
    description: 'Child Description',
    householdId: 'household-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockPrismaService = {
    withContext: jest.fn(),
    prisma: {
      category: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all root categories with hierarchy', async () => {
      const mockCategoriesWithChildren = [
        {
          ...mockCategory,
          parent: null,
          children: [mockChildCategory],
        },
      ];

      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            findMany: jest.fn().mockResolvedValue(mockCategoriesWithChildren),
          },
        });
      });

      const result = await service.findAll(mockAuthContext);

      expect(result).toEqual(mockCategoriesWithChildren);
      expect(mockPrismaService.withContext).toHaveBeenCalledWith(
        mockAuthContext,
        expect.any(Function),
      );
    });

    it('should filter categories by household', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            findMany: jest.fn().mockImplementation(({ where }) => {
              expect(where.householdId).toBe(mockAuthContext.householdId);
              return Promise.resolve([mockCategory]);
            }),
          },
        });
      });

      await service.findAll(mockAuthContext);
    });
  });

  describe('findOne', () => {
    it('should return a category with children and transactions', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [mockChildCategory],
        transactions: [],
      };

      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
          },
        });
      });

      const result = await service.findOne('category-1', mockAuthContext);

      expect(result).toEqual(mockCategoryWithDetails);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        });
      });

      await expect(
        service.findOne('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify household isolation', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            findFirst: jest.fn().mockImplementation(({ where }) => {
              expect(where.householdId).toBe(mockAuthContext.householdId);
              expect(where.id).toBe('category-1');
              return Promise.resolve(mockCategory);
            }),
          },
        });
      });

      await service.findOne('category-1', mockAuthContext);
    });
  });

  describe('create', () => {
    const createCategoryDto: CreateCategoryDto = {
      name: 'New Category',
      description: 'New Description',
    };

    it('should create a root category successfully', async () => {
      mockPrismaService.prisma.category.findFirst.mockResolvedValue(null); // No existing category
      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            create: jest.fn().mockResolvedValue(mockCategory),
          },
        });
      });

      const result = await service.create(createCategoryDto, mockAuthContext);

      expect(result).toEqual(mockCategory);
      expect(mockPrismaService.prisma.category.findFirst).toHaveBeenCalledWith({
        where: {
          name: createCategoryDto.name,
          parentId: null,
          householdId: mockAuthContext.householdId,
          deletedAt: null,
        },
      });
    });

    it('should create a child category with valid parent', async () => {
      const createChildCategoryDto: CreateCategoryDto = {
        name: 'Child Category',
        parentId: 'category-1',
      };

      // Completely reset and rebuild the mock from scratch
      mockPrismaService.prisma.category.findFirst.mockReset();
      mockPrismaService.withContext.mockReset();

      // Create a call counter to track which findFirst call we're on
      let callCount = 0;
      mockPrismaService.prisma.category.findFirst.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(mockCategory); // Parent exists check
        if (callCount === 2) return Promise.resolve({ parentId: null }); // For depth calculation (getCategoryDepth)
        if (callCount === 3) return Promise.resolve(null); // No existing category with same name (uniqueness check)
        return Promise.resolve(null);
      });

      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            create: jest.fn().mockResolvedValue(mockChildCategory),
          },
        });
      });

      const result = await service.create(
        createChildCategoryDto,
        mockAuthContext,
      );

      expect(result).toEqual(mockChildCategory);
    });

    it('should throw BadRequestException when parent not found', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'New Category',
        parentId: 'nonexistent-parent',
      };

      mockPrismaService.prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(createCategoryDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when category name already exists at same level', async () => {
      mockPrismaService.prisma.category.findFirst.mockResolvedValue(
        mockCategory,
      );

      await expect(
        service.create(createCategoryDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when depth exceeds limit', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'Deep Category',
        parentId: 'deep-parent',
      };

      // Mock parent exists
      mockPrismaService.prisma.category.findFirst
        .mockResolvedValueOnce(mockCategory) // Parent exists
        .mockResolvedValueOnce(null); // No existing category with same name

      // Mock depth calculation - simulate 5 levels deep
      mockPrismaService.prisma.category.findFirst
        .mockResolvedValueOnce({ parentId: 'level-4' })
        .mockResolvedValueOnce({ parentId: 'level-3' })
        .mockResolvedValueOnce({ parentId: 'level-2' })
        .mockResolvedValueOnce({ parentId: 'level-1' })
        .mockResolvedValueOnce({ parentId: null });

      await expect(
        service.create(createCategoryDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const updateCategoryDto: UpdateCategoryDto = {
      name: 'Updated Category',
      description: 'Updated Description',
    };

    it('should update category successfully', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [],
        transactions: [],
      };

      mockPrismaService.withContext
        .mockImplementationOnce((context, fn) => {
          // For findOne call
          return fn({
            category: {
              findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
            },
          });
        })
        .mockImplementationOnce((context, fn) => {
          // For update call
          return fn({
            category: {
              update: jest
                .fn()
                .mockResolvedValue({ ...mockCategory, ...updateCategoryDto }),
            },
          });
        });

      // Reset specific mocks and ensure no name conflict
      mockPrismaService.prisma.category.findFirst.mockReset();
      mockPrismaService.prisma.category.findFirst.mockResolvedValue(null); // No name conflict

      const result = await service.update(
        'category-1',
        updateCategoryDto,
        mockAuthContext,
      );

      expect(result.name).toBe(updateCategoryDto.name);
      expect(result.description).toBe(updateCategoryDto.description);
    });

    it('should throw BadRequestException for self-reference', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [],
        transactions: [],
      };

      // Reset withContext mock
      mockPrismaService.withContext.mockReset();

      // Only need one withContext call for findOne - the self-reference check prevents further execution
      mockPrismaService.withContext.mockImplementationOnce((context, fn) => {
        return fn({
          category: {
            findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
          },
        });
      });

      await expect(
        service.update(
          'category-1',
          { parentId: 'category-1' },
          mockAuthContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for circular reference', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [mockChildCategory],
        transactions: [],
      };

      // Clear previous mocks
      jest.clearAllMocks();

      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
          },
        });
      });

      // Mock parent exists and descendant check
      mockPrismaService.prisma.category.findFirst.mockResolvedValue(
        mockCategory,
      );
      mockPrismaService.prisma.category.findMany
        .mockResolvedValueOnce([mockChildCategory]) // Child exists
        .mockResolvedValueOnce([]); // No further children

      await expect(
        service.update(
          'category-1',
          { parentId: 'category-2' },
          mockAuthContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for name conflict', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [],
        transactions: [],
      };

      // Reset mocks
      mockPrismaService.withContext.mockReset();
      mockPrismaService.prisma.category.findFirst.mockReset();

      // Setup findOne call through withContext
      mockPrismaService.withContext.mockImplementationOnce((context, fn) => {
        return fn({
          category: {
            findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
          },
        });
      });

      // Mock name conflict - return existing category with different ID
      mockPrismaService.prisma.category.findFirst.mockResolvedValue({
        ...mockCategory,
        id: 'other-category',
      });

      await expect(
        service.update(
          'category-1',
          { name: 'Existing Name' },
          mockAuthContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete category successfully', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [],
        transactions: [],
      };

      mockPrismaService.withContext
        .mockImplementationOnce((context, fn) => {
          // For findOne call
          return fn({
            category: {
              findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
            },
          });
        })
        .mockImplementationOnce((context, fn) => {
          // For delete call
          return fn({
            category: {
              update: jest.fn().mockResolvedValue(undefined),
            },
          });
        });

      mockPrismaService.prisma.category.count.mockResolvedValue(0); // No children
      mockPrismaService.prisma.transaction.count.mockResolvedValue(0); // No transactions

      await service.remove('category-1', mockAuthContext);

      expect(mockPrismaService.prisma.category.count).toHaveBeenCalledWith({
        where: {
          parentId: 'category-1',
          deletedAt: null,
        },
      });
    });

    it('should throw BadRequestException when category has children', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [],
        transactions: [],
      };

      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
          },
        });
      });

      mockPrismaService.prisma.category.count.mockResolvedValue(1); // Has children

      await expect(
        service.remove('category-1', mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when category has transactions', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [],
        transactions: [],
      };

      mockPrismaService.withContext.mockImplementation((context, fn) => {
        return fn({
          category: {
            findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
          },
        });
      });

      mockPrismaService.prisma.category.count.mockResolvedValue(0); // No children
      mockPrismaService.prisma.transaction.count.mockResolvedValue(1); // Has transactions

      await expect(
        service.remove('category-1', mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCategoryPath', () => {
    it('should return category path from root to leaf', async () => {
      const rootCategory = {
        ...mockCategory,
        id: 'root',
        name: 'Root',
        parent: null,
      };
      const childCategory = {
        ...mockCategory,
        id: 'child',
        name: 'Child',
        parent: rootCategory,
        parentId: 'root',
      };

      mockPrismaService.withContext
        .mockImplementationOnce((context, fn) => {
          // First call for child category
          return fn({
            category: {
              findFirst: jest.fn().mockResolvedValue(childCategory),
            },
          });
        })
        .mockImplementationOnce((context, fn) => {
          // Second call for root category
          return fn({
            category: {
              findFirst: jest.fn().mockResolvedValue(rootCategory),
            },
          });
        });

      const result = await service.getCategoryPath('child', mockAuthContext);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('root');
      expect(result[1].id).toBe('child');
    });
  });

  describe('getCategoryStats', () => {
    it('should return category statistics including descendants', async () => {
      const mockCategoryWithDetails = {
        ...mockCategory,
        parent: null,
        children: [],
        transactions: [],
      };

      mockPrismaService.withContext
        .mockImplementationOnce((context, fn) => {
          // For findOne call
          return fn({
            category: {
              findFirst: jest.fn().mockResolvedValue(mockCategoryWithDetails),
            },
          });
        })
        .mockImplementationOnce((context, fn) => {
          // For stats calculation
          return fn({
            transaction: {
              count: jest.fn().mockResolvedValue(5),
              aggregate: jest.fn().mockResolvedValue({
                _sum: { amount: 1000 },
                _count: 5,
              }),
            },
          });
        });

      // Mock getAllDescendants
      mockPrismaService.prisma.category.findMany.mockResolvedValue([]); // No descendants

      const result = await service.getCategoryStats(
        'category-1',
        mockAuthContext,
      );

      expect(result.category.id).toBe('category-1');
      expect(result.statistics.directTransactions).toBe(5);
      expect(result.statistics.directAmount).toBe(1000);
    });
  });

  describe('private methods', () => {
    describe('getCategoryDepth', () => {
      it('should calculate category depth correctly', async () => {
        mockPrismaService.prisma.category.findFirst
          .mockResolvedValueOnce({ parentId: 'parent-1' })
          .mockResolvedValueOnce({ parentId: 'parent-2' })
          .mockResolvedValueOnce({ parentId: null });

        // Access private method for testing
        const depth = await (service as any).getCategoryDepth(
          'category-1',
          mockAuthContext,
        );

        expect(depth).toBe(3);
      });

      it('should throw error for excessive depth', async () => {
        // Clear previous mocks
        mockPrismaService.prisma.category.findFirst.mockReset();

        // Mock deep hierarchy that exceeds limit (always return a parent to create infinite loop)
        // This will make it always find a category with a parent, causing infinite depth
        mockPrismaService.prisma.category.findFirst.mockImplementation(() =>
          Promise.resolve({ parentId: 'infinite-parent' }),
        );

        await expect(
          (service as any).getCategoryDepth('category-1', mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('wouldCreateCircularReference', () => {
      it('should detect circular references', async () => {
        mockPrismaService.prisma.category.findMany
          .mockResolvedValueOnce([{ id: 'descendant-1' }])
          .mockResolvedValueOnce([]);

        const result = await (service as any).wouldCreateCircularReference(
          'category-1',
          'descendant-1',
          mockAuthContext,
        );

        expect(result).toBe(true);
      });

      it('should return false for non-circular references', async () => {
        mockPrismaService.prisma.category.findMany.mockResolvedValue([]);

        const result = await (service as any).wouldCreateCircularReference(
          'category-1',
          'unrelated-category',
          mockAuthContext,
        );

        expect(result).toBe(false);
      });
    });

    describe('getAllDescendants', () => {
      it('should get all descendants recursively', async () => {
        const child1 = { id: 'child-1', parentId: 'category-1' };
        const child2 = { id: 'child-2', parentId: 'category-1' };
        const grandchild1 = { id: 'grandchild-1', parentId: 'child-1' };

        mockPrismaService.prisma.category.findMany
          .mockResolvedValueOnce([child1, child2]) // Children of category-1
          .mockResolvedValueOnce([grandchild1]) // Children of child-1
          .mockResolvedValueOnce([]); // Children of child-2

        const descendants = await (service as any).getAllDescendants(
          'category-1',
          mockAuthContext,
        );

        expect(descendants).toHaveLength(3);
        expect(descendants.map((d: any) => d.id)).toEqual([
          'child-1',
          'grandchild-1',
          'child-2',
        ]);
      });

      it('should handle circular references gracefully', async () => {
        // Clear previous mocks
        jest.clearAllMocks();

        const child1 = { id: 'child-1', parentId: 'category-1' };

        mockPrismaService.prisma.category.findMany
          .mockResolvedValueOnce([child1]) // Children of category-1
          .mockResolvedValueOnce([]); // No children of child-1 (prevent circular)

        const descendants = await (service as any).getAllDescendants(
          'category-1',
          mockAuthContext,
        );

        expect(descendants).toHaveLength(1); // Should only return child-1
        expect(descendants[0].id).toBe('child-1');
      });
    });
  });
});
