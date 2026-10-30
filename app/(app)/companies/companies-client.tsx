'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layouts/page-header';
import { Building2, Plus, Search, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeNumber } from '@/components/safe-format';

export function CompaniesClient() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCompanies = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/companies?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setCompanies(d ?? []))
      .catch(() => toast.error('Failed to load companies'))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this company?')) return;
    try {
      await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      toast.success('Company deleted');
      fetchCompanies();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Manage company records and accounts"
        actions={<Link href="/companies/new"><Button><Plus className="h-4 w-4 mr-2" />Add Company</Button></Link>}
      />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search companies..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Deals</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_: unknown, i: number) => (
                  <TableRow key={i}>{Array.from({ length: 7 }).map((_: unknown, j: number) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                ))
              ) : (companies?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground"><Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />No companies found</TableCell></TableRow>
              ) : (
                companies.map((c: any) => (
                  <TableRow key={c?.id} className="hover:bg-muted/50">
                    <TableCell><Link href={`/companies/${c?.id}`} className="font-medium text-primary hover:underline">{c?.name}</Link></TableCell>
                    <TableCell className="text-muted-foreground">{c?.industry ?? '-'}</TableCell>
                    <TableCell>{c?._count?.contacts ?? 0}</TableCell>
                    <TableCell>{c?._count?.deals ?? 0}</TableCell>
                    <TableCell className="font-mono">{c?.annualRevenue ? <SafeNumber value={c.annualRevenue} currency="USD" /> : '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{c?.owner?.name ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/companies/${c?.id}`}><Button variant="ghost" size="icon-sm"><Edit className="h-4 w-4" /></Button></Link>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c?.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
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
