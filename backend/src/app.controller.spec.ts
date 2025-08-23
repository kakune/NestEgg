import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service'; // Import PrismaService

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService; // Add appService variable

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        // Provide a mock for PrismaService
        {
          provide: PrismaService,
          useValue: {
            user: {
              count: jest.fn().mockResolvedValue(0), // Mock the count method
            },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService); // Get AppService instance
  });

  describe('root', () => {
    it('should return "Hello World! There are 0 users in the database."', async () => {
      // Make it async
      // Mock the getHello method of AppService
      jest
        .spyOn(appService, 'getHello')
        .mockResolvedValue('Hello World! There are 0 users in the database.');
      expect(await appController.getHello()).toBe(
        'Hello World! There are 0 users in the database.',
      );
    });
  });
});
