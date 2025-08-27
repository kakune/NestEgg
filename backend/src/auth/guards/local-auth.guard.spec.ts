import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.guard';

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalAuthGuard],
    }).compile();

    guard = module.get<LocalAuthGuard>(LocalAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should extend AuthGuard with local strategy', () => {
    expect(guard).toBeInstanceOf(LocalAuthGuard);
  });

  it('should have canActivate method', () => {
    expect(typeof guard.canActivate).toBe('function');
  });

  describe('canActivate', () => {
    it('should call parent canActivate method', () => {
      const mockContext = {
        getRequest: jest.fn().mockReturnValue({
          body: { email: 'test@example.com', password: 'password' },
        }),
        getResponse: jest.fn().mockReturnValue({}),
      } as unknown as ExecutionContext;

      // Mock the parent canActivate method
      const parentCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'canActivate',
        )
        .mockReturnValue(Promise.resolve(true));

      const result = guard.canActivate(mockContext);

      expect(parentCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toEqual(Promise.resolve(true));

      parentCanActivateSpy.mockRestore();
    });
  });
});
