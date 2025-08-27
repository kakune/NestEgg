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
import { Actor, ActorKind } from '@/types/transaction';
import { User } from '@/types/user';
import { apiHelpers } from '@/lib/api-client';
import { toast } from 'sonner';

const actorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  kind: z.nativeEnum(ActorKind),
  userId: z.string().optional(),
});

type ActorFormData = z.infer<typeof actorSchema>;

interface ActorFormProps {
  initialData?: Actor | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ActorForm({
  initialData,
  onSuccess,
  onCancel,
}: ActorFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ActorFormData>({
    resolver: zodResolver(actorSchema),
    defaultValues: {
      name: initialData?.name || '',
      kind: initialData?.kind || ActorKind.INSTRUMENT,
      userId: initialData?.userId || '',
    },
  });

  const selectedKind = watch('kind');

  // Fetch users for USER actor type
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiHelpers.getUsers();
      return response.data.data || response.data;
    },
    enabled: selectedKind === ActorKind.USER,
  });

  const createMutation = useMutation({
    mutationFn: apiHelpers.createActor,
    onSuccess: () => {
      toast.success('Actor created successfully');
      onSuccess();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to create actor';
      toast.error(errorMessage || 'Failed to create actor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ActorFormData> }) =>
      apiHelpers.updateActor(id, data),
    onSuccess: () => {
      toast.success('Actor updated successfully');
      onSuccess();
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to update actor';
      toast.error(errorMessage || 'Failed to update actor');
    },
  });

  const onSubmit = async (data: ActorFormData) => {
    setIsSubmitting(true);
    try {
      const submitData = {
        ...data,
        userId: data.kind === ActorKind.USER ? data.userId : undefined,
      };

      if (initialData) {
        // For updates, we only send name and isActive (kind cannot be changed)
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: {
            name: submitData.name,
            // isActive is handled separately in the table component
          },
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
          {initialData ? 'Edit Actor' : 'Add Actor'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input
                  id="name"
                  placeholder="Actor name"
                  {...field}
                  className={errors.name ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Enter a descriptive name for the actor (e.g., &quot;John&apos;s Wallet&quot;, &quot;Company Credit Card&quot;)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kind">Type</Label>
            <Controller
              name="kind"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={!!initialData} // Cannot change kind for existing actors
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select actor type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ActorKind.USER}>
                      User - Represents a household member
                    </SelectItem>
                    <SelectItem value={ActorKind.INSTRUMENT}>
                      Instrument - Card, wallet, or payment method
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.kind && (
              <p className="text-sm text-destructive">{errors.kind.message}</p>
            )}
            {initialData && (
              <p className="text-sm text-muted-foreground">
                Actor type cannot be changed after creation
              </p>
            )}
            {!initialData && (
              <p className="text-sm text-muted-foreground">
                User actors represent household members, while instrument actors represent payment methods
              </p>
            )}
          </div>

          {selectedKind === ActorKind.USER && (
            <div className="space-y-2">
              <Label htmlFor="userId">Associated User</Label>
              <Controller
                name="userId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!!initialData} // Cannot change user association for existing actors
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user: User) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.userId && (
                <p className="text-sm text-destructive">{errors.userId.message}</p>
              )}
              {initialData && (
                <p className="text-sm text-muted-foreground">
                  User association cannot be changed after creation
                </p>
              )}
            </div>
          )}

          {initialData && (
            <div className="rounded-lg border bg-muted p-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Actor Information</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Type:</strong> {initialData.kind}</p>
                  <p><strong>Status:</strong> {initialData.isActive ? 'Active' : 'Inactive'}</p>
                  {initialData.user && (
                    <p><strong>Associated User:</strong> {initialData.user.name}</p>
                  )}
                  <p><strong>Created:</strong> {new Date(initialData.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
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
                ? 'Update Actor'
                : 'Create Actor'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}