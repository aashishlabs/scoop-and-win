import { NextResponse } from 'next/server';
import { readFullSheetState } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await readFullSheetState();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to read Google Sheet' },
      { status: 500 }
    );
  }
}
