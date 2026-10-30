export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { syncTransactionToSheets } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? '';
  const status = url.searchParams.get('status') ?? '';

  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      deal: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 200,
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const transaction = await prisma.transaction.create({
      data: {
        amount: parseFloat(body.amount),
        date: body.date ? new Date(body.date) : new Date(),
        type: body.type,
        status: body.status ?? 'PENDING',
        description: body.description ?? null,
        contactId: body.contactId ?? null,
        dealId: body.dealId ?? null,
      },
    });
    // Log to the Google Sheet immediately (no-op if Google is not connected; never throws).
    await syncTransactionToSheets(transaction.id);
    return NextResponse.json(transaction, { status: 201 });
  } catch (err: any) {
    console.error('Create transaction error:', err);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
