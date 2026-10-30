export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({
      data_as_of: new Date().toISOString(),
      data: { kpis: [], pipeline_funnel: [], pipeline_value: [] },
      extra: { recentActivities: [], closingSoon: [] },
    });
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [totalContacts, openDeals, wonDeals, lostDeals, allDeals, recentActivities, closingSoon] = await Promise.all([
      prisma.contact.count(),
      prisma.deal.count({ where: { stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } } }),
      prisma.deal.findMany({ where: { stage: 'CLOSED_WON', updatedAt: { gte: monthStart } }, select: { value: true } }),
      prisma.deal.findMany({ where: { stage: 'CLOSED_LOST', updatedAt: { gte: monthStart } }, select: { value: true } }),
      prisma.deal.groupBy({ by: ['stage'], _count: { id: true }, _sum: { value: true } }),
      prisma.activity.findMany({
        orderBy: { date: 'desc' },
        take: 10,
        include: {
          creator: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
          deal: { select: { name: true } },
        },
      }),
      prisma.deal.findMany({
        where: {
          stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
          closeDate: { gte: now, lte: weekFromNow },
        },
        include: {
          owner: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
        orderBy: { closeDate: 'asc' },
        take: 10,
      }),
    ]);

    const revenueWon = wonDeals?.reduce((s: number, d: any) => s + (d?.value ?? 0), 0) ?? 0;
    const revenueLost = lostDeals?.reduce((s: number, d: any) => s + (d?.value ?? 0), 0) ?? 0;

    const stageOrder = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
    const pipeline = stageOrder.map((stage: string) => {
      const found = allDeals?.find((d: any) => d?.stage === stage);
      return {
        stage: stage?.replace(/_/g, ' ') ?? stage,
        count: found?._count?.id ?? 0,
        value: found?._sum?.value ?? 0,
      };
    });

    // Format data for AbacusDashboard
    const kpis = [
      { metric: 'contacts', label: 'Total Contacts', value: totalContacts, format: 'integer', delta: null, delta_label: '', spark: [], good_when: 'up' },
      { metric: 'open_deals', label: 'Open Deals', value: openDeals, format: 'integer', delta: null, delta_label: '', spark: [], good_when: 'up' },
      { metric: 'revenue_won', label: 'Revenue Won', value: revenueWon, format: 'currency_compact', delta: null, delta_label: 'this month', spark: [], good_when: 'up' },
      { metric: 'revenue_lost', label: 'Revenue Lost', value: revenueLost, format: 'currency_compact', delta: null, delta_label: 'this month', spark: [], good_when: 'down' },
    ];

    const funnel = pipeline
      ?.filter((p: any) => !['CLOSED WON', 'CLOSED LOST'].includes(p?.stage))
      ?.map((p: any) => ({ category: p?.stage ?? '', value: p?.count ?? 0 })) ?? [];

    return NextResponse.json({
      data_as_of: now.toISOString(),
      data: {
        kpis,
        pipeline_funnel: funnel,
        pipeline_value: pipeline?.map((p: any) => ({ category: p?.stage ?? '', value: p?.value ?? 0 })) ?? [],
      },
      extra: {
        recentActivities: recentActivities ?? [],
        closingSoon: closingSoon ?? [],
      },
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    return NextResponse.json({
      data_as_of: new Date().toISOString(),
      data: { kpis: [], pipeline_funnel: [], pipeline_value: [] },
      extra: { recentActivities: [], closingSoon: [] },
    });
  }
}
