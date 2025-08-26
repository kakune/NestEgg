'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Transaction, TransactionType } from '@/types/transaction';
import { apiHelpers } from '@/lib/api-client';
import { toast } from 'sonner';

const transactionSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  type: z.nativeEnum(TransactionType),
  categoryId: z.string().min(1, 'Category is required'),
  actorId: z.string().min(1, 'Actor is required'),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  shouldPay: z.boolean().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  initialData?: Transaction | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransactionForm({
  initialData,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: initialData?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
      amount: initialData?.amount || 0,
      type: initialData?.type || TransactionType.EXPENSE,
      categoryId: initialData?.categoryId || '',
      actorId: initialData?.actorId || '',
      notes: initialData?.notes || '',
      tags: initialData?.tags || [],
      shouldPay: initialData?.shouldPay || false,
    },
  });

  const selectedType = watch('type');

  // Fetch categories and actors
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiHelpers.getCategories();
      return response.data.data || response.data;
    },
  });

  const { data: actors = [] } = useQuery({
    queryKey: ['actors'],
    queryFn: async () => {
      const response = await apiHelpers.getActors();
      return response.data.data || response.data;
    },
  });

  // Filter categories by type
  const filteredCategories = categories.filter(
    (category: { type: TransactionType }) => category.type === selectedType
  );

  const createMutation = useMutation({
    mutationFn: apiHelpers.createTransaction,
    onSuccess: () => {
      toast.success('Transaction created successfully');
      onSuccess();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to create transaction';
      toast.error(errorMessage || 'Failed to create transaction');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TransactionFormData> }) =>
      apiHelpers.updateTransaction(id, data),
    onSuccess: () => {
      toast.success('Transaction updated successfully');
      onSuccess();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to update transaction';
      toast.error(errorMessage || 'Failed to update transaction');
    },
  });

  const onSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);
    try {
      if (initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: {
            ...data,
            date: `${data.date}T00:00:00.000Z`,
          },
        });
      } else {
        await createMutation.mutateAsync({
          ...data,
          date: `${data.date}T00:00:00.000Z`,
        });
      }
    } catch {
      // Error handling is done in mutation callbacks
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset category when type changes
  useEffect(() => {
    if (selectedType && initialData?.type !== selectedType) {
      setValue('categoryId', '');
    }
  }, [selectedType, initialData?.type, setValue]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData ? 'Edit Transaction' : 'Add Transaction'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <Input
                    id="date"
                    type="date"
                    {...field}
                    className={errors.date ? 'border-destructive' : ''}
                  />
                )}
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TransactionType.INCOME}>
                        Income
                      </SelectItem>
                      <SelectItem value={TransactionType.EXPENSE}>
                        Expense
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (¥)</Label>
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    className={errors.amount ? 'border-destructive' : ''}
                  />
                )}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((category: { id: string; name: string; icon?: string }) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon && `${category.icon} `}{category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoryId && (
                <p className="text-sm text-destructive">{errors.categoryId.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="actor">Actor</Label>
            <Controller
              name="actorId"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select actor" />
                  </SelectTrigger>
                  <SelectContent>
                    {actors.map((actor: { id: string; name: string; kind: string }) => (
                      <SelectItem key={actor.id} value={actor.id}>
                        {actor.name} ({actor.kind})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.actorId && (
              <p className="text-sm text-destructive">{errors.actorId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <Textarea
                  id="notes"
                  placeholder="Optional notes..."
                  {...field}
                />
              )}
            />
          </div>

          {selectedType === TransactionType.EXPENSE && (
            <div className="flex items-center space-x-2">
              <Controller
                name="shouldPay"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="shouldPay"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label
                htmlFor="shouldPay"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Should be split in settlement
              </Label>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : initialData
                ? 'Update Transaction'
                : 'Create Transaction'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}