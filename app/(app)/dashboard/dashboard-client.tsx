'use client';

import { AbacusDashboard, useDashboardData } from '@/components/viz/abacus-dashboard';
import { manifest } from '@/lib/dashboard-manifest';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CalendarClock, Phone, Mail, Users, FileText } from 'lucide-react';
import { SafeDate } from '@/components/safe-format';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const activityIcons: Record<string, any> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: FileText,
  TASK: CalendarClock,
};

export function DashboardClient() {
  const { data, dataAsOf } = useDashboardData('/api/dashboard', 60_000);
  const [extra, setExtra] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => { if (d) setExtra(d?.extra ?? null); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <AbacusDashboard manifest={manifest} data={data} dataAsOf={dataAsOf} className="min-h-[400px]" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4">
        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!extra ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i: number) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (extra?.recentActivities?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activities</p>
            ) : (
              <div className="space-y-3">
                {(extra?.recentActivities ?? []).map((a: any) => {
                  const Icon = activityIcons[a?.type] ?? Activity;
                  return (
                    <div key={a?.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="mt-0.5 p-1.5 rounded bg-primary/10">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a?.subject ?? 'Activity'}</p>
                        <p className="text-xs text-muted-foreground">
                          {a?.creator?.name ?? 'Unknown'}
                          {a?.contact ? ` · ${a.contact.firstName ?? ''} ${a.contact.lastName ?? ''}` : ''}
                        </p>
                      </div>
                      <SafeDate date={a?.date} options={{ dateStyle: 'short' }} className="text-xs text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deals Closing Soon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-primary" />
              Deals Closing Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!extra ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i: number) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (extra?.closingSoon?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No deals closing in the next 7 days</p>
            ) : (
              <div className="space-y-3">
                {(extra?.closingSoon ?? []).map((d: any) => (
                  <Link
                    key={d?.id}
                    href={`/deals/${d?.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d?.name ?? 'Deal'}</p>
                      <p className="text-xs text-muted-foreground">
                        {d?.owner?.name ?? 'Unassigned'}
                        {d?.contact ? ` · ${d.contact.firstName ?? ''} ${d.contact.lastName ?? ''}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-medium">${(d?.value ?? 0).toLocaleString('en-US')}</p>
                      <SafeDate date={d?.closeDate} options={{ dateStyle: 'short' }} className="text-xs text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
