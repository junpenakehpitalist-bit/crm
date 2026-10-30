'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Handshake, Plus, LayoutGrid, List, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeDate, SafeNumber } from '@/components/safe-format';

const STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
const stageColors: Record<string, string> = {
  LEAD: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  QUALIFIED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  PROPOSAL: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  PROPOSAL_SENT: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  NEGOTIATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  CLOSED_WON: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CLOSED_LOST: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function DealsClient() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);

  const fetchDeals = useCallback(() => {
    setLoading(true);
    fetch('/api/deals')
      .then((r) => r.json())
      .then((d) => setDeals(d ?? []))
      .catch(() => toast.error('Failed to load deals'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleDragStart = (dealId: string) => setDraggedDeal(dealId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (stage: string) => {
    if (!draggedDeal) return;
    const deal = deals.find((d: any) => d?.id === draggedDeal);
    if (!deal || deal.stage === stage) { setDraggedDeal(null); return; }
    // Optimistic update
    setDeals(prev => prev.map((d: any) => d?.id === draggedDeal ? { ...d, stage } : d));
    setDraggedDeal(null);
    try {
      const res = await fetch(`/api/deals/${draggedDeal}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deal, stage }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Moved to ${stage.replace(/_/g, ' ')}`);
    } catch {
      toast.error('Failed to update deal');
      fetchDeals();
    }
  };

  const groupedDeals = STAGES.reduce((acc: Record<string, any[]>, stage: string) => {
    acc[stage] = (deals ?? []).filter((d: any) => d?.stage === stage);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals"
        description="Track and manage your sales pipeline"
        actions={<Link href="/deals/new"><Button><Plus className="h-4 w-4 mr-2" />Add Deal</Button></Link>}
      />

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban"><LayoutGrid className="h-4 w-4 mr-1" />Kanban</TabsTrigger>
          <TabsTrigger value="list"><List className="h-4 w-4 mr-1" />List</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          {loading ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((s: string) => <Skeleton key={s} className="h-64 min-w-[250px] w-[250px]" />)}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((stage: string) => (
                <div
                  key={stage}
                  className="min-w-[260px] w-[260px] flex-shrink-0"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(stage)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Badge className={stageColors[stage] ?? ''}>{stage?.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{groupedDeals[stage]?.length ?? 0}</span>
                  </div>
                  <div className="space-y-2 min-h-[100px] p-2 rounded-lg bg-muted/30 border border-dashed border-border">
                    {(groupedDeals[stage] ?? []).map((d: any) => (
                      <Card
                        key={d?.id}
                        draggable
                        onDragStart={() => handleDragStart(d?.id)}
                        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <Link href={`/deals/${d?.id}`} className="font-medium text-sm hover:text-primary">
                                {d?.name}
                              </Link>
                              <p className="text-xs text-muted-foreground mt-1">
                                {d?.contact ? `${d.contact.firstName ?? ''} ${d.contact.lastName ?? ''}` : d?.company?.name ?? 'No contact'}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="font-mono text-sm font-medium">${(d?.value ?? 0).toLocaleString('en-US')}</span>
                                {d?.closeDate && <SafeDate date={d.closeDate} options={{ month: 'short', day: 'numeric' }} className="text-xs text-muted-foreground" />}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Deal</th>
                      <th className="text-left p-3 font-medium">Value</th>
                      <th className="text-left p-3 font-medium">Stage</th>
                      <th className="text-left p-3 font-medium">Contact</th>
                      <th className="text-left p-3 font-medium">Owner</th>
                      <th className="text-left p-3 font-medium">Close Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_: unknown, i: number) => (
                        <tr key={i}>{Array.from({ length: 6 }).map((_: unknown, j: number) => <td key={j} className="p-3"><Skeleton className="h-5 w-full" /></td>)}</tr>
                      ))
                    ) : (deals?.length ?? 0) === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No deals found</td></tr>
                    ) : (
                      deals.map((d: any) => (
                        <tr key={d?.id} className="border-b hover:bg-muted/50">
                          <td className="p-3"><Link href={`/deals/${d?.id}`} className="font-medium text-primary hover:underline">{d?.name}</Link></td>
                          <td className="p-3 font-mono">${(d?.value ?? 0).toLocaleString('en-US')}</td>
                          <td className="p-3"><Badge className={stageColors[d?.stage] ?? ''}>{d?.stage?.replace(/_/g, ' ')}</Badge></td>
                          <td className="p-3 text-muted-foreground">{d?.contact ? `${d.contact.firstName ?? ''} ${d.contact.lastName ?? ''}` : '-'}</td>
                          <td className="p-3 text-muted-foreground">{d?.owner?.name ?? '-'}</td>
                          <td className="p-3">{d?.closeDate ? <SafeDate date={d.closeDate} options={{ dateStyle: 'medium' }} /> : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
