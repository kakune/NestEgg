import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActorType, Actor, UserRole } from '@prisma/client';

export interface AuthContext {
  userId: string;
  householdId: string;
  role: UserRole;
}

export interface CreateActorDto {
  name: string;
  type: ActorType;
  description?: string;
  userId?: string; // Optional - for creating actors for other users (admin only)
}

export interface UpdateActorDto {
  name?: string;
  type?: ActorType;
  description?: string;
}

@Injectable()
export class ActorsService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(authContext: AuthContext): Promise<Actor[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.actor.findMany({
        where: {
          householdId: authContext.householdId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [
          { type: 'asc' }, // Sort by type first (individual, business, etc.)
          { name: 'asc' }, // Then by name
        ],
      });
    });
  }

  async findOne(id: string, authContext: AuthContext): Promise<Actor> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const actor = await prisma.actor.findFirst({
        where: {
          id,
          householdId: authContext.householdId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          transactions: {
            select: {
              id: true,
              amount: true,
              description: true,
              date: true,
            },
            take: 10, // Latest 10 transactions
            orderBy: { date: 'desc' },
          },
        },
      });

      if (!actor) {
        throw new NotFoundException('Actor not found');
      }

      return actor;
    });
  }

  async findByUserId(userId: string, authContext: AuthContext): Promise<Actor[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.actor.findMany({
        where: {
          userId,
          householdId: authContext.householdId,
        },
      });
    });
  }

  async create(createActorDto: CreateActorDto, authContext: AuthContext): Promise<Actor> {
    // Determine target user ID
    const targetUserId = createActorDto.userId || authContext.userId;

    // Only admins can create actors for other users
    if (createActorDto.userId && authContext.role !== UserRole.admin) {
      throw new ForbiddenException('Only administrators can create actors for other users');
    }

    // Verify the target user exists and belongs to the same household
    const targetUser = await this.prismaService.prisma.user.findFirst({
      where: {
        id: targetUserId,
        householdId: authContext.householdId,
        deletedAt: null,
      },
    });

    if (!targetUser) {
      throw new BadRequestException('Target user not found or not in same household');
    }

    // Check if the actor name is already taken within the household
    const existingActor = await this.prismaService.prisma.actor.findFirst({
      where: {
        name: createActorDto.name,
        householdId: authContext.householdId,
        deletedAt: null,
      },
    });

    if (existingActor) {
      throw new BadRequestException('Actor with this name already exists');
    }

    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.actor.create({
        data: {
          name: createActorDto.name,
          type: createActorDto.type,
          description: createActorDto.description,
          householdId: authContext.householdId,
          userId: targetUserId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  }

  async update(id: string, updateActorDto: UpdateActorDto, authContext: AuthContext): Promise<Actor> {
    const existingActor = await this.findOne(id, authContext);

    // Users can only update their own actors unless they are admin
    if (authContext.role !== UserRole.admin && existingActor.userId !== authContext.userId) {
      throw new ForbiddenException('You can only update your own actors');
    }

    // Check name uniqueness if updating name
    if (updateActorDto.name && updateActorDto.name !== existingActor.name) {
      const existingNameActor = await this.prismaService.prisma.actor.findFirst({
        where: {
          name: updateActorDto.name,
          householdId: authContext.householdId,
          id: { not: id },
          deletedAt: null,
        },
      });

      if (existingNameActor) {
        throw new BadRequestException('Actor with this name already exists');
      }
    }

    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.actor.update({
        where: { id },
        data: {
          ...(updateActorDto.name && { name: updateActorDto.name }),
          ...(updateActorDto.type && { type: updateActorDto.type }),
          ...(updateActorDto.description !== undefined && { description: updateActorDto.description }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  }

  async remove(id: string, authContext: AuthContext): Promise<void> {
    const existingActor = await this.findOne(id, authContext);

    // Users can only delete their own actors unless they are admin
    if (authContext.role !== UserRole.admin && existingActor.userId !== authContext.userId) {
      throw new ForbiddenException('You can only delete your own actors');
    }

    // Prevent deleting actors that have transactions
    const transactionCount = await this.prismaService.prisma.transaction.count({
      where: { actorId: id },
    });

    if (transactionCount > 0) {
      throw new BadRequestException('Cannot delete actor with existing transactions');
    }

    await this.prismaService.withContext(authContext, async (prisma) => {
      await prisma.actor.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  async getActorStats(id: string, authContext: AuthContext): Promise<any> {
    const actor = await this.findOne(id, authContext);

    return this.prismaService.withContext(authContext, async (prisma) => {
      const [transactionCount, totalIncome, totalExpenses, recentTransactions] = await Promise.all([
        // Total transaction count
        prisma.transaction.count({
          where: { actorId: id },
        }),

        // Total income transactions
        prisma.transaction.aggregate({
          where: {
            actorId: id,
            amount: { gt: 0 },
          },
          _sum: { amount: true },
          _count: true,
        }),

        // Total expense transactions
        prisma.transaction.aggregate({
          where: {
            actorId: id,
            amount: { lt: 0 },
          },
          _sum: { amount: true },
          _count: true,
        }),

        // Recent transactions (last 30 days)
        prisma.transaction.count({
          where: {
            actorId: id,
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      return {
        actor: {
          id: actor.id,
          name: actor.name,
          type: actor.type,
        },
        statistics: {
          totalTransactions: transactionCount,
          totalIncome: totalIncome._sum.amount || 0,
          totalExpenses: Math.abs(totalExpenses._sum.amount || 0),
          netAmount: (totalIncome._sum.amount || 0) + (totalExpenses._sum.amount || 0),
          incomeTransactionCount: totalIncome._count,
          expenseTransactionCount: totalExpenses._count,
          recentTransactions: recentTransactions,
        },
      };
    });
  }
}