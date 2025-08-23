import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  SettlementsService,
  YearMonth,
  SettlementWithLines,
} from './settlements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { UserRole } from '@prisma/client';
import {
  AuthContext,
  AuthenticatedUser,
} from '../common/interfaces/auth-context.interface';

interface RunSettlementDto {
  year: number;
  month: number;
}

@Controller('settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

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
  ): Promise<SettlementWithLines[]> {
    return this.settlementsService.findAll(this.getAuthContext(user));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SettlementWithLines> {
    return this.settlementsService.findOne(id, this.getAuthContext(user));
  }

  @Post('run')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  async runSettlement(
    @Body() dto: RunSettlementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SettlementWithLines> {
    const authContext = this.getAuthContext(user);
    const month: YearMonth = {
      year: dto.year,
      month: dto.month,
    };

    return this.settlementsService.runSettlement(
      authContext.householdId,
      month,
      authContext,
    );
  }

  @Post(':id/finalize')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  async finalizeSettlement(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SettlementWithLines> {
    return this.settlementsService.finalizeSettlement(
      id,
      this.getAuthContext(user),
    );
  }

  @Get('month/:year/:month')
  findByMonth(): Promise<SettlementWithLines | null> {
    // This will be implemented to find settlement by specific month
    // For now, return null
    return Promise.resolve(null);
  }
}
