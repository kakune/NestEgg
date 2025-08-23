import { PrismaService } from '../prisma/prisma.service';
import { ActorKind, Actor } from '@prisma/client';
import { AuthContext } from '../common/interfaces/auth-context.interface';
export interface ActorStatistics {
    actor: {
        id: string;
        name: string;
        kind: ActorKind;
    };
    statistics: {
        totalTransactions: number;
        totalIncome: number;
        totalExpenses: number;
        netAmount: number;
        incomeTransactionCount: number;
        expenseTransactionCount: number;
        recentTransactions: number;
    };
}
export interface ActorWithUser extends Actor {
    user: {
        id: string;
        name: string | null;
        email: string;
    } | null;
}
export interface CreateActorDto {
    name: string;
    kind: ActorKind;
    description?: string;
    userId?: string;
}
export interface UpdateActorDto {
    name?: string;
    kind?: ActorKind;
    description?: string;
}
export declare class ActorsService {
    private readonly prismaService;
    constructor(prismaService: PrismaService);
    findAll(authContext: AuthContext): Promise<ActorWithUser[]>;
    findOne(id: string, authContext: AuthContext): Promise<ActorWithUser>;
    findByUserId(userId: string, authContext: AuthContext): Promise<Actor[]>;
    create(createActorDto: CreateActorDto, authContext: AuthContext): Promise<ActorWithUser>;
    update(id: string, updateActorDto: UpdateActorDto, authContext: AuthContext): Promise<ActorWithUser>;
    remove(id: string, authContext: AuthContext): Promise<void>;
    getActorStats(id: string, authContext: AuthContext): Promise<ActorStatistics>;
}
