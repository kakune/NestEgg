import { Module } from '@nestjs/common';
import { CsvService } from './csv.service';
import { CsvController } from './csv.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { IncomesModule } from '../incomes/incomes.module';
import { ActorsModule } from '../actors/actors.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    PrismaModule,
    TransactionsModule,
    IncomesModule,
    ActorsModule,
    CategoriesModule,
  ],
  controllers: [CsvController],
  providers: [CsvService],
  exports: [CsvService],
})
export class CsvModule {}
