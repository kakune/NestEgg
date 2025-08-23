import { PrismaService } from '../prisma/prisma.service';
import { Category } from '@prisma/client';
import { AuthContext } from '../common/interfaces/auth-context.interface';
export interface CreateCategoryDto {
    name: string;
    parentId?: string;
    description?: string;
}
export interface UpdateCategoryDto {
    name?: string;
    parentId?: string;
    description?: string;
}
export interface CategoryWithChildren extends Category {
    children?: CategoryWithChildren[];
    parent?: Category;
}
export interface CategoryStatistics {
    category: {
        id: string;
        name: string;
        parent?: Category;
    };
    statistics: {
        directTransactions: number;
        directAmount: number;
        descendantTransactions: number;
        descendantAmount: number;
        totalTransactions: number;
        totalAmount: number;
        childrenCount: number;
    };
}
export declare class CategoriesService {
    private readonly prismaService;
    constructor(prismaService: PrismaService);
    findAll(authContext: AuthContext): Promise<CategoryWithChildren[]>;
    findOne(id: string, authContext: AuthContext): Promise<CategoryWithChildren>;
    create(createCategoryDto: CreateCategoryDto, authContext: AuthContext): Promise<Category>;
    update(id: string, updateCategoryDto: UpdateCategoryDto, authContext: AuthContext): Promise<Category>;
    remove(id: string, authContext: AuthContext): Promise<void>;
    getCategoryTree(authContext: AuthContext): Promise<CategoryWithChildren[]>;
    getCategoryPath(id: string, authContext: AuthContext): Promise<Category[]>;
    private getCategoryDepth;
    private wouldCreateCircularReference;
    private getAllDescendants;
    getCategoryStats(id: string, authContext: AuthContext): Promise<CategoryStatistics>;
}
