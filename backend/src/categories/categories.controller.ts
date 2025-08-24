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
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryWithChildren[]> {
    return this.categoriesService.findAll(user);
  }

  @Get('tree')
  async getCategoryTree(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryWithChildren[]> {
    return this.categoriesService.getCategoryTree(user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryWithChildren> {
    return this.categoriesService.findOne(id, user);
  }

  @Get(':id/path')
  async getCategoryPath(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Category[]> {
    return this.categoriesService.getCategoryPath(id, user);
  }

  @Get(':id/stats')
  async getCategoryStats(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return this.categoriesService.getCategoryStats(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Category> {
    return this.categoriesService.create(createCategoryDto, user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Category> {
    return this.categoriesService.update(id, updateCategoryDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.categoriesService.remove(id, user);
  }
}
