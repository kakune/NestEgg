import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ActorsModule } from '../actors/actors.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [PrismaModule, ActorsModule, CategoriesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}