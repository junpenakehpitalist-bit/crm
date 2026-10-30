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
import { Building2, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

interface CompanyFormProps {
  initialData?: any;
  companyId?: string;
}

export function CompanyFormClient({ initialData, companyId }: CompanyFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    industry: initialData?.industry ?? '',
    website: initialData?.website ?? '',
    phone: initialData?.phone ?? '',
    address: initialData?.address ?? '',
    description: initialData?.description ?? '',
    employeeCount: initialData?.employeeCount?.toString() ?? '',
    annualRevenue: initialData?.annualRevenue?.toString() ?? '',
    ownerId: initialData?.ownerId ?? '',
  });

  useEffect(() => {
    fetch('/api/settings/users').then(r => r.json()).then(d => setUsers(d ?? [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = companyId ? `/api/companies/${companyId}` : '/api/companies';
      const method = companyId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ownerId: form.ownerId || null }),
      });
      if (!res.ok) throw new Error();
      toast.success(companyId ? 'Company updated' : 'Company created');
      router.push('/companies');
    } catch { toast.error('Failed to save company'); }
    finally { setLoading(false); }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={companyId ? 'Edit Company' : 'New Company'}
        description={companyId ? 'Update company details' : 'Add a new company'}
        actions={<Link href="/companies"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>}
      />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Company Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Company Name *</Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('name', e.target.value)} required /></div>
              <div className="space-y-2"><Label>Industry</Label><Input value={form.industry} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('industry', e.target.value)} /></div>
              <div className="space-y-2"><Label>Website</Label><Input value={form.website} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('website', e.target.value)} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('phone', e.target.value)} /></div>
              <div className="space-y-2"><Label>Employees</Label><Input type="number" value={form.employeeCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('employeeCount', e.target.value)} /></div>
              <div className="space-y-2"><Label>Annual Revenue ($)</Label><Input type="number" value={form.annualRevenue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('annualRevenue', e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={form.ownerId} onValueChange={(v: string) => updateField('ownerId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>{users.map((u: any) => <SelectItem key={u?.id} value={u?.id}>{u?.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('address', e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('description', e.target.value)} rows={3} /></div>
            <Button type="submit" loading={loading}><Save className="h-4 w-4 mr-2" />{companyId ? 'Update' : 'Create'} Company</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
