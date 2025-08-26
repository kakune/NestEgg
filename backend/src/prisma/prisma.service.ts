import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuthContext } from '../common/interfaces/auth-context.interface';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public prisma: PrismaClient;

  constructor(private configService: ConfigService) {
    this.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    this.prisma.$on('error' as never, (e: unknown) => {
      this.logger.error('Prisma error:', e);
    });

    this.prisma.$on('warn' as never, (e: unknown) => {
      this.logger.warn('Prisma warning:', e);
    });

    this.prisma.$on('info' as never, (e: unknown) => {
      this.logger.log('Prisma info:', e);
    });

    if (
      this.configService.get<string>('config.app.environment') === 'development'
    ) {
      this.prisma.$on(
        'query' as never,
        (e: { query: string; duration: number }) => {
          this.logger.debug(`Query: ${e.query} - ${e.duration}ms`);
        },
      );
    }

    await this.prisma.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    this.logger.log('Disconnected from database');
  }

  // Proxy Prisma methods
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

  /**
   * Set RLS session context for the current transaction
   */
  async setSessionContext(
    householdId: string,
    userId: string,
    userRole: UserRole,
    showDeleted = false,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      SELECT set_session_context(
        ${householdId}::uuid,
        ${userId}::uuid,
        ${userRole}::text,
        ${showDeleted}
      )
    `;
  }

  /**
   * Clear RLS session context
   */
  async clearSessionContext(): Promise<void> {
    await this.prisma.$executeRaw`SELECT clear_session_context()`;
  }

  /**
   * Execute a function with RLS context set
   */
  async withContext<T>(
    context: AuthContext & { showDeleted?: boolean },
    fn: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Set context on the transaction
      await tx.$executeRaw`
        SELECT set_session_context(
          ${context.householdId}::uuid,
          ${context.userId}::uuid,
          ${context.role}::text,
          ${context.showDeleted ?? false}
        )
      `;

      // Pass the transaction client (cast to full PrismaClient type)
      return fn(tx as PrismaClient);
    });
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; timestamp: Date }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp: new Date() };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return { status: 'error', timestamp: new Date() };
    }
  }

  /**
   * Get database version and connection info
   */
  async getDatabaseInfo(): Promise<{
    version: string;
    extensions: string[];
    connectionCount: number;
  }> {
    const versionResult = await this.prisma.$queryRaw<
      [{ version: string }]
    >`SELECT version()`;
    const extensionsResult = await this.prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('citext', 'uuid-ossp')
    `;
    const connectionsResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
    `;

    return {
      version: versionResult[0]?.version ?? 'unknown',
      extensions: extensionsResult.map(
        (ext: { extname: string }) => ext.extname,
      ),
      connectionCount: Number(connectionsResult[0]?.count ?? 0),
    };
  }
}
