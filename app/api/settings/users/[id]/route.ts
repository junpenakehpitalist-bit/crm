export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (currentUser?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const user = await prisma.user.update({
      where: { id },
      data: {
        role: body.role ?? undefined,
        active: body.active !== undefined ? body.active : undefined,
        name: body.name ?? undefined,
      },
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role, active: user.active });
  } catch (err: any) {
    console.error('Update user error:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
