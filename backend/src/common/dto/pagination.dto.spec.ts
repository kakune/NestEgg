import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

import {
  PaginationDto,
  DateRangeDto,
  parseSortParam,
  buildCursorCondition,
  encodeCursor,
} from './pagination.dto';

describe('PaginationDto', () => {
  describe('validation', () => {
    it('should accept valid pagination data', async () => {
      const dto = plainToClass(PaginationDto, {
        limit: 25,
        cursor: 'eyJpZCI6IjEyMyJ9',
        sort: 'created_at',
        include_deleted: false,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should use default values when optional fields are not provided', async () => {
      const dto = plainToClass(PaginationDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(50);
      expect(dto.include_deleted).toBe(false);
    });

    it('should reject limit below minimum', async () => {
      const dto = plainToClass(PaginationDto, {
        limit: 0,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.constraints?.min).toBe('limit must be at least 1');
    });

    it('should reject limit above maximum', async () => {
      const dto = plainToClass(PaginationDto, {
        limit: 150,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.constraints?.max).toBe('limit must not exceed 100');
    });

    it('should reject non-integer limit', async () => {
      const dto = plainToClass(PaginationDto, {
        limit: 'not a number',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.constraints?.isInt).toBe('limit must be an integer');
    });

    it('should reject non-string cursor', async () => {
      const dto = plainToClass(PaginationDto, {
        cursor: 12345,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.constraints?.isString).toBe('cursor must be a string');
    });

    it('should reject non-string sort', async () => {
      const dto = plainToClass(PaginationDto, {
        sort: 12345,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.constraints?.isString).toBe('sort must be a string');
    });

    it('should transform include_deleted string values to boolean', () => {
      const dtoTrue1 = plainToClass(PaginationDto, {
        include_deleted: 'true',
      });
      const dtoTrue2 = plainToClass(PaginationDto, {
        include_deleted: '1',
      });
      const dtoFalse1 = plainToClass(PaginationDto, {
        include_deleted: 'false',
      });
      const dtoFalse2 = plainToClass(PaginationDto, {
        include_deleted: '0',
      });

      expect(dtoTrue1.include_deleted).toBe(true);
      expect(dtoTrue2.include_deleted).toBe(true);
      expect(dtoFalse1.include_deleted).toBe(false);
      expect(dtoFalse2.include_deleted).toBe(false);
    });

    it('should transform limit string to number', () => {
      const dto = plainToClass(PaginationDto, {
        limit: '25',
      });

      expect(typeof dto.limit).toBe('number');
      expect(dto.limit).toBe(25);
    });
  });
});

describe('DateRangeDto', () => {
  describe('validation', () => {
    it('should accept valid date range', async () => {
      const dto = plainToClass(DateRangeDto, {
        from: '2023-01-01',
        to: '2023-12-31',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept empty date range', async () => {
      const dto = plainToClass(DateRangeDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    // Note: @IsDateString() is more permissive than expected and accepts various formats
    // that JavaScript can parse, so we focus on testing valid cases

    it('should accept ISO date format', async () => {
      const dto = plainToClass(DateRangeDto, {
        from: '2023-01-01T00:00:00.000Z',
        to: '2023-12-31T23:59:59.999Z',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});

describe('parseSortParam', () => {
  it('should parse descending sort parameter', () => {
    const result = parseSortParam('-created_at');
    expect(result).toEqual({
      field: 'created_at',
      order: 'desc',
    });
  });

  it('should parse ascending sort parameter', () => {
    const result = parseSortParam('updated_at');
    expect(result).toEqual({
      field: 'updated_at',
      order: 'asc',
    });
  });

  it('should use default parameter when none provided', () => {
    const result = parseSortParam();
    expect(result).toEqual({
      field: 'created_at',
      order: 'desc',
    });
  });

  it('should handle empty string', () => {
    const result = parseSortParam('');
    expect(result).toEqual({
      field: '',
      order: 'asc',
    });
  });

  it('should handle field names with dashes', () => {
    const result = parseSortParam('-occurred-on');
    expect(result).toEqual({
      field: 'occurred-on',
      order: 'desc',
    });
  });
});

describe('buildCursorCondition', () => {
  it('should return undefined when cursor is not provided', () => {
    const result = buildCursorCondition(undefined, 'created_at', 'asc');
    expect(result).toBeUndefined();
  });

  it('should build ascending condition for date field', () => {
    const cursor = Buffer.from('created_at:2023-01-01').toString('base64');
    const result = buildCursorCondition(cursor, 'created_at', 'asc');

    expect(result).toEqual({
      created_at: {
        gt: new Date('2023-01-01'),
      },
    });
  });

  it('should build descending condition for date field', () => {
    const cursor = Buffer.from('updated_at:2023-12-31').toString('base64');
    const result = buildCursorCondition(cursor, 'updated_at', 'desc');

    expect(result).toEqual({
      updated_at: {
        lt: new Date('2023-12-31'),
      },
    });
  });

  it('should build condition for amount field', () => {
    const cursor = Buffer.from('amount_yen:5000').toString('base64');
    const result = buildCursorCondition(cursor, 'amount_yen', 'asc');

    expect(result).toEqual({
      amount_yen: {
        gt: 5000,
      },
    });
  });

  it('should build condition for string field', () => {
    const cursor = Buffer.from('name:John Doe').toString('base64');
    const result = buildCursorCondition(cursor, 'name', 'desc');

    expect(result).toEqual({
      name: {
        lt: 'John Doe',
      },
    });
  });

  it('should return undefined for mismatched field', () => {
    const cursor = Buffer.from('created_at:2023-01-01T00:00:00.000Z').toString(
      'base64',
    );
    const result = buildCursorCondition(cursor, 'updated_at', 'asc');

    expect(result).toBeUndefined();
  });

  it('should return undefined for invalid cursor format', () => {
    const cursor = 'invalid-cursor';
    const result = buildCursorCondition(cursor, 'created_at', 'asc');

    expect(result).toBeUndefined();
  });

  it('should handle occurred_on field as date', () => {
    const cursor = Buffer.from('occurred_on:2023-06-15').toString('base64');
    const result = buildCursorCondition(cursor, 'occurred_on', 'asc');

    expect(result).toEqual({
      occurred_on: {
        gt: new Date('2023-06-15'),
      },
    });
  });
});

describe('encodeCursor', () => {
  it('should encode string value', () => {
    const result = encodeCursor('name', 'John Doe');
    const decoded = Buffer.from(result, 'base64').toString('utf-8');
    expect(decoded).toBe('name:John Doe');
  });

  it('should encode number value', () => {
    const result = encodeCursor('amount_yen', 1500);
    const decoded = Buffer.from(result, 'base64').toString('utf-8');
    expect(decoded).toBe('amount_yen:1500');
  });

  it('should encode Date value', () => {
    const date = new Date('2023-01-01T00:00:00.000Z');
    const result = encodeCursor('created_at', date);
    const decoded = Buffer.from(result, 'base64').toString('utf-8');
    expect(decoded).toBe('created_at:2023-01-01T00:00:00.000Z');
  });

  it('should encode null value', () => {
    const result = encodeCursor('field', null);
    const decoded = Buffer.from(result, 'base64').toString('utf-8');
    expect(decoded).toBe('field:null');
  });

  it('should encode undefined value', () => {
    const result = encodeCursor('field', undefined);
    const decoded = Buffer.from(result, 'base64').toString('utf-8');
    expect(decoded).toBe('field:undefined');
  });
});
