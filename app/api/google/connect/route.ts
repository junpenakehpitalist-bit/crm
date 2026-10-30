export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/app-url';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  if (!clientId || clientId === 'PLACEHOLDER_GOOGLE_CLIENT_ID') {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 400 });
  }

  const baseUrl = getAppUrl();
  const redirectUri = `${baseUrl}/api/google/callback`;
  const scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `access_type=offline&` +
    `prompt=consent`;

  return NextResponse.json({ url: authUrl });
}
