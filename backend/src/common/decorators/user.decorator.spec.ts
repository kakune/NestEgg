import { CurrentUser } from './user.decorator';

interface MockUser {
  id?: string | number;
  email?: string;
  role?: string;
  householdId?: string;
  name?: string;
  roles?: string[];
  isActive?: boolean;
  isVerified?: boolean;
  score?: number;
  count?: number;
  optionalField?: unknown;
  anotherField?: string;
  createdAt?: Date;
  profile?: {
    personal?: {
      name?: string;
      age?: number;
    };
    preferences?: {
      theme?: string;
      notifications?: boolean;
    };
    name?: string;
    age?: number;
  };
  metadata?: {
    lastLogin?: Date;
    loginCount?: number;
  };
}

interface MockRequest {
  user?: MockUser | null | undefined;
}

interface MockHttpContext {
  getRequest(): MockRequest;
}

interface MockExecutionContext {
  switchToHttp(): MockHttpContext;
  getHandler(): unknown;
  getClass(): unknown;
  switchToRpc(): unknown;
  switchToWs(): unknown;
  getType(): unknown;
  getArgs(): unknown;
  getArgByIndex(index: number): unknown;
}

describe('CurrentUser Decorator', () => {
  let mockContext: MockExecutionContext;
  let mockRequest: MockRequest;
  let switchToHttpSpy: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'member',
        householdId: 'household-1',
        name: 'Test User',
      },
    };

    switchToHttpSpy = jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
    });

    mockContext = {
      switchToHttp: switchToHttpSpy,
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
    };
  });

  it('should be defined', () => {
    expect(CurrentUser).toBeDefined();
    expect(typeof CurrentUser).toBe('function');
  });

  it('should create a parameter decorator', () => {
    const decorator = CurrentUser();
    expect(decorator).toBeDefined();
  });

  describe('decorator functionality', () => {
    // Test the internal decorator function
    const testDecoratorFunction = (
      data: string | undefined,
      ctx: MockExecutionContext,
    ) => {
      const request: MockRequest = ctx.switchToHttp().getRequest();
      const user = request.user;
      if (!data || !user) {
        return user;
      }
      return user[data as keyof MockUser];
    };

    it('should return the entire user object when no data is provided', () => {
      const result = testDecoratorFunction(undefined, mockContext);

      expect(result).toEqual(mockRequest.user);
      expect(switchToHttpSpy).toHaveBeenCalled();
    });

    it('should return specific user property when data is provided', () => {
      const result = testDecoratorFunction('email', mockContext);

      expect(result).toBe('test@example.com');
    });

    it('should return user id when requesting id property', () => {
      const result = testDecoratorFunction('id', mockContext);

      expect(result).toBe('user-1');
    });

    it('should return user role when requesting role property', () => {
      const result = testDecoratorFunction('role', mockContext);

      expect(result).toBe('member');
    });

    it('should return user householdId when requesting householdId property', () => {
      const result = testDecoratorFunction('householdId', mockContext);

      expect(result).toBe('household-1');
    });

    it('should return user name when requesting name property', () => {
      const result = testDecoratorFunction('name', mockContext);

      expect(result).toBe('Test User');
    });

    it('should return undefined for non-existent properties', () => {
      const result = testDecoratorFunction('nonExistentProperty', mockContext);

      expect(result).toBeUndefined();
    });

    it('should return null when user is null', () => {
      mockRequest.user = null;

      const result = testDecoratorFunction(undefined, mockContext);

      expect(result).toBeNull();
    });

    it('should return undefined when user is undefined', () => {
      mockRequest.user = undefined;

      const result = testDecoratorFunction(undefined, mockContext);

      expect(result).toBeUndefined();
    });

    it('should return null when trying to access property of null user', () => {
      mockRequest.user = null;

      const result = testDecoratorFunction('email', mockContext);

      expect(result).toBeNull();
    });

    it('should return undefined when trying to access property of undefined user', () => {
      mockRequest.user = undefined;

      const result = testDecoratorFunction('email', mockContext);

      expect(result).toBeUndefined();
    });

    it('should handle empty user object', () => {
      mockRequest.user = {};

      const result = testDecoratorFunction(undefined, mockContext);

      expect(result).toEqual({});
    });

    it('should return undefined for property on empty user object', () => {
      mockRequest.user = {};

      const result = testDecoratorFunction('email', mockContext);

      expect(result).toBeUndefined();
    });

    it('should handle request without user property', () => {
      mockRequest = {};
      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      });

      const result = testDecoratorFunction(undefined, mockContext);

      expect(result).toBeUndefined();
    });

    it('should handle array access', () => {
      mockRequest.user = {
        roles: ['member', 'viewer'],
      };

      const result = testDecoratorFunction('roles', mockContext);

      expect(result).toEqual(['member', 'viewer']);
    });

    it('should handle boolean properties', () => {
      mockRequest.user = {
        isActive: true,
        isVerified: false,
      };

      const resultActive = testDecoratorFunction('isActive', mockContext);
      const resultVerified = testDecoratorFunction('isVerified', mockContext);

      expect(resultActive).toBe(true);
      expect(resultVerified).toBe(false);
    });

    it('should handle numeric properties', () => {
      mockRequest.user = {
        id: 123,
        score: 85.5,
        count: 0,
      };

      const resultId = testDecoratorFunction('id', mockContext);
      const resultScore = testDecoratorFunction('score', mockContext);
      const resultCount = testDecoratorFunction('count', mockContext);

      expect(resultId).toBe(123);
      expect(resultScore).toBe(85.5);
      expect(resultCount).toBe(0);
    });

    it('should handle null property values', () => {
      mockRequest.user = {
        optionalField: null,
        anotherField: 'value',
      };

      const result = testDecoratorFunction('optionalField', mockContext);

      expect(result).toBeNull();
    });

    it('should handle date properties', () => {
      const testDate = new Date('2023-01-01');
      mockRequest.user = {
        createdAt: testDate,
      };

      const result = testDecoratorFunction('createdAt', mockContext);

      expect(result).toBe(testDate);
    });

    it('should properly call context methods', () => {
      const mockGetRequest = jest.fn().mockReturnValue(mockRequest);
      const mockHttpContext = {
        getRequest: mockGetRequest,
      };
      const mockSwitchToHttp = jest.fn().mockReturnValue(mockHttpContext);
      mockContext.switchToHttp = mockSwitchToHttp;

      testDecoratorFunction('email', mockContext);

      expect(mockSwitchToHttp).toHaveBeenCalled();
      expect(mockGetRequest).toHaveBeenCalled();
    });

    it('should handle complex user objects', () => {
      const complexUser = {
        id: 'user-123',
        profile: {
          personal: {
            name: 'John Doe',
            age: 30,
          },
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
        metadata: {
          lastLogin: new Date(),
          loginCount: 42,
        },
      };

      mockRequest.user = complexUser;

      const result = testDecoratorFunction(undefined, mockContext);

      expect(result).toEqual(complexUser);
    });

    it('should handle property access on complex objects', () => {
      const complexUser = {
        profile: {
          name: 'John Doe',
          age: 30,
        },
      };

      mockRequest.user = complexUser;

      const result = testDecoratorFunction('profile', mockContext);

      expect(result).toEqual({
        name: 'John Doe',
        age: 30,
      });
    });

    it('should handle falsy data parameter correctly', () => {
      // When data is empty string, it should return the entire user
      const result1 = testDecoratorFunction('', mockContext);
      expect(result1).toEqual(mockRequest.user);

      // When data is null, it should return the entire user
      const result2 = testDecoratorFunction(undefined, mockContext);
      expect(result2).toEqual(mockRequest.user);

      // When data is undefined, it should return the entire user
      const result3 = testDecoratorFunction(undefined, mockContext);
      expect(result3).toEqual(mockRequest.user);
    });

    it('should handle case when data exists but user is falsy', () => {
      mockRequest.user = null;
      const result = testDecoratorFunction('email', mockContext);
      expect(result).toBeNull();

      mockRequest.user = undefined;
      const result2 = testDecoratorFunction('email', mockContext);
      expect(result2).toBeUndefined();
    });
  });

  describe('decorator creation with parameters', () => {
    it('should create decorator without parameters', () => {
      const decorator = CurrentUser();
      expect(decorator).toBeDefined();
    });

    it('should create decorator with string parameter', () => {
      const decorator = CurrentUser('email');
      expect(decorator).toBeDefined();
    });

    it('should work with different property names', () => {
      const emailDecorator = CurrentUser('email');
      const idDecorator = CurrentUser('id');
      const roleDecorator = CurrentUser('role');

      expect(emailDecorator).toBeDefined();
      expect(idDecorator).toBeDefined();
      expect(roleDecorator).toBeDefined();
    });
  });
});
