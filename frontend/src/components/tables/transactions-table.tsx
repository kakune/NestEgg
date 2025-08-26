'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit,
  Trash2,
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Calendar,
} from 'lucide-react';
import { Transaction, TransactionType } from '@/types/transaction';
import { formatCurrency, formatDate } from '@/lib/utils';

interface TransactionsTableProps {
  transactions: Transaction[];
  totalCount: number;
  hasMore: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
  onAdd: () => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
}

export function TransactionsTable({
  transactions,
  totalCount,
  hasMore,
  onEdit,
  onDelete,
  onAdd,
  onLoadMore,
  isLoading = false,
}: TransactionsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransactions = transactions.filter((transaction) =>
    transaction.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.actor?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTransactionTypeIcon = (type: TransactionType) => {
    return type === TransactionType.INCOME ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  const getTransactionTypeColor = (type: TransactionType) => {
    return type === TransactionType.INCOME ? 'text-green-600' : 'text-red-600';
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Transactions</h2>
          <Button onClick={onAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>
        <div className="text-center py-8">Loading transactions...</div>
      </div>
    );
  }

  if (transactions.length === 0 && !isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Transactions</h2>
          <Button onClick={onAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>
        <div className="text-center py-8 space-y-4">
          <p className="text-muted-foreground">No transactions found</p>
          <Button onClick={onAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add First Transaction
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {totalCount} transaction{totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Date</span>
                </div>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-mono text-sm">
                  {formatDate(transaction.date)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {getTransactionTypeIcon(transaction.type)}
                    <span className={getTransactionTypeColor(transaction.type)}>
                      {transaction.type}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-mono">
                  <span className={getTransactionTypeColor(transaction.type)}>
                    {transaction.type === TransactionType.INCOME ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {transaction.category?.icon && (
                      <span className="text-lg">{transaction.category.icon}</span>
                    )}
                    <span>{transaction.category?.name || 'Unknown'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {transaction.actor?.name || 'Unknown'}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {transaction.notes || '-'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(transaction)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(transaction.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="text-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}