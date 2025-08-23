import { CategoriesService, CreateCategoryDto, UpdateCategoryDto, CategoryWithChildren } from './categories.service';
import { Category } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
export declare class CategoriesController {
    private readonly categoriesService;
    constructor(categoriesService: CategoriesService);
    private getAuthContext;
    findAll(user: AuthenticatedUser): Promise<CategoryWithChildren[]>;
    getCategoryTree(user: AuthenticatedUser): Promise<CategoryWithChildren[]>;
    findOne(id: string, user: AuthenticatedUser): Promise<CategoryWithChildren>;
    getCategoryPath(id: string, user: AuthenticatedUser): Promise<Category[]>;
    getCategoryStats(id: string, user: AuthenticatedUser): Promise<any>;
    create(createCategoryDto: CreateCategoryDto, user: AuthenticatedUser): Promise<Category>;
    update(id: string, updateCategoryDto: UpdateCategoryDto, user: AuthenticatedUser): Promise<Category>;
    remove(id: string, user: AuthenticatedUser): Promise<void>;
}
