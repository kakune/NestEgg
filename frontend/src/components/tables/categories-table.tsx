'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Category, TransactionType } from '@/types/transaction';
import { apiHelpers } from '@/lib/api-client';
import { toast } from 'sonner';
import { MoreHorizontal, ChevronRight, ChevronDown, Edit, Trash2, Plus } from 'lucide-react';

interface CategoriesTableProps {
  onEditCategory: (category: Category) => void;
  onCreateCategory: () => void;
}

interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  level: number;
}

export function CategoriesTable({ onEditCategory, onCreateCategory }: CategoriesTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiHelpers.getCategories();
      return response.data.data || response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiHelpers.deleteCategory,
    onSuccess: () => {
      toast.success('Category deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to delete category';
      toast.error(errorMessage || 'Failed to delete category');
    },
  });

  const handleDeleteCategory = (category: Category) => {
    if (confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(category.id);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Build category tree
  const buildCategoryTree = (cats: Category[]): CategoryTreeNode[] => {
    const categoryMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    // Create nodes for all categories
    cats.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [], level: 0 });
    });

    // Build tree structure
    cats.forEach(cat => {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!;
        parent.children.push(node);
        node.level = parent.level + 1;
      } else {
        roots.push(node);
      }
    });

    // Sort children alphabetically
    const sortChildren = (nodes: CategoryTreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach(node => sortChildren(node.children));
    };
    sortChildren(roots);

    return roots;
  };

  // Flatten tree for display
  const flattenTree = (nodes: CategoryTreeNode[]): CategoryTreeNode[] => {
    const result: CategoryTreeNode[] = [];
    
    const traverse = (node: CategoryTreeNode) => {
      result.push(node);
      if (expandedCategories.has(node.id) && node.children.length > 0) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return result;
  };

  const categoryTree = buildCategoryTree(categories);
  const incomeCategories = flattenTree(categoryTree.filter(cat => cat.type === TransactionType.INCOME));
  const expenseCategories = flattenTree(categoryTree.filter(cat => cat.type === TransactionType.EXPENSE));

  const renderCategoryRow = (category: CategoryTreeNode) => (
    <TableRow key={category.id}>
      <TableCell>
        <div className="flex items-center" style={{ paddingLeft: `${category.level * 24}px` }}>
          {category.children.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpanded(category.id)}
              className="p-0 h-6 w-6 mr-2"
            >
              {expandedCategories.has(category.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-6 mr-2" />
          )}
          <div className="flex items-center gap-2">
            {category.icon && (
              <span className="text-lg">{category.icon}</span>
            )}
            <span>{category.name}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {category.color && (
          <div 
            className="w-6 h-6 rounded border" 
            style={{ backgroundColor: category.color }}
          />
        )}
      </TableCell>
      <TableCell>
        {category.budgetLimit && (
          <span>¥{category.budgetLimit.toLocaleString()}</span>
        )}
      </TableCell>
      <TableCell>
        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
          category.isActive 
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {category.isActive ? 'Active' : 'Inactive'}
        </span>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditCategory(category)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDeleteCategory(category)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p>Loading categories...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-destructive">Error loading categories</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Income Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">Income Categories</CardTitle>
          <Button onClick={onCreateCategory} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </CardHeader>
        <CardContent>
          {incomeCategories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Budget Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeCategories.map(renderCategoryRow)}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No income categories found. Create your first income category to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Expense Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">Expense Categories</CardTitle>
          <Button onClick={onCreateCategory} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </CardHeader>
        <CardContent>
          {expenseCategories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Budget Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseCategories.map(renderCategoryRow)}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No expense categories found. Create your first expense category to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}