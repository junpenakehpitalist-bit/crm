'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layouts/page-header';
import { Handshake, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

const STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];

export function DealFormClient({ initialData, dealId }: { initialData?: any; dealId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    value: initialData?.value?.toString() ?? '',
    stage: initialData?.stage ?? 'LEAD',
    closeDate: initialData?.closeDate ? new Date(initialData.closeDate).toISOString().split('T')[0] : '',
    probability: initialData?.probability?.toString() ?? '0',
    description: initialData?.description ?? '',
    contactId: initialData?.contactId ?? '',
    companyId: initialData?.companyId ?? '',
    ownerId: initialData?.ownerId ?? '',
  });

  useEffect(() => {
    fetch('/api/contacts').then(r => r.json()).then(d => setContacts(d ?? [])).catch(() => {});
    fetch('/api/companies').then(r => r.json()).then(d => setCompanies(d ?? [])).catch(() => {});
    fetch('/api/settings/users').then(r => r.json()).then(d => setUsers(d ?? [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = dealId ? `/api/deals/${dealId}` : '/api/deals';
      const method = dealId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contactId: form.contactId || null, companyId: form.companyId || null, ownerId: form.ownerId || null }),
      });
      if (!res.ok) throw new Error();
      toast.success(dealId ? 'Deal updated' : 'Deal created');
      router.push('/deals');
    } catch { toast.error('Failed to save deal'); }
    finally { setLoading(false); }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={dealId ? 'Edit Deal' : 'New Deal'}
        description={dealId ? 'Update deal information' : 'Create a new deal'}
        actions={<Link href="/deals"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>}
      />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Handshake className="h-5 w-5 text-primary" />Deal Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Deal Name *</Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('name', e.target.value)} required /></div>
              <div className="space-y-2"><Label>Value ($)</Label><Input type="number" value={form.value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('value', e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v: string) => updateField('stage', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s: string) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Close Date</Label><Input type="date" value={form.closeDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('closeDate', e.target.value)} /></div>
              <div className="space-y-2"><Label>Probability (%)</Label><Input type="number" min="0" max="100" value={form.probability} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('probability', e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Contact</Label>
                <Select value={form.contactId} onValueChange={(v: string) => updateField('contactId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((c: any) => <SelectItem key={c?.id} value={c?.id}>{c?.firstName} {c?.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={form.companyId} onValueChange={(v: string) => updateField('companyId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {companies.map((c: any) => <SelectItem key={c?.id} value={c?.id}>{c?.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={form.ownerId} onValueChange={(v: string) => updateField('ownerId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>{users.map((u: any) => <SelectItem key={u?.id} value={u?.id}>{u?.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('description', e.target.value)} rows={3} /></div>
            <Button type="submit" loading={loading}><Save className="h-4 w-4 mr-2" />{dealId ? 'Update' : 'Create'} Deal</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
