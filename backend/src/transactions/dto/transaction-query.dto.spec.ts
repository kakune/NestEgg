import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TransactionQueryDto } from './transaction-query.dto';
import { TransactionType } from '@prisma/client';

describe('TransactionQueryDto', () => {
  let dto: TransactionQueryDto;

  beforeEach(() => {
    dto = new TransactionQueryDto();
  });

  describe('instantiation', () => {
    it('should create instance with default values', () => {
      expect(dto).toBeDefined();
      expect(dto.limit).toBe(50);
      expect(dto.sort).toBe('-occurred_on');
      expect(dto.include_deleted).toBe(false);
    });
  });

  describe('date validation', () => {
    describe('from field', () => {
      it('should accept valid date string', async () => {
        const data = { from: '2023-01-01' };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const fromErrors = errors.filter((error) => error.property === 'from');
        expect(fromErrors).toHaveLength(0);
      });

      it('should reject invalid date format', async () => {
        const data = { from: 'invalid-date' };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const fromErrors = errors.filter((error) => error.property === 'from');
        expect(fromErrors.length).toBeGreaterThan(0);
        expect(fromErrors[0]?.constraints).toHaveProperty('isDateString');
      });

      it('should be optional', async () => {
        const data = {};
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const fromErrors = errors.filter((error) => error.property === 'from');
        expect(fromErrors).toHaveLength(0);
      });
    });

    describe('to field', () => {
      it('should accept valid date string', async () => {
        const data = { to: '2023-12-31' };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const toErrors = errors.filter((error) => error.property === 'to');
        expect(toErrors).toHaveLength(0);
      });

      it('should reject invalid date format', async () => {
        const data = { to: '2023-13-01' };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const toErrors = errors.filter((error) => error.property === 'to');
        expect(toErrors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('category_id validation and transformation', () => {
    it('should transform comma-separated string to array', () => {
      const data = { category_id: 'uuid1,uuid2,uuid3' };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.category_id).toEqual(['uuid1', 'uuid2', 'uuid3']);
    });

    it('should keep array as is', () => {
      const data = { category_id: ['uuid1', 'uuid2'] };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.category_id).toEqual(['uuid1', 'uuid2']);
    });

    it('should return empty array for invalid input', () => {
      const data = { category_id: 123 };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.category_id).toEqual([]);
    });

    it('should validate UUIDs in array', async () => {
      const validUuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '123e4567-e89b-12d3-a456-426614174000',
      ];
      const data = { category_id: validUuids };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const categoryErrors = errors.filter(
        (error) => error.property === 'category_id',
      );
      expect(categoryErrors).toHaveLength(0);
    });

    it('should reject invalid UUIDs', async () => {
      const data = { category_id: ['not-a-uuid', 'also-not-uuid'] };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const categoryErrors = errors.filter(
        (error) => error.property === 'category_id',
      );
      expect(categoryErrors.length).toBeGreaterThan(0);
    });
  });

  describe('actor_id validation and transformation', () => {
    it('should transform comma-separated string to array', () => {
      const data = { actor_id: 'uuid1,uuid2,uuid3' };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.actor_id).toEqual(['uuid1', 'uuid2', 'uuid3']);
    });

    it('should keep array as is', () => {
      const data = { actor_id: ['uuid1', 'uuid2'] };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.actor_id).toEqual(['uuid1', 'uuid2']);
    });

    it('should return empty array for invalid input', () => {
      const data = { actor_id: null };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.actor_id).toEqual([]);
    });

    it('should validate UUIDs in array', async () => {
      const validUuids = ['550e8400-e29b-41d4-a716-446655440000'];
      const data = { actor_id: validUuids };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const actorErrors = errors.filter(
        (error) => error.property === 'actor_id',
      );
      expect(actorErrors).toHaveLength(0);
    });

    it('should reject invalid UUIDs', async () => {
      const data = { actor_id: ['invalid-uuid'] };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const actorErrors = errors.filter(
        (error) => error.property === 'actor_id',
      );
      expect(actorErrors.length).toBeGreaterThan(0);
    });
  });

  describe('type validation', () => {
    it('should accept EXPENSE type', async () => {
      const data = { type: TransactionType.EXPENSE };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const typeErrors = errors.filter((error) => error.property === 'type');
      expect(typeErrors).toHaveLength(0);
    });

    it('should accept INCOME type', async () => {
      const data = { type: TransactionType.INCOME };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const typeErrors = errors.filter((error) => error.property === 'type');
      expect(typeErrors).toHaveLength(0);
    });

    it('should reject invalid type', async () => {
      const data = { type: 'INVALID_TYPE' };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const typeErrors = errors.filter((error) => error.property === 'type');
      expect(typeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('tags validation and transformation', () => {
    it('should transform comma-separated string to array', () => {
      const data = { tags: 'tag1,tag2,tag3' };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should keep array as is', () => {
      const data = { tags: ['tag1', 'tag2'] };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.tags).toEqual(['tag1', 'tag2']);
    });

    it('should return empty array for invalid input', () => {
      const data = { tags: 123 };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.tags).toEqual([]);
    });

    it('should validate string tags', async () => {
      const data = { tags: ['tag1', 'tag2', 'tag3'] };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const tagErrors = errors.filter((error) => error.property === 'tags');
      expect(tagErrors).toHaveLength(0);
    });

    it('should reject non-string tags', async () => {
      const data = { tags: ['tag1', 123, 'tag3'] };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const tagErrors = errors.filter((error) => error.property === 'tags');
      expect(tagErrors.length).toBeGreaterThan(0);
    });
  });

  describe('search query validation', () => {
    it('should accept string search query', async () => {
      const data = { q: 'search term' };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const qErrors = errors.filter((error) => error.property === 'q');
      expect(qErrors).toHaveLength(0);
    });

    it('should reject non-string search query', async () => {
      const data = { q: 123 };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const qErrors = errors.filter((error) => error.property === 'q');
      expect(qErrors.length).toBeGreaterThan(0);
    });
  });

  describe('should_pay validation', () => {
    it('should accept HOUSEHOLD value', async () => {
      const data = { should_pay: 'HOUSEHOLD' };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const shouldPayErrors = errors.filter(
        (error) => error.property === 'should_pay',
      );
      expect(shouldPayErrors).toHaveLength(0);
    });

    it('should accept USER value', async () => {
      const data = { should_pay: 'USER' };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const shouldPayErrors = errors.filter(
        (error) => error.property === 'should_pay',
      );
      expect(shouldPayErrors).toHaveLength(0);
    });

    it('should reject invalid should_pay value', async () => {
      const data = { should_pay: 'INVALID' };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const shouldPayErrors = errors.filter(
        (error) => error.property === 'should_pay',
      );
      expect(shouldPayErrors.length).toBeGreaterThan(0);
    });
  });

  describe('amount range validation', () => {
    describe('amount_min', () => {
      it('should accept valid positive integer', async () => {
        const data = { amount_min: 100 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const amountMinErrors = errors.filter(
          (error) => error.property === 'amount_min',
        );
        expect(amountMinErrors).toHaveLength(0);
      });

      it('should accept zero', async () => {
        const data = { amount_min: 0 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const amountMinErrors = errors.filter(
          (error) => error.property === 'amount_min',
        );
        expect(amountMinErrors).toHaveLength(0);
      });

      it('should reject negative numbers', async () => {
        const data = { amount_min: -100 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const amountMinErrors = errors.filter(
          (error) => error.property === 'amount_min',
        );
        expect(amountMinErrors.length).toBeGreaterThan(0);
      });

      it('should reject non-integer values', async () => {
        const data = { amount_min: 100.5 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const amountMinErrors = errors.filter(
          (error) => error.property === 'amount_min',
        );
        expect(amountMinErrors.length).toBeGreaterThan(0);
      });

      it('should transform string numbers', () => {
        const data = { amount_min: '150' };
        const dto = plainToInstance(TransactionQueryDto, data);

        expect(dto.amount_min).toBe(150);
        expect(typeof dto.amount_min).toBe('number');
      });
    });

    describe('amount_max', () => {
      it('should accept valid positive integer', async () => {
        const data = { amount_max: 1000 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const amountMaxErrors = errors.filter(
          (error) => error.property === 'amount_max',
        );
        expect(amountMaxErrors).toHaveLength(0);
      });

      it('should reject negative numbers', async () => {
        const data = { amount_max: -500 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const amountMaxErrors = errors.filter(
          (error) => error.property === 'amount_max',
        );
        expect(amountMaxErrors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('pagination validation', () => {
    describe('limit', () => {
      it('should have default value of 50', () => {
        const dto = plainToInstance(TransactionQueryDto, {});
        expect(dto.limit).toBe(50);
      });

      it('should accept valid limit within range', async () => {
        const data = { limit: 25 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const limitErrors = errors.filter(
          (error) => error.property === 'limit',
        );
        expect(limitErrors).toHaveLength(0);
      });

      it('should reject limit below 1', async () => {
        const data = { limit: 0 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const limitErrors = errors.filter(
          (error) => error.property === 'limit',
        );
        expect(limitErrors.length).toBeGreaterThan(0);
      });

      it('should reject limit above 100', async () => {
        const data = { limit: 150 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const limitErrors = errors.filter(
          (error) => error.property === 'limit',
        );
        expect(limitErrors.length).toBeGreaterThan(0);
      });

      it('should transform string numbers', () => {
        const data = { limit: '25' };
        const dto = plainToInstance(TransactionQueryDto, data);

        expect(dto.limit).toBe(25);
        expect(typeof dto.limit).toBe('number');
      });
    });

    describe('cursor', () => {
      it('should accept string cursor', async () => {
        const data = { cursor: 'cursor-string-123' };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const cursorErrors = errors.filter(
          (error) => error.property === 'cursor',
        );
        expect(cursorErrors).toHaveLength(0);
      });

      it('should reject non-string cursor', async () => {
        const data = { cursor: 123 };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const cursorErrors = errors.filter(
          (error) => error.property === 'cursor',
        );
        expect(cursorErrors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('sorting validation', () => {
    it('should have default sort value', () => {
      const dto = plainToInstance(TransactionQueryDto, {});
      expect(dto.sort).toBe('-occurred_on');
    });

    it('should accept valid sort fields', async () => {
      const validSorts = [
        'occurred_on',
        'amount_yen',
        'created_at',
        'updated_at',
      ];

      for (const sortField of validSorts) {
        const data = { sort: sortField };
        const dto = plainToInstance(TransactionQueryDto, data);
        const errors = await validate(dto);

        const sortErrors = errors.filter((error) => error.property === 'sort');
        expect(sortErrors).toHaveLength(0);
      }
    });

    it('should reject invalid sort field', async () => {
      const data = { sort: 'invalid_field' };
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      const sortErrors = errors.filter((error) => error.property === 'sort');
      expect(sortErrors.length).toBeGreaterThan(0);
    });
  });

  describe('include_deleted transformation and validation', () => {
    it('should have default value of false', () => {
      const dto = plainToInstance(TransactionQueryDto, {});
      expect(dto.include_deleted).toBe(false);
    });

    it('should transform "true" string to true boolean', () => {
      const data = { include_deleted: 'true' };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.include_deleted).toBe(true);
    });

    it('should transform "1" string to true boolean', () => {
      const data = { include_deleted: '1' };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.include_deleted).toBe(true);
    });

    it('should transform other values to false', () => {
      const testCases = ['false', '0', 'no', 'anything'];

      testCases.forEach((testValue) => {
        const data = { include_deleted: testValue };
        const dto = plainToInstance(TransactionQueryDto, data);

        expect(dto.include_deleted).toBe(false);
      });
    });

    it('should keep boolean values as is', () => {
      const data = { include_deleted: true };
      const dto = plainToInstance(TransactionQueryDto, data);

      expect(dto.include_deleted).toBe(true);
    });
  });

  describe('complex validation scenarios', () => {
    it('should validate complete valid query', async () => {
      const data = {
        from: '2023-01-01',
        to: '2023-12-31',
        category_id: ['550e8400-e29b-41d4-a716-446655440000'],
        actor_id: ['123e4567-e89b-12d3-a456-426614174000'],
        type: TransactionType.EXPENSE,
        tags: ['food', 'grocery'],
        q: 'search term',
        should_pay: 'HOUSEHOLD',
        amount_min: 100,
        amount_max: 1000,
        limit: 25,
        cursor: 'cursor-123',
        sort: 'amount_yen',
        include_deleted: true,
      };

      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should handle empty object gracefully', async () => {
      const data = {};
      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(50);
      expect(dto.sort).toBe('-occurred_on');
      expect(dto.include_deleted).toBe(false);
    });

    it('should accumulate multiple validation errors', async () => {
      const data = {
        from: 'invalid-date',
        category_id: ['invalid-uuid'],
        type: 'INVALID_TYPE',
        amount_min: -100,
        limit: 200,
      };

      const dto = plainToInstance(TransactionQueryDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);

      const errorProperties = errors.map((error) => error.property);
      expect(errorProperties).toContain('from');
      expect(errorProperties).toContain('category_id');
      expect(errorProperties).toContain('type');
      expect(errorProperties).toContain('amount_min');
      expect(errorProperties).toContain('limit');
    });
  });
});
