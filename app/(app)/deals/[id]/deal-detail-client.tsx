'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, DollarSign, Calendar, Percent, Users, Building2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeDate, SafeNumber } from '@/components/safe-format';
import { DealFormClient } from '../deal-form-client';

const stageColors: Record<string, string> = {
  LEAD: 'bg-slate-100 text-slate-700',
  QUALIFIED: 'bg-blue-100 text-blue-700',
  PROPOSAL: 'bg-indigo-100 text-indigo-700',
  PROPOSAL_SENT: 'bg-purple-100 text-purple-700',
  NEGOTIATION: 'bg-amber-100 text-amber-700',
  CLOSED_WON: 'bg-green-100 text-green-700',
  CLOSED_LOST: 'bg-red-100 text-red-700',
};

export function DealDetailClient({ dealId }: { dealId: string }) {
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/deals/${dealId}`)
      .then(r => r.json())
      .then(d => setDeal(d))
      .catch(() => toast.error('Failed to load deal'))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div className="space-y-4">{[1,2,3].map((i: number) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (!deal) return <p className="text-muted-foreground">Deal not found</p>;
  if (editing) return <DealFormClient initialData={deal} dealId={dealId} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={deal?.name ?? 'Deal'}
        description={`Stage: ${deal?.stage?.replace(/_/g, ' ') ?? ''}`}
        actions={
          <div className="flex gap-2">
            <Link href="/deals"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
            <Button onClick={() => setEditing(true)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-lg">Deal Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Badge className={stageColors[deal?.stage] ?? ''}>{deal?.stage?.replace(/_/g, ' ')}</Badge>
            <div className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4 text-muted-foreground" />Value: <SafeNumber value={deal?.value ?? 0} currency="USD" /></div>
            {deal?.closeDate && <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" />Close: <SafeDate date={deal.closeDate} options={{ dateStyle: 'medium' }} /></div>}
            <div className="flex items-center gap-2 text-sm"><Percent className="h-4 w-4 text-muted-foreground" />Probability: {deal?.probability ?? 0}%</div>
            {deal?.contact && <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground" /><Link href={`/contacts/${deal.contact.id}`} className="text-primary hover:underline">{deal.contact.firstName} {deal.contact.lastName}</Link></div>}
            {deal?.company && <div className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><Link href={`/companies/${deal.company.id}`} className="text-primary hover:underline">{deal.company.name}</Link></div>}
            {deal?.owner && <p className="text-sm">Owner: {deal.owner.name}</p>}
            {deal?.description && <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">{deal.description}</div>}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <Tabs defaultValue="activities">
            <TabsList>
              <TabsTrigger value="activities"><Activity className="h-4 w-4 mr-1" />Activities</TabsTrigger>
            </TabsList>
            <TabsContent value="activities">
              <Card><CardContent className="pt-6">
                {(deal?.activities?.length ?? 0) === 0 ? <p className="text-muted-foreground text-sm">No activities</p> : (
                  <div className="space-y-3">{deal.activities.map((a: any) => (
                    <div key={a?.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div><Badge variant="outline" className="text-xs mr-2">{a?.type}</Badge><span className="font-medium text-sm">{a?.subject}</span></div>
                        <SafeDate date={a?.date} options={{ dateStyle: 'short' }} className="text-xs text-muted-foreground" />
                      </div>
                      {a?.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                    </div>
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
