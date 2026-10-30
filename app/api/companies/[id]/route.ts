export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { include: { owner: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      deals: { include: { owner: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      activities: { include: { creator: { select: { id: true, name: true } } }, orderBy: { date: 'desc' }, take: 20 },
    },
  });
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(company);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const company = await prisma.company.update({
      where: { id },
      data: {
        name: body.name,
        industry: body.industry ?? null,
        website: body.website ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        description: body.description ?? null,
        employeeCount: body.employeeCount ? parseInt(body.employeeCount) : null,
        annualRevenue: body.annualRevenue ? parseFloat(body.annualRevenue) : null,
        ownerId: body.ownerId ?? undefined,
      },
    });
    return NextResponse.json(company);
  } catch (err: any) {
    console.error('Update company error:', err);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete company error:', err);
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 });
  }
}
