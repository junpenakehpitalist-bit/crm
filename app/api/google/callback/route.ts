export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/app-url';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?google=error', req.url));
  }

  try {
    const baseUrl = getAppUrl();
    const redirectUri = `${baseUrl}/api/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData?.access_token) {
      console.error('Google token exchange failed:', tokenData);
      return NextResponse.redirect(new URL('/settings?google=error', req.url));
    }

    // Upsert token
    const existing = await prisma.googleOAuthToken.findFirst();
    if (existing) {
      await prisma.googleOAuthToken.update({
        where: { id: existing.id },
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token ?? existing.refreshToken,
          expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
          scope: tokenData.scope ?? null,
        },
      });
    } else {
      await prisma.googleOAuthToken.create({
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token ?? null,
          expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
          scope: tokenData.scope ?? null,
        },
      });
    }

    return NextResponse.redirect(new URL('/settings?google=success', req.url));
  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(new URL('/settings?google=error', req.url));
  }
}
