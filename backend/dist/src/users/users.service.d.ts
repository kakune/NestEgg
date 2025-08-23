import { PrismaService } from '../prisma/prisma.service';
import { UserRole, User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuthContext } from '../common/interfaces/auth-context.interface';
export type { AuthContext };
export interface CreateUserDto {
    email: string;
    name: string;
    role?: UserRole;
    householdId: string;
}
export interface UpdateUserDto {
    name?: string;
    role?: UserRole;
    email?: string;
}
export interface ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class UsersService {
    private readonly prismaService;
    private readonly configService;
    constructor(prismaService: PrismaService, configService: ConfigService);
    findAll(authContext: AuthContext): Promise<User[]>;
    findOne(id: string, authContext: AuthContext): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    create(createUserDto: CreateUserDto, authContext: AuthContext): Promise<User>;
    update(id: string, updateUserDto: UpdateUserDto, authContext: AuthContext): Promise<User>;
    changePassword(id: string, changePasswordDto: ChangePasswordDto, authContext: AuthContext): Promise<void>;
    remove(id: string, authContext: AuthContext): Promise<void>;
    private generateTemporaryPassword;
}
