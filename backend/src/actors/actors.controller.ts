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
import {
  ActorsService,
  CreateActorDto,
  UpdateActorDto,
} from './actors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Actor } from '@prisma/client';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';

@Controller('actors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActorsController {
  constructor(private readonly actorsService: ActorsService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<Actor[]> {
    return this.actorsService.findAll(user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Actor> {
    return this.actorsService.findOne(id, user);
  }

  @Get('user/:userId')
  async findByUserId(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Actor[]> {
    return this.actorsService.findByUserId(userId, user);
  }

  @Get(':id/stats')
  async getActorStats(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return this.actorsService.getActorStats(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createActorDto: CreateActorDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Actor> {
    return this.actorsService.create(createActorDto, user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateActorDto: UpdateActorDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Actor> {
    return this.actorsService.update(id, updateActorDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.actorsService.remove(id, user);
  }
}
