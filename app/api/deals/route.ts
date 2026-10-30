export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { syncDealToSheets } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const stage = url.searchParams.get('stage') ?? '';
  const owner = url.searchParams.get('owner') ?? '';

  const where: any = {};
  if (stage) where.stage = stage;
  if (owner) where.ownerId = owner;

  const deals = await prisma.deal.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const deal = await prisma.deal.create({
      data: {
        name: body.name,
        value: body.value ? parseFloat(body.value) : 0,
        stage: body.stage ?? 'LEAD',
        closeDate: body.closeDate ? new Date(body.closeDate) : null,
        probability: body.probability ? parseFloat(body.probability) : 0,
        description: body.description ?? null,
        ownerId: body.ownerId ?? session.user.id,
        contactId: body.contactId ?? null,
        companyId: body.companyId ?? null,
      },
    });
    // Log to the Google Sheet immediately (no-op if Google is not connected; never throws).
    await syncDealToSheets(deal.id);
    return NextResponse.json(deal, { status: 201 });
  } catch (err: any) {
    console.error('Create deal error:', err);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
