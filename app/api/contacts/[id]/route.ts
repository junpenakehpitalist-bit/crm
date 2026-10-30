export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { syncContactToSheets } from '@/lib/google-sheets';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      deals: { include: { owner: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      activities: { include: { creator: { select: { id: true, name: true } } }, orderBy: { date: 'desc' }, take: 20 },
      transactions: { orderBy: { date: 'desc' }, take: 20 },
    },
  });
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        jobTitle: body.jobTitle ?? null,
        address: body.address ?? null,
        lifecycleStage: body.lifecycleStage,
        tags: body.tags ?? [],
        notes: body.notes ?? null,
        ownerId: body.ownerId ?? undefined,
        companyId: body.companyId ?? null,
      },
    });
    // Log to the Google Sheet immediately (no-op if Google is not connected; never throws).
    await syncContactToSheets(contact.id);
    return NextResponse.json(contact);
  } catch (err: any) {
    console.error('Update contact error:', err);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete contact error:', err);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
