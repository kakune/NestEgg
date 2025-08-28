import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreatePersonalAccessTokenDto } from './dto/create-personal-access-token.dto';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  username: string;
  householdId: string;
  role: UserRole;
  sessionId?: string;
  tokenType: 'access' | 'pat'; // personal access token
}

// User type for auth operations
interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: UserRole;
  householdId: string;
  passwordHash: string;
  deletedAt: Date | null;
}

// User without password hash
export interface SafeUser {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: UserRole;
  householdId: string;
  deletedAt: Date | null;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    name: string | null;
    householdId: string;
    role: UserRole;
  };
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<SafeUser> {
    const user = (await this.prismaService.prisma.user.findFirst({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        householdId: true,
        passwordHash: true,
        deletedAt: true,
      },
    })) as AuthUser | null;

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Don't return password hash - omit passwordHash from result
    const { passwordHash, ...result } = user;
    void passwordHash; // Explicitly mark as intentionally unused
    return result;
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.username, loginDto.password);

    // Create session
    const session = await this.prismaService.prisma.session.create({
      data: {
        userId: user.id,
        sessionData: JSON.stringify({
          ipAddress: loginDto.ipAddress,
          userAgent: loginDto.userAgent,
        }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      householdId: user.householdId,
      role: user.role,
      sessionId: session.id,
      tokenType: 'access',
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.getTokenExpirationTime();

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        householdId: user.householdId,
        role: user.role,
      },
      expiresIn,
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists with email or username
    const existingUserWithEmail =
      await this.prismaService.prisma.user.findFirst({
        where: { email: registerDto.email.toLowerCase() },
      });

    if (existingUserWithEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const existingUserWithUsername =
      await this.prismaService.prisma.user.findFirst({
        where: { username: registerDto.username.toLowerCase() },
      });

    if (existingUserWithUsername) {
      throw new ConflictException('User with this username already exists');
    }

    // Hash password
    const saltRounds = this.configService.get<number>(
      'security.bcryptRounds',
      12,
    );
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    // Create household for the first user (admin)
    let householdId = registerDto.householdId;
    if (!householdId) {
      const household = await this.prismaService.prisma.household.create({
        data: {
          name: `${registerDto.name}'s Household`,
        },
      });
      householdId = household.id;
    }

    // Create user
    const user = (await this.prismaService.prisma.user.create({
      data: {
        email: registerDto.email.toLowerCase(),
        username: registerDto.username.toLowerCase(),
        name: registerDto.name,
        passwordHash,
        householdId,
        role:
          householdId === registerDto.householdId
            ? UserRole.member
            : UserRole.admin,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        householdId: true,
        role: true,
      },
    })) as {
      id: string;
      email: string;
      username: string;
      name: string | null;
      householdId: string;
      role: UserRole;
    };

    // Create session
    const session = await this.prismaService.prisma.session.create({
      data: {
        userId: user.id,
        sessionData: JSON.stringify({
          ipAddress: registerDto.ipAddress,
          userAgent: registerDto.userAgent,
        }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      householdId: user.householdId,
      role: user.role,
      sessionId: session.id,
      tokenType: 'access',
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.getTokenExpirationTime();

    return {
      accessToken,
      user,
      expiresIn,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prismaService.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  async createPersonalAccessToken(
    userId: string,
    createPatDto: CreatePersonalAccessTokenDto,
  ): Promise<{ token: string; id: string }> {
    const user = (await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        householdId: true,
        role: true,
      },
    })) as {
      id: string;
      email: string;
      username: string;
      householdId: string;
      role: UserRole;
    } | null;

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const expiresAt = createPatDto.expiresInDays
      ? new Date(Date.now() + createPatDto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const patToken = this.generateRandomToken();

    const pat = await this.prismaService.prisma.personalAccessToken.create({
      data: {
        name: createPatDto.name,
        token: patToken,
        userId: user.id,
        abilities: createPatDto.scopes || ['read'],
        expiresAt,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      householdId: user.householdId,
      role: user.role,
      tokenType: 'pat',
    };

    const signOptions = expiresAt ? {} : { expiresIn: '365d' }; // 1 year default if no expiration
    const token = this.jwtService.sign(payload, signOptions);

    return {
      token,
      id: pat.id,
    };
  }

  async revokePersonalAccessToken(
    userId: string,
    tokenId: string,
  ): Promise<void> {
    await this.prismaService.prisma.personalAccessToken.delete({
      where: {
        id: tokenId,
      },
    });
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.prismaService.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>(
      'security.bcryptRounds',
      12,
    );
    return bcrypt.hash(password, saltRounds);
  }

  async comparePasswords(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  private getTokenExpirationTime(): number {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');
    // Convert to seconds (JWT standard)
    if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn.slice(0, -1)) * 3600;
    } else if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn.slice(0, -1)) * 86400;
    }
    return 86400; // Default 24 hours
  }

  private generateRandomToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }
}
