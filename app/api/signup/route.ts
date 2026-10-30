export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  // Self-hosted deployments disable open registration: admins add users in Settings > Users.
  if (process.env.DISABLE_PUBLIC_SIGNUP === 'true') {
    return NextResponse.json({ error: 'Self sign-up is disabled. Ask an administrator to create your account.' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { email, password, name } = body ?? {};

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: 'SALES_REP' },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
