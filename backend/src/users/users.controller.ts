import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import type {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
} from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserRole, User } from '@prisma/client';
import {
  AuthContext,
  AuthenticatedUser,
} from '../common/interfaces/auth-context.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private getAuthContext(user: AuthenticatedUser): AuthContext {
    return {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<User[]> {
    return this.usersService.findAll(this.getAuthContext(user));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<User> {
    return this.usersService.findOne(id, this.getAuthContext(user));
  }

  @Post()
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<User> {
    return this.usersService.create(createUserDto, this.getAuthContext(user));
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<User> {
    return this.usersService.update(
      id,
      updateUserDto,
      this.getAuthContext(user),
    );
  }

  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.changePassword(
      id,
      changePasswordDto,
      this.getAuthContext(user),
    );
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.remove(id, this.getAuthContext(user));
  }
}
