export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? '';
  const contactId = url.searchParams.get('contactId') ?? '';
  const dealId = url.searchParams.get('dealId') ?? '';
  const companyId = url.searchParams.get('companyId') ?? '';

  const where: any = {};
  if (type) where.type = type;
  if (contactId) where.contactId = contactId;
  if (dealId) where.dealId = dealId;
  if (companyId) where.companyId = companyId;

  const activities = await prisma.activity.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 200,
  });

  return NextResponse.json(activities);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const activity = await prisma.activity.create({
      data: {
        type: body.type,
        subject: body.subject,
        description: body.description ?? null,
        date: body.date ? new Date(body.date) : new Date(),
        duration: body.duration ? parseInt(body.duration) : null,
        outcome: body.outcome ?? null,
        completed: body.completed ?? false,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        creatorId: session.user.id,
        contactId: body.contactId ?? null,
        companyId: body.companyId ?? null,
        dealId: body.dealId ?? null,
      },
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (err: any) {
    console.error('Create activity error:', err);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
