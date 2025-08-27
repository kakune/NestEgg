'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Category, TransactionType } from '@/types/transaction';
import { apiHelpers } from '@/lib/api-client';
import { toast } from 'sonner';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  type: z.nativeEnum(TransactionType),
  parentId: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
  budgetLimit: z.number().min(0, 'Budget limit must be 0 or greater').optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  initialData?: Category | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryForm({
  initialData,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialData?.name || '',
      type: initialData?.type || TransactionType.EXPENSE,
      parentId: initialData?.parentId || '',
      icon: initialData?.icon || '',
      color: initialData?.color || '#6B7280',
      budgetLimit: initialData?.budgetLimit || undefined,
    },
  });

  const selectedType = watch('type');

  // Fetch categories for parent selection
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiHelpers.getCategories();
      return response.data.data || response.data;
    },
  });

  // Filter categories by type and exclude self for parent selection
  const availableParentCategories = categories.filter(
    (category: Category) => 
      category.type === selectedType && 
      category.id !== initialData?.id &&
      // Prevent circular references - don't allow selecting children as parents
      !isDescendantOfCategory(category.id, initialData?.id || '', categories)
  );

  const createMutation = useMutation({
    mutationFn: apiHelpers.createCategory,
    onSuccess: () => {
      toast.success('Category created successfully');
      onSuccess();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to create category';
      toast.error(errorMessage || 'Failed to create category');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CategoryFormData> }) =>
      apiHelpers.updateCategory(id, data),
    onSuccess: () => {
      toast.success('Category updated successfully');
      onSuccess();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to update category';
      toast.error(errorMessage || 'Failed to update category');
    },
  });

  const onSubmit = async (data: CategoryFormData) => {
    setIsSubmitting(true);
    try {
      const submitData = {
        ...data,
        parentId: data.parentId || undefined,
        icon: data.icon || undefined,
        color: data.color || undefined,
        budgetLimit: data.budgetLimit || undefined,
      };

      if (initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: submitData,
        });
      } else {
        await createMutation.mutateAsync(submitData);
      }
    } catch {
      // Error handling is done in mutation callbacks
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData ? 'Edit Category' : 'Add Category'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    id="name"
                    placeholder="Category name"
                    {...field}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                )}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
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
              <Label htmlFor="parentId">Parent Category</Label>
              <Controller
                name="parentId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(value) => field.onChange(value === '_root_' ? '' : value)}
                    defaultValue={field.value || '_root_'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_root_">None (Root Category)</SelectItem>
                      {availableParentCategories.map((category: Category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon && `${category.icon} `}{category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.parentId && (
                <p className="text-sm text-destructive">{errors.parentId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Controller
                name="icon"
                control={control}
                render={({ field }) => (
                  <Input
                    id="icon"
                    placeholder="🏷️ (optional emoji)"
                    {...field}
                    className={errors.icon ? 'border-destructive' : ''}
                  />
                )}
              />
              {errors.icon && (
                <p className="text-sm text-destructive">{errors.icon.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Controller
                name="color"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      {...field}
                      className={`w-16 h-10 ${errors.color ? 'border-destructive' : ''}`}
                    />
                    <Input
                      placeholder="#6B7280"
                      value={field.value}
                      onChange={field.onChange}
                      className={errors.color ? 'border-destructive' : ''}
                    />
                  </div>
                )}
              />
              {errors.color && (
                <p className="text-sm text-destructive">{errors.color.message}</p>
              )}
            </div>

            {selectedType === TransactionType.EXPENSE && (
              <div className="space-y-2">
                <Label htmlFor="budgetLimit">Monthly Budget Limit (¥)</Label>
                <Controller
                  name="budgetLimit"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="budgetLimit"
                      type="number"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                      className={errors.budgetLimit ? 'border-destructive' : ''}
                    />
                  )}
                />
                {errors.budgetLimit && (
                  <p className="text-sm text-destructive">{errors.budgetLimit.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : initialData
                ? 'Update Category'
                : 'Create Category'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Helper function to detect circular references in category hierarchy
function isDescendantOfCategory(categoryId: string, ancestorId: string, categories: Category[]): boolean {
  if (!ancestorId) return false;
  
  const category = categories.find(c => c.id === categoryId);
  if (!category || !category.parentId) return false;
  
  if (category.parentId === ancestorId) return true;
  
  return isDescendantOfCategory(category.parentId, ancestorId, categories);
}