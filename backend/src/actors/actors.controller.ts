import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ActorsService, AuthContext, CreateActorDto, UpdateActorDto } from './actors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Actor } from '@prisma/client';

@Controller('actors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActorsController {
  constructor(private readonly actorsService: ActorsService) {}

  @Get()
  async findAll(@CurrentUser() user: any): Promise<Actor[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.actorsService.findAll(authContext);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any): Promise<Actor> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.actorsService.findOne(id, authContext);
  }

  @Get('user/:userId')
  async findByUserId(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ): Promise<Actor[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.actorsService.findByUserId(userId, authContext);
  }

  @Get(':id/stats')
  async getActorStats(@Param('id') id: string, @CurrentUser() user: any): Promise<any> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.actorsService.getActorStats(id, authContext);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createActorDto: CreateActorDto,
    @CurrentUser() user: any,
  ): Promise<Actor> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.actorsService.create(createActorDto, authContext);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateActorDto: UpdateActorDto,
    @CurrentUser() user: any,
  ): Promise<Actor> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.actorsService.update(id, updateActorDto, authContext);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: any): Promise<void> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    await this.actorsService.remove(id, authContext);
  }
}