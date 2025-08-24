import {
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsUUID,
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TransactionType } from '@prisma/client';

export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TransactionType, { message: 'Type must be either EXPENSE or INCOME' })
  type?: TransactionType;

  @IsOptional()
  @IsInt({ message: 'Amount must be an integer' })
  @Min(1, { message: 'Amount must be a positive integer' })
  @Type(() => Number)
  amount_yen?: number;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'occurred_on must be a valid date string (YYYY-MM-DD)' },
  )
  occurred_on?: string;

  @IsOptional()
  @IsUUID('4', { message: 'category_id must be a valid UUID' })
  category_id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'payer_actor_id must be a valid UUID' })
  payer_actor_id?: string;

  @IsOptional()
  @IsEnum(['HOUSEHOLD', 'USER'], {
    message: 'should_pay must be either HOUSEHOLD or USER',
  })
  should_pay?: 'HOUSEHOLD' | 'USER';

  @ValidateIf((o: UpdateTransactionDto) => o.should_pay === 'USER')
  @IsUUID('4', {
    message: 'should_pay_user_id is required when should_pay is USER',
  })
  should_pay_user_id?: string;

  @IsOptional()
  @IsString({ message: 'Note must be a string' })
  @MaxLength(500, { message: 'Note must not exceed 500 characters' })
  note?: string;

  @IsOptional()
  @IsArray({ message: 'Tags must be an array' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return [value];
    }
    if (Array.isArray(value)) {
      return value.slice(0, 10) as string[];
    }
    return [];
  })
  tags?: string[];
}
