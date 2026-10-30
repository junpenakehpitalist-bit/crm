export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const activity = await prisma.activity.update({
      where: { id },
      data: {
        type: body.type ?? undefined,
        subject: body.subject ?? undefined,
        description: body.description ?? null,
        date: body.date ? new Date(body.date) : undefined,
        duration: body.duration !== undefined ? parseInt(body.duration) : undefined,
        outcome: body.outcome ?? null,
        completed: body.completed ?? undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    return NextResponse.json(activity);
  } catch (err: any) {
    console.error('Update activity error:', err);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    await prisma.activity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete activity error:', err);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}
