"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const config_1 = require("@nestjs/config");
let PrismaService = PrismaService_1 = class PrismaService {
    configService;
    logger = new common_1.Logger(PrismaService_1.name);
    prisma;
    constructor(configService) {
        this.configService = configService;
        this.prisma = new client_1.PrismaClient({
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'info' },
                { emit: 'event', level: 'warn' },
            ],
        });
    }
    async onModuleInit() {
        this.prisma.$on('error', (e) => {
            this.logger.error('Prisma error:', e);
        });
        this.prisma.$on('warn', (e) => {
            this.logger.warn('Prisma warning:', e);
        });
        this.prisma.$on('info', (e) => {
            this.logger.log('Prisma info:', e);
        });
        if (this.configService.get('config.app.environment') === 'development') {
            this.prisma.$on('query', (e) => {
                this.logger.debug(`Query: ${e.query} - ${e.duration}ms`);
            });
        }
        await this.prisma.$connect();
        this.logger.log('Connected to database');
    }
    async onModuleDestroy() {
        await this.prisma.$disconnect();
        this.logger.log('Disconnected from database');
    }
    get user() {
        return this.prisma.user;
    }
    get household() {
        return this.prisma.household;
    }
    get actor() {
        return this.prisma.actor;
    }
    get category() {
        return this.prisma.category;
    }
    get transaction() {
        return this.prisma.transaction;
    }
    get income() {
        return this.prisma.income;
    }
    get settlement() {
        return this.prisma.settlement;
    }
    get settlementLine() {
        return this.prisma.settlementLine;
    }
    get policy() {
        return this.prisma.policy;
    }
    get auditLog() {
        return this.prisma.auditLog;
    }
    async setSessionContext(householdId, userId, userRole, showDeleted = false) {
        await this.prisma.$executeRaw `
      SELECT set_session_context(
        ${householdId}::uuid,
        ${userId}::uuid,
        ${userRole}::text,
        ${showDeleted}
      )
    `;
    }
    async clearSessionContext() {
        await this.prisma.$executeRaw `SELECT clear_session_context()`;
    }
    async withContext(context, fn) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `
        SELECT set_session_context(
          ${context.householdId}::uuid,
          ${context.userId}::uuid,
          ${context.role}::text,
          ${context.showDeleted ?? false}
        )
      `;
            return fn(tx);
        });
    }
    async healthCheck() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return { status: 'ok', timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Database health check failed:', error);
            return { status: 'error', timestamp: new Date() };
        }
    }
    async getDatabaseInfo() {
        const versionResult = await this.prisma.$queryRaw `SELECT version()`;
        const extensionsResult = await this.prisma.$queryRaw `
      SELECT extname FROM pg_extension WHERE extname IN ('citext', 'uuid-ossp')
    `;
        const connectionsResult = await this.prisma.$queryRaw `
      SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
    `;
        return {
            version: versionResult[0]?.version ?? 'unknown',
            extensions: extensionsResult.map((ext) => ext.extname),
            connectionCount: Number(connectionsResult[0]?.count ?? 0),
        };
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map