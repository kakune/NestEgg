import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World! NestEgg API is running.';
  }

  getUsers() {
    // Mock user data to demonstrate backend connection
    return [
      { id: 1, name: 'Admin User' },
      { id: 2, name: 'Family Member 1' },
      { id: 3, name: 'Family Member 2' }
    ];
  }
}
