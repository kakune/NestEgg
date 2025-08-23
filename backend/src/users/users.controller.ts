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
import { UsersService, AuthContext } from './users.service';
import type { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserRole, User } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@CurrentUser() user: any): Promise<User[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.usersService.findAll(authContext);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any): Promise<User> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.usersService.findOne(id, authContext);
  }

  @Post()
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any): Promise<User> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.usersService.create(createUserDto, authContext);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
  ): Promise<User> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.usersService.update(id, updateUserDto, authContext);
  }

  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: any,
  ): Promise<void> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    await this.usersService.changePassword(id, changePasswordDto, authContext);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: any): Promise<void> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    await this.usersService.remove(id, authContext);
  }
}