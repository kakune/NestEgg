'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiHelpers } from '@/lib/api-client';
import { Settlement } from '@/types/transaction';
import { Calculator, History, AlertCircle, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export default function SettlementsPage() {
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM format
  );
  
  const queryClient = useQueryClient();

  const {
    data: settlements = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Settlement[]>({
    queryKey: ['settlements'],
    queryFn: async () => {
      const response = await apiHelpers.getSettlements({ sort: '-month', limit: 12 });
      // Handle both direct array response and nested data structure
      const data = response.data;
      if (Array.isArray(data)) {
        return data as Settlement[];
      }
      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        return data.data as Settlement[];
      }
      return [] as Settlement[];
    },
  });

  const runSettlementMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      apiHelpers.runSettlement(year, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      setIsRunDialogOpen(false);
    },
    onError: (error) => {
      console.error('Failed to run settlement:', error);
    },
  });

  const finalizeSettlementMutation = useMutation({
    mutationFn: (settlementId: string) =>
      apiHelpers.finalizeSettlement(settlementId, { confirmed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      setSelectedSettlement(null);
    },
    onError: (error) => {
      console.error('Failed to finalize settlement:', error);
    },
  });

  const handleRunSettlement = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    runSettlementMutation.mutate({ year, month });
  };

  const handleViewSettlement = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
  };

  const handleFinalizeSettlement = (settlementId: string) => {
    finalizeSettlementMutation.mutate(settlementId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (month: string) => {
    return new Date(month + '-01').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Settlements</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load settlements</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {error instanceof Error ? error.message : 'An unknown error occurred'}
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Settlements</h1>
          <p className="text-muted-foreground">
            Calculate and manage monthly household expense settlements
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsRunDialogOpen(true)}
            className="gap-2"
            disabled={runSettlementMutation.isPending}
          >
            <Calculator className="h-4 w-4" />
            {runSettlementMutation.isPending ? 'Running...' : 'Run Settlement'}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Settlements</p>
                <p className="text-2xl font-bold">{settlements.length}</p>
              </div>
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Draft Settlements</p>
                <p className="text-2xl font-bold">
                  {settlements.filter((s: Settlement) => s.status === 'DRAFT').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Finalized Settlements</p>
                <p className="text-2xl font-bold">
                  {settlements.filter((s: Settlement) => s.status === 'FINALIZED').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settlements List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Settlements</CardTitle>
          <CardDescription>View and manage your settlement history</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-8">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No settlements yet</h3>
              <p className="text-muted-foreground mb-4">
                Run your first settlement calculation to get started
              </p>
              <Button onClick={() => setIsRunDialogOpen(true)}>
                Run Settlement
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((settlement: Settlement) => (
                <div
                  key={settlement.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{formatMonth(settlement.month)}</h3>
                      <Badge
                        variant={settlement.status === 'FINALIZED' ? 'default' : 'secondary'}
                      >
                        {settlement.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {formatCurrency(settlement.summary.total_household_expenses_yen)} household expenses
                      </span>
                      <span>{settlement.summary.participant_count} participants</span>
                      <span>{settlement.summary.transfer_count} transfers</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSettlement(settlement)}
                    >
                      View Details
                    </Button>
                    {settlement.status === 'DRAFT' && (
                      <Button
                        size="sm"
                        onClick={() => handleFinalizeSettlement(settlement.id)}
                        disabled={finalizeSettlementMutation.isPending}
                      >
                        {finalizeSettlementMutation.isPending ? 'Finalizing...' : 'Finalize'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run Settlement Dialog */}
      <Dialog open={isRunDialogOpen} onOpenChange={setIsRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Settlement Calculation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="month" className="block text-sm font-medium mb-2">
                Select Month
              </label>
              <input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRunDialogOpen(false)}
                disabled={runSettlementMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRunSettlement}
                disabled={runSettlementMutation.isPending}
              >
                {runSettlementMutation.isPending ? 'Running...' : 'Run Settlement'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settlement Details Dialog */}
      <Dialog
        open={!!selectedSettlement}
        onOpenChange={(open) => !open && setSelectedSettlement(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Settlement Details - {selectedSettlement && formatMonth(selectedSettlement.month)}
            </DialogTitle>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-6">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Household Expenses</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(selectedSettlement.summary.total_household_expenses_yen)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Personal Expenses</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(selectedSettlement.summary.total_personal_expenses_yen)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Participants</p>
                      <p className="text-lg font-semibold">
                        {selectedSettlement.summary.participant_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transfers</p>
                      <p className="text-lg font-semibold">
                        {selectedSettlement.summary.transfer_count}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transfer Lines */}
              {selectedSettlement.lines.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Required Transfers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedSettlement.lines.map((line) => (
                        <div
                          key={line.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">
                              {line.from_user.name} → {line.to_user.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {line.description}
                            </p>
                          </div>
                          <div className="text-lg font-semibold">
                            {formatCurrency(line.amount_yen)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* User Details */}
              <Card>
                <CardHeader>
                  <CardTitle>User Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedSettlement.user_details.map((detail) => (
                      <div key={detail.user.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3">{detail.user.name}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Income Allocation</p>
                            <p className="font-medium">
                              {formatCurrency(detail.income_allocation_yen)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Household Share</p>
                            <p className="font-medium">
                              {formatCurrency(detail.household_share_yen)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Household Paid</p>
                            <p className="font-medium">
                              {formatCurrency(detail.household_paid_yen)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Personal Net</p>
                            <p className="font-medium">
                              {formatCurrency(detail.personal_net_yen)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Final Balance</p>
                            <p className={`font-medium ${
                              detail.final_balance_yen >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(detail.final_balance_yen)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedSettlement(null)}
                >
                  Close
                </Button>
                {selectedSettlement.status === 'DRAFT' && (
                  <Button
                    onClick={() => handleFinalizeSettlement(selectedSettlement.id)}
                    disabled={finalizeSettlementMutation.isPending}
                  >
                    {finalizeSettlementMutation.isPending ? 'Finalizing...' : 'Finalize Settlement'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}