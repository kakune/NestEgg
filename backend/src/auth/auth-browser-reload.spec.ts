import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { JwtStrategy } from './strategies/jwt.strategy';

// Define JWT payload interface
interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  name: string | null;
  householdId: string;
  role: UserRole;
  sessionId?: string;
  tokenType: 'access' | 'pat';
  iat?: number;
  exp?: number;
}

// Define proper types for responses
interface AuthResponse {
  data: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      username: string;
      name: string | null;
      role: UserRole;
    };
  };
}

interface UserData {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: UserRole;
}

interface MeResponse {
  data?: {
    user?: UserData;
  };
  user?: UserData;
  id?: string;
  email?: string;
  username?: string;
  name?: string | null;
  role?: UserRole;
}

// Helper function to get typed HTTP server
function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as unknown as Parameters<typeof request>[0];
}

// Helper function to safely decode JWT tokens
function safeJwtDecode(jwtService: JwtService, token: string): JwtPayload {
  const decoded: unknown = jwtService.decode(token);
  // Type assertion for test environment - we know the token structure
  return decoded as JwtPayload;
}

// Helper function to extract user data consistently
function extractUserData(response: MeResponse): UserData {
  if (response.data?.user) {
    return response.data.user;
  }
  if (response.user) {
    return response.user;
  }
  // Direct properties (for backward compatibility)
  return {
    id: response.id!,
    email: response.email!,
    username: response.username!,
    name: response.name!,
    role: response.role!,
  };
}

describe('Authentication Browser Reload (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let jwtStrategy: JwtStrategy;

  const testUser = {
    email: 'reload-test@example.com',
    username: 'reloadtest',
    password: 'TestPassword123!',
    name: 'Browser Reload Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    jwtStrategy = moduleFixture.get<JwtStrategy>(JwtStrategy);

    await app.init();

    // Clean up test data
    await prismaService.prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prismaService.prisma.user.deleteMany({
      where: { email: testUser.email },
    });
    await app.close();
  });

  describe('Browser Reload Simulation', () => {
    let accessToken: string;
    let userId: string;

    it('should create user and login successfully', async () => {
      console.log('🔍 Attempting to register user:', testUser);

      // Register user
      const registerResponse = await request(getHttpServer(app))
        .post('/auth/register')
        .send(testUser);

      console.log('📋 Registration Response Status:', registerResponse.status);
      console.log(
        '📋 Registration Response Body:',
        JSON.stringify(registerResponse.body, null, 2),
      );

      if (registerResponse.status !== 201) {
        throw new Error(
          `Registration failed! Status: ${registerResponse.status}, Body: ${JSON.stringify(registerResponse.body)}`,
        );
      }

      // Extract data from nested response structure
      const body = registerResponse.body as AuthResponse;
      const responseData = body.data;

      expect(responseData.user.name).toBe(testUser.name);
      expect(responseData.user.email).toBe(testUser.email);
      expect(responseData.user.username).toBe(testUser.username);

      accessToken = responseData.accessToken;
      userId = responseData.user.id;

      console.log('✅ User registered successfully');
      console.log('   - User Name:', responseData.user.name);
      console.log('   - Access Token:', accessToken.substring(0, 20) + '...');
    });

    it('should decode JWT token and verify it contains the name', () => {
      const decodedToken = safeJwtDecode(jwtService, accessToken);

      console.log('📋 JWT Token Payload:');
      console.log('   - sub (userId):', decodedToken.sub);
      console.log('   - email:', decodedToken.email);
      console.log('   - username:', decodedToken.username);
      console.log('   - name:', decodedToken.name);
      console.log('   - role:', decodedToken.role);

      expect(decodedToken.sub).toBe(userId);
      expect(decodedToken.email).toBe(testUser.email);
      expect(decodedToken.username).toBe(testUser.username);
      expect(decodedToken.name).toBe(testUser.name);
      expect(decodedToken.role).toBe(UserRole.admin);

      // CRITICAL: The JWT should contain the name
      if (!decodedToken.name) {
        throw new Error('❌ CRITICAL: JWT token does not contain user name!');
      }

      console.log('✅ JWT token contains correct name:', decodedToken.name);
    });

    it('should simulate browser reload by calling /auth/me with stored token', async () => {
      console.log('🔄 Simulating browser reload...');
      console.log('   - Frontend clears all state');
      console.log('   - Frontend retrieves token from localStorage');
      console.log('   - Frontend calls /auth/me to restore user state');

      // This is exactly what happens on browser reload
      const meResponse = await request(getHttpServer(app))
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      console.log(
        '📝 /auth/me Full Response Body:',
        JSON.stringify(meResponse.body, null, 2),
      );
      console.log('📝 /auth/me Response Status:', meResponse.status);

      // Extract data the same way the frontend does
      const meBody = meResponse.body as MeResponse;
      const meData = extractUserData(meBody);
      console.log('📝 /auth/me Extracted Data:');
      console.log('   - id:', meData.id);
      console.log('   - email:', meData.email);
      console.log('   - username:', meData.username);
      console.log('   - name:', meData.name);
      console.log('   - role:', meData.role);

      // CRITICAL ASSERTION: The name should be preserved
      expect(meData.id).toBe(userId);
      expect(meData.email).toBe(testUser.email);
      expect(meData.username).toBe(testUser.username);
      expect(meData.name).toBe(testUser.name);
      expect(meData.role).toBe(UserRole.admin);

      if (meData.name !== testUser.name) {
        throw new Error(
          `❌ CRITICAL FAILURE: Expected name "${testUser.name}" but got "${meData.name}"`,
        );
      }

      if (meData.name === null || meData.name === 'User') {
        throw new Error(
          `❌ CRITICAL FAILURE: Name is being lost on reload! Got: "${meData.name}"`,
        );
      }

      console.log('✅ Browser reload simulation successful - name preserved!');
    });

    it('should test multiple browser reloads in sequence', async () => {
      console.log('🔄 Testing multiple browser reloads...');

      for (let i = 1; i <= 3; i++) {
        console.log(`   Reload ${i}:`);

        const meResponse = await request(getHttpServer(app))
          .get('/auth/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        // Extract data the same way the frontend does
        const reloadBody = meResponse.body as MeResponse;
        const reloadData = extractUserData(reloadBody);

        console.log(`     - name: "${reloadData.name}"`);

        expect(reloadData.name).toBe(testUser.name);

        if (reloadData.name !== testUser.name) {
          throw new Error(
            `❌ Reload ${i} FAILED: Expected "${testUser.name}" but got "${reloadData.name}"`,
          );
        }
      }

      console.log('✅ Multiple reload test passed!');
    });

    it('should test login -> reload sequence', async () => {
      console.log('🔄 Testing fresh login -> reload sequence...');

      // Fresh login
      const loginResponse = await request(getHttpServer(app))
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(200);

      const loginBody = loginResponse.body as AuthResponse;
      const loginData = loginBody.data;
      const newToken = loginData.accessToken;
      console.log('   - Fresh login successful, name:', loginData.user.name);

      expect(loginData.user.name).toBe(testUser.name);

      // Immediate reload simulation
      const reloadResponse = await request(getHttpServer(app))
        .get('/auth/me')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      // Extract data the same way the frontend does
      const immediateReloadBody = reloadResponse.body as MeResponse;
      const immediateReloadData = extractUserData(immediateReloadBody);

      console.log('   - Immediate reload, name:', immediateReloadData.name);

      expect(immediateReloadData.name).toBe(testUser.name);

      if (immediateReloadData.name !== testUser.name) {
        throw new Error(
          `❌ CRITICAL: Login->Reload failed! Expected "${testUser.name}" but got "${immediateReloadData.name}"`,
        );
      }

      console.log('✅ Login->Reload sequence successful!');
    });

    it('should verify JWT strategy validation directly', async () => {
      console.log('🔍 Testing JWT strategy validation directly...');

      // Decode the token to get payload
      const payload = safeJwtDecode(jwtService, accessToken);
      console.log('   - Token payload name:', payload.name);

      // Test the JWT strategy validation directly
      const validatedUser = await jwtStrategy.validate(payload);

      console.log('   - Validated user name:', validatedUser.name);

      expect(validatedUser.name).toBe(testUser.name);
      expect(validatedUser.email).toBe(testUser.email);
      expect(validatedUser.username).toBe(testUser.username);

      if (validatedUser.name !== testUser.name) {
        throw new Error(
          `❌ JWT Strategy validation failed! Expected "${testUser.name}" but got "${validatedUser.name}"`,
        );
      }

      console.log('✅ JWT strategy validation successful!');
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with null name correctly', async () => {
      console.log('🧪 Testing user with null name...');

      // Create user with null name
      const nullNameUser = {
        email: 'nullnametest@example.com',
        username: 'nullnametestuser',
        password: 'TestPassword123!',
        name: null,
      };

      const registerResponse = await request(getHttpServer(app))
        .post('/auth/register')
        .send(nullNameUser)
        .expect(201);

      const registerBody = registerResponse.body as AuthResponse;
      const token = registerBody.data.accessToken;
      console.log('   - Registered user with null name');

      // Test reload with null name
      const meResponse = await request(getHttpServer(app))
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const meBody = meResponse.body as MeResponse;
      const meData = extractUserData(meBody);
      console.log('   - /auth/me response name:', meData.name);

      expect(meData.name).toBeNull();
      console.log('✅ Null name handled correctly');

      // Cleanup
      await prismaService.prisma.user.deleteMany({
        where: { email: nullNameUser.email },
      });
    });

    it('should handle user with empty string name correctly', async () => {
      console.log('🧪 Testing user with empty string name...');

      // Create user with empty string name
      const emptyNameUser = {
        email: 'emptynametest@example.com',
        username: 'emptynametestuser',
        password: 'TestPassword123!',
        name: '',
      };

      const registerResponse = await request(getHttpServer(app))
        .post('/auth/register')
        .send(emptyNameUser)
        .expect(201);

      const registerBody = registerResponse.body as AuthResponse;
      const token = registerBody.data.accessToken;
      console.log('   - Registered user with empty string name');

      // Test reload with empty name
      const meResponse = await request(getHttpServer(app))
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const meBody = meResponse.body as MeResponse;
      const meData = extractUserData(meBody);
      console.log('   - /auth/me response name:', `"${meData.name}"`);

      expect(meData.name).toBe('');
      console.log('✅ Empty string name handled correctly');

      // Cleanup
      await prismaService.prisma.user.deleteMany({
        where: { email: emptyNameUser.email },
      });
    });
  });
});
