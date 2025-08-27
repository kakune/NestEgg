'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ActorsTable } from '@/components/tables/actors-table';
import { ActorForm } from '@/components/forms/actor-form';
import { Actor } from '@/types/transaction';

export default function ActorsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActor, setEditingActor] = useState<Actor | null>(null);
  const queryClient = useQueryClient();

  const handleCreateActor = () => {
    setEditingActor(null);
    setIsFormOpen(true);
  };

  const handleEditActor = (actor: Actor) => {
    setEditingActor(actor);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingActor(null);
    queryClient.invalidateQueries({ queryKey: ['actors'] });
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingActor(null);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Actors</h1>
        <p className="text-muted-foreground">
          Manage household members (users) and payment methods (instruments) who participate in transactions.
        </p>
      </div>

      <ActorsTable
        onEditActor={handleEditActor}
        onCreateActor={handleCreateActor}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <ActorForm
            initialData={editingActor}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}