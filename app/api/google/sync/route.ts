export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { syncContactToSheets, syncDealToSheets, syncAllTransactionsToSheets } from '@/lib/google-sheets';

// Full syncs can take a while on large datasets.
export const maxDuration = 300;

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Every transaction goes into the single master "CRM - Transactions" sheet (batched, no duplicates).
    const tx = await syncAllTransactionsToSheets();
    if (!tx) return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });

    const contacts = await prisma.contact.findMany({ select: { id: true }, take: 500 });
    const deals = await prisma.deal.findMany({ select: { id: true }, take: 500 });

    for (const c of contacts) {
      await syncContactToSheets(c.id);
    }
    for (const d of deals) {
      await syncDealToSheets(d.id);
    }

    return NextResponse.json({ success: true, synced: { contacts: contacts.length, deals: deals.length, transactions: tx.updated + tx.appended } });
  } catch (err: any) {
    console.error('Manual sync error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
