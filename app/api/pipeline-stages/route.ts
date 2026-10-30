export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(stages);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (currentUser?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const maxStage = await prisma.pipelineStage.findFirst({ orderBy: { order: 'desc' } });
    const stage = await prisma.pipelineStage.create({
      data: {
        name: body.name,
        order: (maxStage?.order ?? 0) + 1,
        color: body.color ?? '#3b82f6',
      },
    });
    return NextResponse.json(stage, { status: 201 });
  } catch (err: any) {
    console.error('Create stage error:', err);
    return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (currentUser?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const stages = body.stages ?? [];
    // Reorder stages
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      await prisma.pipelineStage.update({
        where: { id: s.id },
        data: { name: s.name, order: i + 1, color: s.color ?? '#3b82f6' },
      });
    }
    const updated = await prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('Update stages error:', err);
    return NextResponse.json({ error: 'Failed to update stages' }, { status: 500 });
  }
}
