'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layouts/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, Building2, Mail, Phone, MapPin, Briefcase, Tag, Handshake, Activity as ActivityIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeDate } from '@/components/safe-format';
import { ContactFormClient } from '../contact-form-client';

const stageColors: Record<string, string> = {
  LEAD: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PROSPECT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  CUSTOMER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CHURNED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function ContactDetailClient({ contactId }: { contactId: string }) {
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/contacts/${contactId}`)
      .then(r => r.json())
      .then(d => setContact(d))
      .catch(() => toast.error('Failed to load contact'))
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) return <div className="space-y-4">{[1,2,3].map((i: number) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (!contact) return <p className="text-muted-foreground">Contact not found</p>;

  if (editing) {
    return <ContactFormClient initialData={contact} contactId={contactId} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${contact?.firstName ?? ''} ${contact?.lastName ?? ''}`}
        description={contact?.jobTitle ?? 'Contact'}
        actions={
          <div className="flex gap-2">
            <Link href="/contacts"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
            <Button onClick={() => setEditing(true)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge className={stageColors[contact?.lifecycleStage] ?? ''}>{contact?.lifecycleStage}</Badge>
            {contact?.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span suppressHydrationWarning>{contact.email}</span></div>}
            {contact?.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span suppressHydrationWarning>{contact.phone}</span></div>}
            {contact?.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{contact.address}</div>}
            {contact?.company && <div className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><Link href={`/companies/${contact.company.id}`} className="text-primary hover:underline">{contact.company.name}</Link></div>}
            {contact?.owner && <div className="flex items-center gap-2 text-sm"><Briefcase className="h-4 w-4 text-muted-foreground" />Owner: {contact.owner.name}</div>}
            {(contact?.tags?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {contact.tags.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
              </div>
            )}
            {contact?.notes && <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">{contact.notes}</div>}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="deals">
            <TabsList>
              <TabsTrigger value="deals"><Handshake className="h-4 w-4 mr-1" />Deals</TabsTrigger>
              <TabsTrigger value="activities"><ActivityIcon className="h-4 w-4 mr-1" />Activities</TabsTrigger>
            </TabsList>
            <TabsContent value="deals">
              <Card>
                <CardContent className="pt-6">
                  {(contact?.deals?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground text-sm">No deals associated</p>
                  ) : (
                    <div className="space-y-3">
                      {contact.deals.map((d: any) => (
                        <Link key={d?.id} href={`/deals/${d?.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div>
                            <p className="font-medium">{d?.name}</p>
                            <p className="text-xs text-muted-foreground">{d?.stage?.replace(/_/g, ' ')} · {d?.owner?.name ?? 'Unassigned'}</p>
                          </div>
                          <p className="font-mono font-medium">${(d?.value ?? 0).toLocaleString('en-US')}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="activities">
              <Card>
                <CardContent className="pt-6">
                  {(contact?.activities?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground text-sm">No activities recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {contact.activities.map((a: any) => (
                        <div key={a?.id} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge variant="outline" className="text-xs mr-2">{a?.type}</Badge>
                              <span className="font-medium text-sm">{a?.subject}</span>
                            </div>
                            <SafeDate date={a?.date} options={{ dateStyle: 'short' }} className="text-xs text-muted-foreground" />
                          </div>
                          {a?.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
