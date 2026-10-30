import { prisma } from '@/lib/prisma';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export async function getValidAccessToken(): Promise<string | null> {
  const token = await prisma.googleOAuthToken.findFirst();
  if (!token) return null;

  // Check if token expired
  if (token.expiresAt && new Date() >= token.expiresAt) {
    if (!token.refreshToken) return null;
    // Refresh the token
    try {
      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID ?? '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          refresh_token: token.refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      const data = await res.json();
      if (data?.access_token) {
        await prisma.googleOAuthToken.update({
          where: { id: token.id },
          data: {
            accessToken: data.access_token,
            expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
          },
        });
        return data.access_token;
      }
    } catch (err) {
      console.error('Token refresh error:', err);
    }
    return null;
  }

  return token.accessToken;
}

async function ensureDriveFolder(accessToken: string): Promise<string> {
  const token = await prisma.googleOAuthToken.findFirst();
  if (token?.driveFolderId) return token.driveFolderId;

  // Search for existing folder
  const searchRes = await fetch(
    `${GOOGLE_DRIVE_API}?q=name='CRM Data' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData?.files?.[0]?.id) {
    const folderId = searchData.files[0].id;
    if (token) {
      await prisma.googleOAuthToken.update({ where: { id: token.id }, data: { driveFolderId: folderId } });
    }
    return folderId;
  }

  // Create folder
  const createRes = await fetch(GOOGLE_DRIVE_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'CRM Data', mimeType: 'application/vnd.google-apps.folder' }),
  });
  const createData = await createRes.json();
  const folderId = createData?.id ?? '';
  if (token && folderId) {
    await prisma.googleOAuthToken.update({ where: { id: token.id }, data: { driveFolderId: folderId } });
  }
  return folderId;
}

async function ensureSpreadsheet(accessToken: string, folderId: string, name: string, headers: string[]): Promise<string> {
  // Search for existing spreadsheet in folder
  const searchRes = await fetch(
    `${GOOGLE_DRIVE_API}?q=name='${name}' and '${folderId}' in parents and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData?.files?.[0]?.id) return searchData.files[0].id;

  // Create spreadsheet
  const createRes = await fetch(GOOGLE_SHEETS_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: name },
      sheets: [{ properties: { title: 'Sheet1' } }],
    }),
  });
  const createData = await createRes.json();
  const spreadsheetId = createData?.spreadsheetId ?? '';

  // Move to folder
  if (spreadsheetId) {
    await fetch(`${GOOGLE_DRIVE_API}/${spreadsheetId}?addParents=${folderId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Add headers
    await fetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [headers] }),
    });
  }

  return spreadsheetId;
}

const CONTACT_HEADERS = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Job Title', 'Company', 'Lifecycle Stage', 'Owner', 'Created At'];
const DEAL_HEADERS = ['ID', 'Name', 'Value', 'Stage', 'Close Date', 'Probability', 'Contact', 'Company', 'Owner', 'Created At'];
const TRANSACTION_HEADERS = ['ID', 'Amount', 'Date', 'Type', 'Status', 'Description', 'Contact', 'Deal', 'Created At'];

export async function syncContactToSheets(contactId: string) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return;

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { owner: { select: { name: true } }, company: { select: { name: true } } },
    });
    if (!contact) return;

    const folderId = await ensureDriveFolder(accessToken);
    const sheetId = await ensureSpreadsheet(accessToken, folderId, 'CRM - Contacts', CONTACT_HEADERS);

    const row = [
      contact.id,
      contact.firstName,
      contact.lastName,
      contact.email ?? '',
      contact.phone ?? '',
      contact.jobTitle ?? '',
      contact.company?.name ?? '',
      contact.lifecycleStage,
      contact.owner?.name ?? '',
      contact.createdAt?.toISOString() ?? '',
    ];

    // Try to find existing row and update, or append
    const getRes = await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A:A`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const getData = await getRes.json();
    const rows = getData?.values ?? [];
    const rowIdx = rows?.findIndex((r: string[]) => r?.[0] === contact.id);

    if (rowIdx > 0) {
      // Update existing row
      await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A${rowIdx + 1}:J${rowIdx + 1}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      });
    } else {
      // Append new row
      await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A1:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      });
    }

    await prisma.googleOAuthToken.updateMany({ data: { lastSyncAt: new Date() } });
  } catch (err) {
    console.error('Sync contact to sheets error:', err);
  }
}

export async function syncDealToSheets(dealId: string) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return;

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        owner: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        company: { select: { name: true } },
      },
    });
    if (!deal) return;

    const folderId = await ensureDriveFolder(accessToken);
    const sheetId = await ensureSpreadsheet(accessToken, folderId, 'CRM - Deals', DEAL_HEADERS);

    const row = [
      deal.id,
      deal.name,
      String(deal.value ?? 0),
      deal.stage?.replace(/_/g, ' ') ?? '',
      deal.closeDate?.toISOString()?.split('T')?.[0] ?? '',
      String(deal.probability ?? 0),
      deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : '',
      deal.company?.name ?? '',
      deal.owner?.name ?? '',
      deal.createdAt?.toISOString() ?? '',
    ];

    const getRes = await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A:A`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const getData = await getRes.json();
    const rows = getData?.values ?? [];
    const rowIdx = rows?.findIndex((r: string[]) => r?.[0] === deal.id);

    if (rowIdx > 0) {
      await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A${rowIdx + 1}:J${rowIdx + 1}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      });
    } else {
      await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A1:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      });
    }

    await prisma.googleOAuthToken.updateMany({ data: { lastSyncAt: new Date() } });
  } catch (err) {
    console.error('Sync deal to sheets error:', err);
  }
}

export async function syncTransactionToSheets(transactionId: string) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        contact: { select: { firstName: true, lastName: true } },
        deal: { select: { name: true } },
      },
    });
    if (!transaction) return;

    const folderId = await ensureDriveFolder(accessToken);
    const sheetId = await ensureSpreadsheet(accessToken, folderId, 'CRM - Transactions', TRANSACTION_HEADERS);

    const row = transactionRow(transaction);

    // Master log: one row per transaction ID. Update the row if it already exists
    // (e.g. status changed), otherwise append — so re-syncing never creates duplicates.
    const getRes = await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A:A`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const getData = await getRes.json();
    const rows: string[][] = getData?.values ?? [];
    const rowIdx = rows.findIndex((r) => r?.[0] === transaction.id);

    if (rowIdx > 0) {
      await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A${rowIdx + 1}:I${rowIdx + 1}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      });
    } else {
      await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      });
    }

    await prisma.googleOAuthToken.updateMany({ data: { lastSyncAt: new Date() } });
  } catch (err) {
    console.error('Sync transaction to sheets error:', err);
  }
}


type TransactionWithRelations = {
  id: string;
  amount: number | null;
  date: Date | null;
  type: string | null;
  status: string | null;
  description: string | null;
  createdAt: Date | null;
  contact: { firstName: string; lastName: string } | null;
  deal: { name: string } | null;
};

function transactionRow(t: TransactionWithRelations): string[] {
  return [
    t.id,
    String(t.amount ?? 0),
    t.date?.toISOString()?.split('T')?.[0] ?? '',
    t.type ?? '',
    t.status ?? '',
    t.description ?? '',
    t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : '',
    t.deal?.name ?? '',
    t.createdAt?.toISOString() ?? '',
  ];
}

/**
 * Full sync of EVERY transaction into the master "CRM - Transactions" sheet.
 * Uses batch calls (one read, one batch update, one append) so it scales to
 * thousands of rows. Existing rows are refreshed in place; missing rows appended.
 */
export async function syncAllTransactionsToSheets(): Promise<{ updated: number; appended: number } | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const folderId = await ensureDriveFolder(accessToken);
  const sheetId = await ensureSpreadsheet(accessToken, folderId, 'CRM - Transactions', TRANSACTION_HEADERS);

  const transactions = await prisma.transaction.findMany({
    include: {
      contact: { select: { firstName: true, lastName: true } },
      deal: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const getRes = await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A:A`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const getData = await getRes.json();
  const existing: string[][] = getData?.values ?? [];
  const rowById = new Map<string, number>();
  existing.forEach((r, i) => {
    if (i > 0 && r?.[0]) rowById.set(r[0], i + 1);
  });

  const updates: { range: string; values: string[][] }[] = [];
  const appends: string[][] = [];
  for (const t of transactions) {
    const row = transactionRow(t as TransactionWithRelations);
    const rowNum = rowById.get(t.id);
    if (rowNum) updates.push({ range: `Sheet1!A${rowNum}:I${rowNum}`, values: [row] });
    else appends.push(row);
  }

  // Google Sheets API request size limits: send in chunks.
  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data: updates.slice(i, i + CHUNK) }),
    });
  }
  for (let i = 0; i < appends.length; i += CHUNK) {
    await fetch(`${GOOGLE_SHEETS_API}/${sheetId}/values/Sheet1!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: appends.slice(i, i + CHUNK) }),
    });
  }

  await prisma.googleOAuthToken.updateMany({ data: { lastSyncAt: new Date() } });
  return { updated: updates.length, appended: appends.length };
}
