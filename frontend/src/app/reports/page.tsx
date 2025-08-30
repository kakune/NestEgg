'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiHelpers } from '@/lib/api-client';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import { format, endOfMonth, subMonths } from 'date-fns';
import { Transaction, TransactionType, Category, Actor } from '@/types/transaction';
import { toast } from 'sonner';

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  net: number;
}

interface CategoryData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface ActorData {
  name: string;
  paid: number;
  shouldPay: number;
  balance: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B'];

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [transactionsRes, categoriesRes, actorsRes] = await Promise.all([
          apiHelpers.getTransactions(),
          apiHelpers.getCategories(),
          apiHelpers.getActors(),
        ]);
        
        setTransactions(transactionsRes.data.data || transactionsRes.data);
        setCategories(categoriesRes.data.data || categoriesRes.data);
        setActors(actorsRes.data.data || actorsRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load report data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate monthly trend data
  const monthlyTrendData = useMemo(() => {
    const monthlyMap = new Map<string, MonthlyData>();
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthKey = format(monthDate, 'yyyy-MM');
      monthlyMap.set(monthKey, {
        month: format(monthDate, 'MMM yyyy'),
        income: 0,
        expense: 0,
        net: 0,
      });
    }

    // Aggregate transaction data
    transactions.forEach(transaction => {
      const monthKey = transaction.date.substring(0, 7); // Get YYYY-MM
      const existing = monthlyMap.get(monthKey);
      
      if (existing) {
        if (transaction.type === TransactionType.INCOME) {
          existing.income += transaction.amount;
        } else {
          existing.expense += transaction.amount;
        }
        existing.net = existing.income - existing.expense;
      }
    });

    return Array.from(monthlyMap.values());
  }, [transactions]);

  // Calculate category breakdown for selected month
  const categoryBreakdownData = useMemo(() => {
    const monthTransactions = transactions.filter(t => 
      t.date.startsWith(selectedMonth) && t.type === TransactionType.EXPENSE
    );

    const categoryMap = new Map<string, number>();
    let total = 0;

    monthTransactions.forEach(transaction => {
      const category = categories.find(c => c.id === transaction.categoryId);
      const categoryName = category?.name || 'Unknown';
      const current = categoryMap.get(categoryName) || 0;
      categoryMap.set(categoryName, current + transaction.amount);
      total += transaction.amount;
    });

    const data: CategoryData[] = Array.from(categoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories

    return data;
  }, [transactions, categories, selectedMonth]);

  // Calculate actor balance data
  const actorBalanceData = useMemo(() => {
    const monthTransactions = transactions.filter(t => 
      t.date.startsWith(selectedMonth)
    );

    const actorMap = new Map<string, ActorData>();

    actors.forEach(actor => {
      actorMap.set(actor.id, {
        name: actor.name,
        paid: 0,
        shouldPay: 0,
        balance: 0,
      });
    });

    monthTransactions.forEach(transaction => {
      const actorData = actorMap.get(transaction.actorId);
      if (actorData) {
        if (transaction.type === TransactionType.EXPENSE) {
          actorData.paid += transaction.amount;
          if (transaction.shouldPay) {
            actorData.shouldPay += transaction.amount;
          }
        }
      }
    });

    // Calculate balances
    actorMap.forEach(data => {
      data.balance = data.paid - data.shouldPay;
    });

    return Array.from(actorMap.values())
      .filter(a => a.paid > 0 || a.shouldPay > 0);
  }, [transactions, actors, selectedMonth]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const monthTransactions = transactions.filter(t => 
      t.date.startsWith(selectedMonth)
    );

    const income = monthTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = monthTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    const avgTransaction = monthTransactions.length > 0 
      ? (income + expense) / monthTransactions.length 
      : 0;

    return {
      totalIncome: income,
      totalExpense: expense,
      netIncome: income - expense,
      transactionCount: monthTransactions.length,
      avgTransaction,
      savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
    };
  }, [transactions, selectedMonth]);

  // Generate month options for selector
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  const exportReport = async () => {
    try {
      const response = await apiHelpers.exportTransactions({
        startDate: `${selectedMonth}-01`,
        endDate: format(endOfMonth(new Date(`${selectedMonth}-01`)), 'yyyy-MM-dd'),
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${selectedMonth}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-lg text-muted-foreground">Loading report data...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Visualize your financial data and trends</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportReport} variant="outline">
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              <Badge variant="default">Income</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{summaryStats.totalIncome.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {summaryStats.transactionCount} transactions
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Badge variant="destructive">Expense</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{summaryStats.totalExpense.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Avg: ¥{Math.round(summaryStats.avgTransaction).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Income</CardTitle>
              <Badge variant={summaryStats.netIncome >= 0 ? 'default' : 'destructive'}>
                {summaryStats.netIncome >= 0 ? 'Surplus' : 'Deficit'}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ¥{Math.abs(summaryStats.netIncome).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {summaryStats.netIncome >= 0 ? 'Saved this month' : 'Over budget'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
              <Badge variant="secondary">Rate</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.savingsRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Of total income
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Monthly Trend Chart */}
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Monthly Trend</CardTitle>
              <CardDescription>Income vs Expenses over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#10b981" 
                    name="Income"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expense" 
                    stroke="#ef4444" 
                    name="Expenses"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke="#3b82f6" 
                    name="Net"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>Top expense categories for {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name} (${entry.percentage.toFixed(1)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Actor Balance */}
          <Card>
            <CardHeader>
              <CardTitle>Actor Balances</CardTitle>
              <CardDescription>Who paid vs who should pay</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={actorBalanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="paid" fill="#10b981" name="Paid" />
                  <Bar dataKey="shouldPay" fill="#f59e0b" name="Should Pay" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Category Table */}
        <Card>
          <CardHeader>
            <CardTitle>Category Details</CardTitle>
            <CardDescription>Breakdown by category for {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryBreakdownData.map((category) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {category.percentage.toFixed(1)}%
                    </span>
                    <span className="font-mono">
                      ¥{category.value.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}