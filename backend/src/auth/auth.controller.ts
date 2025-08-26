import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService, AuthResponse } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreatePersonalAccessTokenDto } from './dto/create-personal-access-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser('sessionId') sessionId: string): Promise<void> {
    if (sessionId) {
      await this.authService.logout(sessionId);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      user: {
        id: user.userId,
        email: user.email,
        householdId: user.householdId,
        role: user.role,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('personal-access-tokens')
  @HttpCode(HttpStatus.CREATED)
  async createPersonalAccessToken(
    @CurrentUser('userId') userId: string,
    @Body() createPatDto: CreatePersonalAccessTokenDto,
  ): Promise<{ token: string; id: string }> {
    return this.authService.createPersonalAccessToken(userId, createPatDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('personal-access-tokens/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokePersonalAccessToken(
    @CurrentUser('userId') userId: string,
    @Param('tokenId') tokenId: string,
  ): Promise<void> {
    await this.authService.revokePersonalAccessToken(userId, tokenId);
  }
}
