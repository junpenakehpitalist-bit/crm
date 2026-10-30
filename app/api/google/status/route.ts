export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await prisma.googleOAuthToken.findFirst();
  return NextResponse.json({
    connected: !!token,
    lastSyncAt: token?.lastSyncAt?.toISOString() ?? null,
    configured: process.env.GOOGLE_CLIENT_ID !== 'PLACEHOLDER_GOOGLE_CLIENT_ID',
  });
}
