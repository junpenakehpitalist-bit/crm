export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(users);
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
    const { email, name, password, role } = body ?? {};

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, password: hashed, role: role ?? 'SALES_REP' },
    });

    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
  } catch (err: any) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
