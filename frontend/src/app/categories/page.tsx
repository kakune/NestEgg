'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CategoriesTable } from '@/components/tables/categories-table';
import { CategoryForm } from '@/components/forms/category-form';
import { Category } from '@/types/transaction';

export default function CategoriesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const queryClient = useQueryClient();

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setIsFormOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          Manage your income and expense categories with hierarchical organization.
        </p>
      </div>

      <CategoriesTable
        onEditCategory={handleEditCategory}
        onCreateCategory={handleCreateCategory}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <CategoryForm
            initialData={editingCategory}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}