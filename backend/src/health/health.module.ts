import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    TerminusModule.forRoot({
      errorLogStyle: 'pretty',
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
