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
import { CategoriesService, AuthContext, CreateCategoryDto, UpdateCategoryDto, CategoryWithChildren } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Category } from '@prisma/client';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(@CurrentUser() user: any): Promise<CategoryWithChildren[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.categoriesService.findAll(authContext);
  }

  @Get('tree')
  async getCategoryTree(@CurrentUser() user: any): Promise<CategoryWithChildren[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.categoriesService.getCategoryTree(authContext);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any): Promise<CategoryWithChildren> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.categoriesService.findOne(id, authContext);
  }

  @Get(':id/path')
  async getCategoryPath(@Param('id') id: string, @CurrentUser() user: any): Promise<Category[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.categoriesService.getCategoryPath(id, authContext);
  }

  @Get(':id/stats')
  async getCategoryStats(@Param('id') id: string, @CurrentUser() user: any): Promise<any> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.categoriesService.getCategoryStats(id, authContext);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: any,
  ): Promise<Category> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.categoriesService.create(createCategoryDto, authContext);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: any,
  ): Promise<Category> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.categoriesService.update(id, updateCategoryDto, authContext);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: any): Promise<void> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    await this.categoriesService.remove(id, authContext);
  }
}