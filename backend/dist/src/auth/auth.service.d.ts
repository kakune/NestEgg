import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreatePersonalAccessTokenDto } from './dto/create-personal-access-token.dto';
export interface JwtPayload {
    sub: string;
    email: string;
    householdId: string;
    role: UserRole;
    sessionId?: string;
    tokenType: 'access' | 'pat';
}
export interface SafeUser {
    id: string;
    email: string;
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
        name: string | null;
        householdId: string;
        role: UserRole;
    };
    expiresIn: number;
}
export declare class AuthService {
    private readonly prismaService;
    private readonly usersService;
    private readonly jwtService;
    private readonly configService;
    constructor(prismaService: PrismaService, usersService: UsersService, jwtService: JwtService, configService: ConfigService);
    validateUser(email: string, password: string): Promise<SafeUser>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    logout(sessionId: string): Promise<void>;
    createPersonalAccessToken(userId: string, createPatDto: CreatePersonalAccessTokenDto): Promise<{
        token: string;
        id: string;
    }>;
    revokePersonalAccessToken(userId: string, tokenId: string): Promise<void>;
    validateSession(sessionId: string): Promise<boolean>;
    hashPassword(password: string): Promise<string>;
    comparePasswords(plaintext: string, hash: string): Promise<boolean>;
    private getTokenExpirationTime;
}
