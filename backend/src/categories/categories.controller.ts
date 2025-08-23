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
import {
  CategoriesService,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryWithChildren,
} from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Category } from '@prisma/client';
import {
  AuthContext,
  AuthenticatedUser,
} from '../common/interfaces/auth-context.interface';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  private getAuthContext(user: AuthenticatedUser): AuthContext {
    return {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryWithChildren[]> {
    return this.categoriesService.findAll(this.getAuthContext(user));
  }

  @Get('tree')
  async getCategoryTree(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryWithChildren[]> {
    return this.categoriesService.getCategoryTree(this.getAuthContext(user));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryWithChildren> {
    return this.categoriesService.findOne(id, this.getAuthContext(user));
  }

  @Get(':id/path')
  async getCategoryPath(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Category[]> {
    return this.categoriesService.getCategoryPath(
      id,
      this.getAuthContext(user),
    );
  }

  @Get(':id/stats')
  async getCategoryStats(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return this.categoriesService.getCategoryStats(
      id,
      this.getAuthContext(user),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Category> {
    return this.categoriesService.create(
      createCategoryDto,
      this.getAuthContext(user),
    );
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Category> {
    return this.categoriesService.update(
      id,
      updateCategoryDto,
      this.getAuthContext(user),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.categoriesService.remove(id, this.getAuthContext(user));
  }
}
