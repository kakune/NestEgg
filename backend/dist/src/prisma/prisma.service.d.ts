import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuthContext } from '../common/interfaces/auth-context.interface';
export declare class PrismaService implements OnModuleInit, OnModuleDestroy {
    private configService;
    private readonly logger;
    prisma: PrismaClient;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    get user(): import("@prisma/client").Prisma.UserDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get household(): import("@prisma/client").Prisma.HouseholdDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get actor(): import("@prisma/client").Prisma.ActorDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get category(): import("@prisma/client").Prisma.CategoryDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get transaction(): import("@prisma/client").Prisma.TransactionDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get income(): import("@prisma/client").Prisma.IncomeDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get settlement(): import("@prisma/client").Prisma.SettlementDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get settlementLine(): import("@prisma/client").Prisma.SettlementLineDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get policy(): import("@prisma/client").Prisma.PolicyDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    get auditLog(): import("@prisma/client").Prisma.AuditLogDelegate<import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    setSessionContext(householdId: string, userId: string, userRole: UserRole, showDeleted?: boolean): Promise<void>;
    clearSessionContext(): Promise<void>;
    withContext<T>(context: AuthContext & {
        showDeleted?: boolean;
    }, fn: (prisma: PrismaClient) => Promise<T>): Promise<T>;
    healthCheck(): Promise<{
        status: 'ok' | 'error';
        timestamp: Date;
    }>;
    getDatabaseInfo(): Promise<{
        version: string;
        extensions: string[];
        connectionCount: number;
    }>;
}
