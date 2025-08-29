import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AuthContext } from '../common/interfaces/auth-context.interface';

export type { AuthContext };

// Public user type that excludes sensitive fields
export type PublicUser = Omit<User, 'passwordHash'>;

export interface CreateUserDto {
  email: string;
  username: string;
  name: string | null;
  role?: UserRole;
  householdId: string;
}

export interface UpdateUserDto {
  name?: string | null;
  role?: UserRole;
  email?: string;
  username?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(authContext: AuthContext): Promise<PublicUser[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.user.findMany({
        where: {
          householdId: authContext.householdId,
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          householdId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      });
    });
  }

  async findOne(id: string, authContext: AuthContext): Promise<PublicUser> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const user = await prisma.user.findFirst({
        where: {
          id,
          householdId: authContext.householdId,
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          householdId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prismaService.prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        householdId: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
  }

  async create(
    createUserDto: CreateUserDto,
    authContext: AuthContext,
  ): Promise<PublicUser> {
    // Only admins can create users
    if (authContext.role !== UserRole.admin) {
      throw new ForbiddenException('Only administrators can create users');
    }

    // Check if user with email already exists
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser && !existingUser.deletedAt) {
      throw new ConflictException('User with this email already exists');
    }

    return this.prismaService.withContext(authContext, async (prisma) => {
      // Generate a temporary password
      const tempPassword = this.generateTemporaryPassword();
      const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
      const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

      const user = await prisma.user.create({
        data: {
          email: createUserDto.email.toLowerCase(),
          username: createUserDto.username.toLowerCase(),
          name: createUserDto.name,
          role: createUserDto.role || UserRole.member,
          householdId: createUserDto.householdId,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          householdId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      });

      // TODO: Send email with temporary password to user
      // For now, we'll log it (in production, this should send an email)
      console.log(`Temporary password for ${user.email}: ${tempPassword}`);

      return user;
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    authContext: AuthContext,
  ): Promise<PublicUser> {
    // Verify user exists (will throw if not found)
    await this.findOne(id, authContext);

    // Users can only update themselves unless they are admin
    if (authContext.role !== UserRole.admin && authContext.userId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Only admins can change roles
    if (updateUserDto.role && authContext.role !== UserRole.admin) {
      throw new ForbiddenException('Only administrators can change user roles');
    }

    // Prevent self-demotion from admin if they are the only admin
    if (
      updateUserDto.role &&
      updateUserDto.role !== UserRole.admin &&
      authContext.userId === id
    ) {
      const adminCount = await this.prismaService.prisma.user.count({
        where: {
          householdId: authContext.householdId,
          role: UserRole.admin,
          deletedAt: null,
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove admin role - at least one admin must remain',
        );
      }
    }

    // Check email uniqueness if updating email
    if (updateUserDto.email) {
      const existingEmailUser = await this.findByEmail(updateUserDto.email);
      if (
        existingEmailUser &&
        existingEmailUser.id !== id &&
        !existingEmailUser.deletedAt
      ) {
        throw new ConflictException('User with this email already exists');
      }
    }

    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.user.update({
        where: { id },
        data: {
          ...(updateUserDto.name && { name: updateUserDto.name }),
          ...(updateUserDto.role && { role: updateUserDto.role }),
          ...(updateUserDto.email && {
            email: updateUserDto.email.toLowerCase(),
          }),
        },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          householdId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      });
    });
  }

  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
    authContext: AuthContext,
  ): Promise<void> {
    // Users can only change their own password unless they are admin
    if (authContext.role !== UserRole.admin && authContext.userId !== id) {
      throw new ForbiddenException('You can only change your own password');
    }

    const user = await this.prismaService.prisma.user.findUnique({
      where: { id },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password (unless admin is changing someone else's password)
    if (authContext.userId === id) {
      const isCurrentPasswordValid = await bcrypt.compare(
        changePasswordDto.currentPassword,
        user.passwordHash,
      );
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      saltRounds,
    );

    await this.prismaService.withContext(authContext, async (prisma) => {
      await prisma.user.update({
        where: { id },
        data: { passwordHash: newPasswordHash },
      });

      // Revoke all existing sessions for the user by deleting them
      await prisma.session.deleteMany({
        where: { userId: id },
      });
    });
  }

  async remove(id: string, authContext: AuthContext): Promise<void> {
    // Only admins can delete users
    if (authContext.role !== UserRole.admin) {
      throw new ForbiddenException('Only administrators can delete users');
    }

    const user = await this.findOne(id, authContext);

    // Prevent deleting the last admin
    if (user.role === UserRole.admin) {
      const adminCount = await this.prismaService.prisma.user.count({
        where: {
          householdId: authContext.householdId,
          role: UserRole.admin,
          deletedAt: null,
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last administrator');
      }
    }

    await this.prismaService.withContext(authContext, async (prisma) => {
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Revoke all sessions and personal access tokens
      await prisma.session.deleteMany({
        where: { userId: id },
      });

      await prisma.personalAccessToken.deleteMany({
        where: { userId: id },
      });
    });
  }

  private generateTemporaryPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
