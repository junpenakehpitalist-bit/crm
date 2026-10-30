export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';

  const where: any = {};
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const companies = await prisma.company.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { contacts: true, deals: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const company = await prisma.company.create({
      data: {
        name: body.name,
        industry: body.industry ?? null,
        website: body.website ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        description: body.description ?? null,
        employeeCount: body.employeeCount ? parseInt(body.employeeCount) : null,
        annualRevenue: body.annualRevenue ? parseFloat(body.annualRevenue) : null,
        ownerId: body.ownerId ?? session.user.id,
      },
    });
    return NextResponse.json(company, { status: 201 });
  } catch (err: any) {
    console.error('Create company error:', err);
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
  }
}
