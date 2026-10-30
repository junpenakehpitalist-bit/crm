'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layouts/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, Globe, Phone, MapPin, Briefcase, Users, Handshake } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeNumber } from '@/components/safe-format';
import { CompanyFormClient } from '../company-form-client';

export function CompanyDetailClient({ companyId }: { companyId: string }) {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/companies/${companyId}`)
      .then(r => r.json())
      .then(d => setCompany(d))
      .catch(() => toast.error('Failed to load company'))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="space-y-4">{[1,2,3].map((i: number) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (!company) return <p className="text-muted-foreground">Company not found</p>;
  if (editing) return <CompanyFormClient initialData={company} companyId={companyId} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={company?.name ?? 'Company'}
        description={company?.industry ?? ''}
        actions={
          <div className="flex gap-2">
            <Link href="/companies"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
            <Button onClick={() => setEditing(true)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-lg">Company Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {company?.website && <div className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-muted-foreground" /><a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.website}</a></div>}
            {company?.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span suppressHydrationWarning>{company.phone}</span></div>}
            {company?.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{company.address}</div>}
            {company?.owner && <div className="flex items-center gap-2 text-sm"><Briefcase className="h-4 w-4 text-muted-foreground" />Owner: {company.owner.name}</div>}
            {company?.employeeCount && <p className="text-sm">Employees: <SafeNumber value={company.employeeCount} /></p>}
            {company?.annualRevenue && <p className="text-sm">Revenue: <SafeNumber value={company.annualRevenue} currency="USD" /></p>}
            {company?.description && <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">{company.description}</div>}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <Tabs defaultValue="contacts">
            <TabsList>
              <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-1" />Contacts</TabsTrigger>
              <TabsTrigger value="deals"><Handshake className="h-4 w-4 mr-1" />Deals</TabsTrigger>
            </TabsList>
            <TabsContent value="contacts">
              <Card><CardContent className="pt-6">
                {(company?.contacts?.length ?? 0) === 0 ? <p className="text-muted-foreground text-sm">No contacts</p> : (
                  <div className="space-y-2">{company.contacts.map((c: any) => (
                    <Link key={c?.id} href={`/contacts/${c?.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div><p className="font-medium">{c?.firstName} {c?.lastName}</p><p className="text-xs text-muted-foreground">{c?.email ?? ''}</p></div>
                    </Link>
                  ))}</div>
                )}
              </CardContent></Card>
            </TabsContent>
            <TabsContent value="deals">
              <Card><CardContent className="pt-6">
                {(company?.deals?.length ?? 0) === 0 ? <p className="text-muted-foreground text-sm">No deals</p> : (
                  <div className="space-y-2">{company.deals.map((d: any) => (
                    <Link key={d?.id} href={`/deals/${d?.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div><p className="font-medium">{d?.name}</p><p className="text-xs text-muted-foreground">{d?.stage?.replace(/_/g, ' ')}</p></div>
                      <p className="font-mono font-medium">${(d?.value ?? 0).toLocaleString('en-US')}</p>
                    </Link>
                  ))}</div>
                )}
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
