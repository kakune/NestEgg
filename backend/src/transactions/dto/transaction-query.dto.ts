import {
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { TransactionType } from '@prisma/client';

export class TransactionQueryDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'from must be a valid date string (YYYY-MM-DD)' },
  )
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid date string (YYYY-MM-DD)' })
  to?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    if (Array.isArray(value)) {
      return value as string[];
    }
    return [];
  })
  @IsArray({ message: 'category_id must be an array of UUIDs' })
  @IsUUID('all', {
    each: true,
    message: 'Each category_id must be a valid UUID',
  })
  category_id?: string[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    if (Array.isArray(value)) {
      return value as string[];
    }
    return [];
  })
  @IsArray({ message: 'actor_id must be an array of UUIDs' })
  @IsUUID('all', { each: true, message: 'Each actor_id must be a valid UUID' })
  actor_id?: string[];

  @IsOptional()
  @IsEnum(TransactionType, { message: 'type must be either EXPENSE or INCOME' })
  type?: TransactionType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    if (Array.isArray(value)) {
      return value as string[];
    }
    return [];
  })
  @IsArray({ message: 'tags must be an array of strings' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  tags?: string[];

  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  q?: string;

  @IsOptional()
  @IsEnum(['HOUSEHOLD', 'USER'], {
    message: 'should_pay must be either HOUSEHOLD or USER',
  })
  should_pay?: 'HOUSEHOLD' | 'USER';

  @IsOptional()
  @IsInt({ message: 'amount_min must be an integer' })
  @Min(0, { message: 'amount_min must be non-negative' })
  @Type(() => Number)
  amount_min?: number;

  @IsOptional()
  @IsInt({ message: 'amount_max must be an integer' })
  @Min(0, { message: 'amount_max must be non-negative' })
  @Type(() => Number)
  amount_max?: number;

  // Pagination
  @IsOptional()
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsString({ message: 'cursor must be a string' })
  cursor?: string;

  // Sorting
  @IsOptional()
  @IsIn(
    [
      'occurred_on',
      '-occurred_on',
      'amount_yen',
      '-amount_yen',
      'created_at',
      '-created_at',
      'updated_at',
      '-updated_at',
    ],
    {
      message:
        'sort must be one of: occurred_on, -occurred_on, amount_yen, -amount_yen, created_at, -created_at, updated_at, -updated_at',
    },
  )
  sort?: string = '-occurred_on';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '1';
  })
  include_deleted?: boolean = false;
}
