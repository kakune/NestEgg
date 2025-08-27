import 'reflect-metadata';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionQueryDto,
} from './index';

describe('Transaction DTOs Index', () => {
  it('should export CreateTransactionDto', () => {
    expect(CreateTransactionDto).toBeDefined();
    expect(typeof CreateTransactionDto).toBe('function');
  });

  it('should export UpdateTransactionDto', () => {
    expect(UpdateTransactionDto).toBeDefined();
    expect(typeof UpdateTransactionDto).toBe('function');
  });

  it('should export TransactionQueryDto', () => {
    expect(TransactionQueryDto).toBeDefined();
    expect(typeof TransactionQueryDto).toBe('function');
  });

  it('should be able to instantiate CreateTransactionDto', () => {
    const dto = new CreateTransactionDto();
    expect(dto).toBeDefined();
    expect(dto).toBeInstanceOf(CreateTransactionDto);
  });

  it('should be able to instantiate UpdateTransactionDto', () => {
    const dto = new UpdateTransactionDto();
    expect(dto).toBeDefined();
    expect(dto).toBeInstanceOf(UpdateTransactionDto);
  });

  it('should be able to instantiate TransactionQueryDto', () => {
    const dto = new TransactionQueryDto();
    expect(dto).toBeDefined();
    expect(dto).toBeInstanceOf(TransactionQueryDto);
  });
});
