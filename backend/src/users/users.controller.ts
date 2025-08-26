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
  PublicUser,
} from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser[]> {
    return this.usersService.findAll(user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicUser> {
    return this.usersService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicUser> {
    return this.usersService.create(createUserDto, user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicUser> {
    return this.usersService.update(id, updateUserDto, user);
  }

  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.changePassword(id, changePasswordDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.usersService.remove(id, user);
  }
}
