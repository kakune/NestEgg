import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsString({ message: 'cursor must be a string' })
  cursor?: string;

  @IsOptional()
  @IsString({ message: 'sort must be a string' })
  sort?: string;

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === '1',
  )
  include_deleted?: boolean = false;
}

export class DateRangeDto {
  @IsOptional()
  @IsString({ message: 'from must be a valid date string (YYYY-MM-DD)' })
  from?: string;

  @IsOptional()
  @IsString({ message: 'to must be a valid date string (YYYY-MM-DD)' })
  to?: string;
}

export interface PaginationResult<T> {
  items: T[];
  meta: {
    has_more: boolean;
    next_cursor?: string;
    count: number;
    [key: string]: unknown;
  };
}

export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
}

export function parseSortParam(sort: string = '-created_at'): {
  field: string;
  order: 'asc' | 'desc';
} {
  if (sort.startsWith('-')) {
    return {
      field: sort.slice(1),
      order: 'desc',
    };
  }
  return {
    field: sort,
    order: 'asc',
  };
}

export function buildCursorCondition(
  cursor: string | undefined,
  sortField: string,
  sortOrder: 'asc' | 'desc',
): Record<string, unknown> | undefined {
  if (!cursor) {
    return undefined;
  }

  try {
    const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
    const [field, value] = decodedCursor.split(':');

    if (field !== sortField) {
      return undefined;
    }

    // Handle different field types
    let parsedValue: string | number | Date = value;
    if (
      field === 'created_at' ||
      field === 'updated_at' ||
      field === 'occurred_on'
    ) {
      parsedValue = new Date(value);
    } else if (field === 'amount_yen') {
      parsedValue = parseInt(value, 10);
    }

    return {
      [field]: sortOrder === 'asc' ? { gt: parsedValue } : { lt: parsedValue },
    };
  } catch {
    return undefined;
  }
}

export function encodeCursor(field: string, value: unknown): string {
  const cursorValue =
    value instanceof Date ? value.toISOString() : String(value);
  return Buffer.from(`${field}:${cursorValue}`).toString('base64');
}
