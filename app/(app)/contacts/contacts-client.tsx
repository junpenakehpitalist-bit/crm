'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { Users, Plus, Search, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const stageColors: Record<string, string> = {
  LEAD: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PROSPECT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  CUSTOMER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CHURNED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function ContactsClient() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const fetchContacts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stageFilter) params.set('stage', stageFilter);
    fetch(`/api/contacts?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setContacts(d ?? []))
      .catch(() => toast.error('Failed to load contacts'))
      .finally(() => setLoading(false));
  }, [search, stageFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      toast.success('Contact deleted');
      fetchContacts();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage all your contacts and leads"
        actions={
          <Link href="/contacts/new">
            <Button><Plus className="h-4 w-4 mr-2" />Add Contact</Button>
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="LEAD">Lead</SelectItem>
            <SelectItem value="PROSPECT">Prospect</SelectItem>
            <SelectItem value="CUSTOMER">Customer</SelectItem>
            <SelectItem value="CHURNED">Churned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_: unknown, i: number) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_: unknown, j: number) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (contacts?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No contacts found
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((c: any) => (
                  <TableRow key={c?.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Link href={`/contacts/${c?.id}`} className="font-medium text-primary hover:underline">
                        {c?.firstName ?? ''} {c?.lastName ?? ''}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c?.email ?? '-'}</TableCell>
                    <TableCell>{c?.company?.name ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={stageColors[c?.lifecycleStage] ?? ''}>
                        {c?.lifecycleStage ?? '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c?.owner?.name ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/contacts/${c?.id}`}>
                          <Button variant="ghost" size="icon-sm"><Edit className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c?.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
