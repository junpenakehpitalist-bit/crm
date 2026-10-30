'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Activity, Plus, Phone, Mail, Users, FileText, CalendarClock, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeDate } from '@/components/safe-format';

const typeIcons: Record<string, any> = { CALL: Phone, EMAIL: Mail, MEETING: Users, NOTE: FileText, TASK: CalendarClock };
const TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];

export function ActivitiesClient() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [form, setForm] = useState({ type: 'CALL', subject: '', description: '', date: '', duration: '', outcome: '', dueDate: '', contactId: '', dealId: '' });
  const [saving, setSaving] = useState(false);

  const fetchActivities = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    fetch(`/api/activities?${params.toString()}`)
      .then(r => r.json())
      .then(d => setActivities(d ?? []))
      .catch(() => toast.error('Failed to load activities'))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);
  useEffect(() => {
    fetch('/api/contacts').then(r => r.json()).then(d => setContacts(d ?? [])).catch(() => {});
    fetch('/api/deals').then(r => r.json()).then(d => setDeals(d ?? [])).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contactId: form.contactId || null, dealId: form.dealId || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Activity created');
      setDialogOpen(false);
      setForm({ type: 'CALL', subject: '', description: '', date: '', duration: '', outcome: '', dueDate: '', contactId: '', dealId: '' });
      fetchActivities();
    } catch { toast.error('Failed to create activity'); }
    finally { setSaving(false); }
  };

  const toggleComplete = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/activities/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !current }) });
      fetchActivities();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete activity?')) return;
    try { await fetch(`/api/activities/${id}`, { method: 'DELETE' }); toast.success('Deleted'); fetchActivities(); }
    catch { toast.error('Failed to delete'); }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activities"
        description="Track calls, emails, meetings, notes and tasks"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Log Activity</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v: string) => updateField('type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Subject *</Label><Input value={form.subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('subject', e.target.value)} required /></div>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('description', e.target.value)} rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date</Label><Input type="datetime-local" value={form.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('date', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" value={form.duration} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('duration', e.target.value)} /></div>
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
                {form.type === 'TASK' && (
                  <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('dueDate', e.target.value)} /></div>
                )}
                <div className="space-y-2"><Label>Outcome</Label><Input value={form.outcome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('outcome', e.target.value)} /></div>
                <Button type="submit" className="w-full" loading={saving}>Create Activity</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {TYPES.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_: unknown, i: number) => <Skeleton key={i} className="h-20 w-full" />)
        ) : (activities?.length ?? 0) === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />No activities found</CardContent></Card>
        ) : (
          activities.map((a: any) => {
            const Icon = typeIcons[a?.type] ?? Activity;
            return (
              <Card key={a?.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{a?.type}</Badge>
                        <h3 className="font-medium">{a?.subject}</h3>
                        {a?.completed && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </div>
                      {a?.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {a?.creator?.name && <span>by {a.creator.name}</span>}
                        {a?.contact && <span>· {a.contact.firstName} {a.contact.lastName}</span>}
                        {a?.deal && <span>· {a.deal.name}</span>}
                        {a?.duration && <span>· {a.duration} min</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <SafeDate date={a?.date} options={{ dateStyle: 'short', timeStyle: 'short' }} className="text-xs text-muted-foreground" />
                      {a?.type === 'TASK' && (
                        <Button variant="ghost" size="icon-sm" onClick={() => toggleComplete(a?.id, a?.completed)}>
                          <CheckCircle2 className={`h-4 w-4 ${a?.completed ? 'text-green-600' : 'text-muted-foreground'}`} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(a?.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
