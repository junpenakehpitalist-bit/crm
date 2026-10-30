export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { syncContactToSheets } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const stage = url.searchParams.get('stage') ?? '';
  const owner = url.searchParams.get('owner') ?? '';

  const where: any = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (stage) where.lifecycleStage = stage;
  if (owner) where.ownerId = owner;

  const contacts = await prisma.contact.findMany({
    where,
    include: { owner: { select: { id: true, name: true } }, company: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const contact = await prisma.contact.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        jobTitle: body.jobTitle ?? null,
        address: body.address ?? null,
        lifecycleStage: body.lifecycleStage ?? 'LEAD',
        tags: body.tags ?? [],
        notes: body.notes ?? null,
        ownerId: body.ownerId ?? session.user.id,
        companyId: body.companyId ?? null,
      },
    });
    // Log to the Google Sheet immediately (no-op if Google is not connected; never throws).
    await syncContactToSheets(contact.id);
    return NextResponse.json(contact, { status: 201 });
  } catch (err: any) {
    console.error('Create contact error:', err);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
