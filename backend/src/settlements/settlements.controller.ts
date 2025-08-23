import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
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
import { AuthContext } from '../common/interfaces/auth-context.interface';

interface RunSettlementDto {
  year: number;
  month: number;
}

@Controller('settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  async findAll(@CurrentUser() user: any): Promise<SettlementWithLines[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.settlementsService.findAll(authContext);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<SettlementWithLines> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.settlementsService.findOne(id, authContext);
  }

  @Post('run')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  async runSettlement(
    @Body() dto: RunSettlementDto,
    @CurrentUser() user: any,
  ): Promise<SettlementWithLines> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

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
    @CurrentUser() user: any,
  ): Promise<SettlementWithLines> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

    return this.settlementsService.finalizeSettlement(id, authContext);
  }

  @Get('month/:year/:month')
  async findByMonth(
    @Param('year') year: string,
    @Param('month') month: string,
    @CurrentUser() user: any,
  ): Promise<SettlementWithLines | null> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

    // This will be implemented to find settlement by specific month
    // For now, return null
    return null;
  }
}