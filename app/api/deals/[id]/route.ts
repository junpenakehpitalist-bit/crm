export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { syncDealToSheets } from '@/lib/google-sheets';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: { select: { id: true, name: true } },
      activities: { include: { creator: { select: { id: true, name: true } } }, orderBy: { date: 'desc' }, take: 20 },
      transactions: { orderBy: { date: 'desc' }, take: 20 },
    },
  });
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(deal);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const deal = await prisma.deal.update({
      where: { id },
      data: {
        name: body.name,
        value: body.value !== undefined ? parseFloat(body.value) : undefined,
        stage: body.stage ?? undefined,
        closeDate: body.closeDate ? new Date(body.closeDate) : null,
        probability: body.probability !== undefined ? parseFloat(body.probability) : undefined,
        description: body.description ?? null,
        ownerId: body.ownerId ?? undefined,
        contactId: body.contactId ?? null,
        companyId: body.companyId ?? null,
      },
    });
    // Log to the Google Sheet immediately (no-op if Google is not connected; never throws).
    await syncDealToSheets(deal.id);
    return NextResponse.json(deal);
  } catch (err: any) {
    console.error('Update deal error:', err);
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    await prisma.deal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete deal error:', err);
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 });
  }
}
