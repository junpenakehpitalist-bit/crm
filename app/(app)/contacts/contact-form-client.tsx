'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layouts/page-header';
import { Users, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface ContactFormProps {
  initialData?: any;
  contactId?: string;
}

export function ContactFormClient({ initialData, contactId }: ContactFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    firstName: initialData?.firstName ?? '',
    lastName: initialData?.lastName ?? '',
    email: initialData?.email ?? '',
    phone: initialData?.phone ?? '',
    jobTitle: initialData?.jobTitle ?? '',
    address: initialData?.address ?? '',
    lifecycleStage: initialData?.lifecycleStage ?? 'LEAD',
    notes: initialData?.notes ?? '',
    companyId: initialData?.companyId ?? '',
    ownerId: initialData?.ownerId ?? '',
    tags: initialData?.tags?.join(', ') ?? '',
  });

  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(d => setCompanies(d ?? [])).catch(() => {});
    fetch('/api/settings/users').then(r => r.json()).then(d => setUsers(d ?? [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        companyId: form.companyId || null,
        ownerId: form.ownerId || null,
      };
      const url = contactId ? `/api/contacts/${contactId}` : '/api/contacts';
      const method = contactId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(contactId ? 'Contact updated' : 'Contact created');
      router.push('/contacts');
      router.refresh();
    } catch {
      toast.error('Failed to save contact');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={contactId ? 'Edit Contact' : 'New Contact'}
        description={contactId ? 'Update contact information' : 'Add a new contact to your CRM'}
        actions={
          <Link href="/contacts">
            <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Contact Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('firstName', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('lastName', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('phone', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={form.jobTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('jobTitle', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Lifecycle Stage</Label>
                <Select value={form.lifecycleStage} onValueChange={(v: string) => updateField('lifecycleStage', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="PROSPECT">Prospect</SelectItem>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="CHURNED">Churned</SelectItem>
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
                  <SelectContent>
                    {users.map((u: any) => <SelectItem key={u?.id} value={u?.id}>{u?.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('tags', e.target.value)} placeholder="e.g. VIP, Enterprise" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('notes', e.target.value)} rows={4} />
            </div>
            <Button type="submit" loading={loading}>
              <Save className="h-4 w-4 mr-2" />
              {contactId ? 'Update Contact' : 'Create Contact'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
