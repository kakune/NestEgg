import { UsersService } from './users.service';
import type { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './users.service';
import { User } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    private getAuthContext;
    findAll(user: AuthenticatedUser): Promise<User[]>;
    findOne(id: string, user: AuthenticatedUser): Promise<User>;
    create(createUserDto: CreateUserDto, user: AuthenticatedUser): Promise<User>;
    update(id: string, updateUserDto: UpdateUserDto, user: AuthenticatedUser): Promise<User>;
    changePassword(id: string, changePasswordDto: ChangePasswordDto, user: AuthenticatedUser): Promise<void>;
    remove(id: string, user: AuthenticatedUser): Promise<void>;
}
