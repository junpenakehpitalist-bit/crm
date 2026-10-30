'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layouts/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreditCard, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeDate, SafeNumber } from '@/components/safe-format';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function TransactionsClient() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [form, setForm] = useState({ amount: '', date: '', type: 'PAYMENT', status: 'PENDING', description: '', contactId: '', dealId: '' });
  const [saving, setSaving] = useState(false);

  const fetchTransactions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/transactions?${params.toString()}`)
      .then(r => r.json())
      .then(d => setTransactions(d ?? []))
      .catch(() => toast.error('Failed to load transactions'))
      .finally(() => setLoading(false));
  }, [typeFilter, statusFilter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => {
    fetch('/api/contacts').then(r => r.json()).then(d => setContacts(d ?? [])).catch(() => {});
    fetch('/api/deals').then(r => r.json()).then(d => setDeals(d ?? [])).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contactId: form.contactId || null, dealId: form.dealId || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Transaction created');
      setDialogOpen(false);
      setForm({ amount: '', date: '', type: 'PAYMENT', status: 'PENDING', description: '', contactId: '', dealId: '' });
      fetchTransactions();
    } catch { toast.error('Failed to create transaction'); }
    finally { setSaving(false); }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Track payments, invoices, and refunds"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Transaction</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Amount ($) *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('amount', e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('date', e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v: string) => updateField('type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="PAYMENT">Payment</SelectItem><SelectItem value="INVOICE">Invoice</SelectItem><SelectItem value="REFUND">Refund</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: string) => updateField('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="FAILED">Failed</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Select value={form.contactId} onValueChange={(v: string) => updateField('contactId', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">None</SelectItem>{contacts.map((c: any) => <SelectItem key={c?.id} value={c?.id}>{c?.firstName} {c?.lastName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Deal</Label>
                    <Select value={form.dealId} onValueChange={(v: string) => updateField('dealId', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">None</SelectItem>{deals.map((d: any) => <SelectItem key={d?.id} value={d?.id}>{d?.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('description', e.target.value)} /></div>
                <Button type="submit" className="w-full" loading={saving}>Create Transaction</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="PAYMENT">Payment</SelectItem><SelectItem value="INVOICE">Invoice</SelectItem><SelectItem value="REFUND">Refund</SelectItem></SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="FAILED">Failed</SelectItem></SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_: unknown, i: number) => (
                  <TableRow key={i}>{Array.from({ length: 7 }).map((_: unknown, j: number) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                ))
              ) : (transactions?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground"><CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />No transactions found</TableCell></TableRow>
              ) : (
                transactions.map((t: any) => (
                  <TableRow key={t?.id}>
                    <TableCell className="font-mono font-medium"><SafeNumber value={t?.amount ?? 0} currency="USD" /></TableCell>
                    <TableCell><Badge variant="outline">{t?.type}</Badge></TableCell>
                    <TableCell><Badge className={statusColors[t?.status] ?? ''}>{t?.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{t?.contact ? `${t.contact.firstName ?? ''} ${t.contact.lastName ?? ''}` : '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{t?.deal?.name ?? '-'}</TableCell>
                    <TableCell><SafeDate date={t?.date} options={{ dateStyle: 'medium' }} /></TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{t?.description ?? '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
