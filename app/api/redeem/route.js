import { NextResponse } from 'next/server';
import { formatISTTimestamp, readFullSheetState, syncAllCouponsToSheet } from '@/lib/googleSheets';

export async function POST(request) {
  try {
    const body = await request.json();
    const couponId = String(body.couponId || '').trim();
    const pin = String(body.pin || '').trim();

    const sheet = await readFullSheetState();
    if (pin !== String(sheet.Settings.staff_pin)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid Staff PIN. Please check Owner Sheet Settings.' },
        { status: 401 }
      );
    }

    const target = sheet.Coupons.find((c) => c.coupon_id === couponId);
    if (!target || target.status !== 'UNLOCKED') {
      return NextResponse.json(
        { ok: false, error: 'Coupon is not active or already redeemed.' },
        { status: 400 }
      );
    }

    const nowIST = formatISTTimestamp();
    target.status = 'REDEEMED';
    target.redeemed_at = nowIST;

    let unlockedReferrerMsg = '';
    const pendingRef = sheet.Coupons.find(
      (c) => c.triggered_by_phone === target.user_phone && c.status === 'PENDING'
    );
    if (pendingRef) {
      pendingRef.status = 'UNLOCKED';
      pendingRef.unlocked_at = nowIST;
      unlockedReferrerMsg = ` & unlocked ${pendingRef.reward_label} for referrer!`;
    }

    await syncAllCouponsToSheet(sheet.Coupons);
    const updatedSheet = await readFullSheetState();

    return NextResponse.json({
      ok: true,
      message: `Coupon ${couponId} redeemed${unlockedReferrerMsg}`,
      data: updatedSheet,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to redeem coupon in Google Sheet' },
      { status: 500 }
    );
  }
}