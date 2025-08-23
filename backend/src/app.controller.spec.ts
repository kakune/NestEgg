import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World! NestEgg API is running."', () => {
      expect(appController.getHello()).toBe('Hello World! NestEgg API is running.');
    });
  });

  describe('users', () => {
    it('should return mock users array', () => {
      const result = appController.getUsers();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ id: 1, name: 'Admin User' });
    });
  });
});
