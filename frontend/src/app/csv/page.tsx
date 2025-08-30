'use client';

import { useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiHelpers } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ParsedCsvData {
  data: string[][];
  headers: string[];
}

interface FieldMapping {
  date: string;
  amount: string;
  type: string;
  category: string;
  actor: string;
  notes?: string;
  tags?: string;
}

const defaultFieldMapping: FieldMapping = {
  date: '',
  amount: '',
  type: '',
  category: '',
  actor: '',
  notes: '',
  tags: '',
};

const requiredFields = ['date', 'amount', 'type', 'category', 'actor'] as const;

export default function CsvPage() {
  const router = useRouter();
  const [, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCsvData | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>(defaultFieldMapping);
  const [previewData, setPreviewData] = useState<unknown[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const parseCsvFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const data = lines.slice(1).map(line => {
        // Handle CSV with quoted values containing commas
        const regex = /(".*?"|[^,]+)(?=\s*,|\s*$)/g;
        const matches = line.match(regex) || [];
        return matches.map(m => m.trim().replace(/^"|"$/g, ''));
      });

      setParsedData({ headers, data: [headers, ...data] });
      
      // Auto-detect field mappings based on common header names
      const newMapping = { ...defaultFieldMapping };
      headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('date')) {
          newMapping.date = index.toString();
        } else if (lowerHeader.includes('amount')) {
          newMapping.amount = index.toString();
        } else if (lowerHeader.includes('type')) {
          newMapping.type = index.toString();
        } else if (lowerHeader.includes('category')) {
          newMapping.category = index.toString();
        } else if (lowerHeader.includes('actor') || lowerHeader.includes('user')) {
          newMapping.actor = index.toString();
        } else if (lowerHeader.includes('note') || lowerHeader.includes('description')) {
          newMapping.notes = index.toString();
        } else if (lowerHeader.includes('tag')) {
          newMapping.tags = index.toString();
        }
      });
      setFieldMapping(newMapping);
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      parseCsvFile(selectedFile);
    } else {
      toast.error('Please select a valid CSV file');
    }
  }, [parseCsvFile]);

  const handleFieldMappingChange = useCallback((field: keyof FieldMapping, value: string) => {
    setFieldMapping(prev => ({ ...prev, [field]: value }));
  }, []);

  const isValidMapping = useCallback(() => {
    return requiredFields.every(field => fieldMapping[field]);
  }, [fieldMapping]);

  const handlePreview = useCallback(async () => {
    if (!parsedData || !isValidMapping()) {
      toast.error('Please map all required fields');
      return;
    }

    setIsUploading(true);
    try {
      const response = await apiHelpers.previewTransactionsImport({
        data: parsedData.data,
        mapping: Object.entries(fieldMapping).reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>),
      });
      setPreviewData(response.data);
      toast.success('Preview generated successfully');
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to generate preview');
    } finally {
      setIsUploading(false);
    }
  }, [parsedData, fieldMapping, isValidMapping]);

  const handleImport = useCallback(async () => {
    if (!parsedData || !isValidMapping()) {
      toast.error('Please map all required fields');
      return;
    }

    setIsImporting(true);
    try {
      const response = await apiHelpers.importTransactions({
        data: parsedData.data,
        mapping: Object.entries(fieldMapping).reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>),
      });
      toast.success(`Successfully imported ${response.data.imported} transactions`);
      router.push('/transactions');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, fieldMapping, router, isValidMapping]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const response = await apiHelpers.exportTransactions();
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Transactions exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export transactions');
    } finally {
      setIsExporting(false);
    }
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">CSV Import/Export</h1>
          <p className="text-muted-foreground">Import transactions from CSV or export your data</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Import Section */}
          <Card>
            <CardHeader>
              <CardTitle>Import Transactions</CardTitle>
              <CardDescription>Upload a CSV file to import transactions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isUploading || isImporting}
                />
              </div>

              {parsedData && (
                <>
                  <div className="space-y-2">
                    <Label>Field Mapping</Label>
                    <div className="text-sm text-muted-foreground">
                      Map CSV columns to transaction fields
                    </div>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(fieldMapping).map(([field, value]) => (
                      <div key={field} className="flex items-center gap-3">
                        <Label className="w-24 text-sm">
                          {field.charAt(0).toUpperCase() + field.slice(1)}
                          {requiredFields.includes(field as typeof requiredFields[number]) && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </Label>
                        <Select
                          value={value}
                          onValueChange={(val) => handleFieldMappingChange(field as keyof FieldMapping, val)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {parsedData.headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handlePreview}
                      disabled={!isValidMapping() || isUploading || isImporting}
                      variant="outline"
                    >
                      {isUploading ? 'Generating...' : 'Preview'}
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={!isValidMapping() || previewData.length === 0 || isImporting}
                    >
                      {isImporting ? 'Importing...' : 'Import'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Export Section */}
          <Card>
            <CardHeader>
              <CardTitle>Export Transactions</CardTitle>
              <CardDescription>Download your transactions as CSV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Export all your transactions to a CSV file for backup or analysis in external tools.
              </div>
              <Button onClick={handleExport} disabled={isExporting} className="w-full">
                {isExporting ? 'Exporting...' : 'Export All Transactions'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Preview Table */}
        {previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Import Preview</CardTitle>
              <CardDescription>Review the first 10 transactions to be imported</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(previewData as Array<{
                      date: string;
                      amount: number;
                      type: string;
                      category: string;
                      actor: string;
                      notes?: string;
                      status: 'valid' | 'duplicate' | 'error';
                      error?: string;
                    }>).slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>¥{row.amount.toLocaleString()}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>{row.actor}</TableCell>
                        <TableCell>{row.notes || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === 'valid' ? 'default' :
                              row.status === 'duplicate' ? 'secondary' : 'destructive'
                            }
                          >
                            {row.status}
                          </Badge>
                          {row.error && (
                            <span className="text-xs text-red-500 block">{row.error}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {previewData.length > 10 && (
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  And {previewData.length - 10} more transactions...
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}