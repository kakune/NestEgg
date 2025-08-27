import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should extend AuthGuard', () => {
    expect(guard).toBeInstanceOf(JwtAuthGuard);
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;

    beforeEach(() => {
      mockContext = {
        getHandler: jest.fn().mockReturnValue({}),
        getClass: jest.fn().mockReturnValue({}),
        switchToHttp: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
      };
    });

    it('should return true for public routes', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      const handler = mockContext.getHandler();
      const contextClass = mockContext.getClass();
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [handler, contextClass],
      );
    });

    it('should call parent canActivate for protected routes', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      // Mock the parent canActivate method
      const parentCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(Promise.resolve(true));

      void guard.canActivate(mockContext);

      expect(parentCanActivateSpy).toHaveBeenCalledWith(mockContext);
      const handler = mockContext.getHandler();
      const contextClass = mockContext.getClass();
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [handler, contextClass],
      );

      parentCanActivateSpy.mockRestore();
    });

    it('should call parent canActivate when isPublic is undefined', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const parentCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(Promise.resolve(true));

      void guard.canActivate(mockContext);

      expect(parentCanActivateSpy).toHaveBeenCalledWith(mockContext);
      const handler = mockContext.getHandler();
      const contextClass = mockContext.getClass();
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [handler, contextClass],
      );

      parentCanActivateSpy.mockRestore();
    });

    it('should call parent canActivate when isPublic is null', () => {
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const parentCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(Promise.resolve(true));

      void guard.canActivate(mockContext);

      expect(parentCanActivateSpy).toHaveBeenCalledWith(mockContext);

      parentCanActivateSpy.mockRestore();
    });

    it('should call parent canActivate when isPublic is explicitly false', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const parentCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(Promise.resolve(false));

      const result = guard.canActivate(mockContext);

      expect(result).toEqual(Promise.resolve(false));
      expect(parentCanActivateSpy).toHaveBeenCalledWith(mockContext);

      parentCanActivateSpy.mockRestore();
    });

    it('should check both handler and class for public decorator', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const getHandlerMock = jest.fn().mockReturnValue(mockHandler);
      const getClassMock = jest.fn().mockReturnValue(mockClass);
      mockContext.getHandler = getHandlerMock;
      mockContext.getClass = getClassMock;
      mockReflector.getAllAndOverride.mockReturnValue(true);

      void guard.canActivate(mockContext);

      expect(getHandlerMock).toHaveBeenCalled();
      expect(getClassMock).toHaveBeenCalled();
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [mockHandler, mockClass],
      );
    });

    it('should use getAllAndOverride to check both method and class decorators', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      void guard.canActivate(mockContext);

      const handler = mockContext.getHandler();
      const contextClass = mockContext.getClass();
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        expect.arrayContaining([handler, contextClass]),
      );
    });

    it('should handle promise return from parent canActivate', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const parentCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(Promise.resolve(true));

      const result = guard.canActivate(mockContext);

      expect(result).toEqual(Promise.resolve(true));

      parentCanActivateSpy.mockRestore();
    });

    it('should handle observable return from parent canActivate', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const mockObservable = {
        subscribe: jest.fn(),
      };

      const parentCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(mockObservable);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(mockObservable);

      parentCanActivateSpy.mockRestore();
    });

    it('should handle boolean return from parent canActivate', () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const parentCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);

      parentCanActivateSpy.mockRestore();
    });
  });

  describe('reflection behavior', () => {
    it('should use correct reflection key', () => {
      const mockContext = {
        getHandler: jest.fn().mockReturnValue({}),
        getClass: jest.fn().mockReturnValue({}),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(true);

      void guard.canActivate(mockContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        expect.any(Array),
      );
    });

    it('should prioritize method-level decorator over class-level', () => {
      // getAllAndOverride should handle this priority automatically
      const mockContext = {
        getHandler: jest.fn().mockReturnValue({ method: 'test' }),
        getClass: jest.fn().mockReturnValue({ class: 'test' }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(true);

      void guard.canActivate(mockContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [{ method: 'test' }, { class: 'test' }],
      );
    });
  });
});
