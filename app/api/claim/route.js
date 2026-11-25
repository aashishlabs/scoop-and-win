import { NextResponse } from 'next/server';
import {
  appendCouponRows,
  appendCustomerRow,
  formatISTTimestamp,
  generateUniqueRefCode,
  getTodayISTDate,
  readFullSheetState,
} from '@/lib/googleSheets';

export async function POST(request) {
  try {
    const body = await request.json();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const name = String(body.name || '').trim().slice(0, 24);
    const enteredRef = String(body.referralCode || '').trim().toUpperCase();
    const rewardLabel = String(body.rewardLabel || 'Free Waffle Cone Upgrade or Topping').trim();

    if (phone.length !== 10) {
      return NextResponse.json({ ok: false, error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }

    const sheet = await readFullSheetState();

    if (!sheet.Settings.campaign_active) {
      return NextResponse.json({ ok: false, error: 'Campaign is currently paused by the store owner.' }, { status: 403 });
    }

    const today = getTodayISTDate();
    const playedToday = sheet.Coupons.some(
      (c) => c.user_phone === phone && c.type === 'GAME_REWARD' && (c.unlocked_at || '').startsWith(today)
    );
    if (playedToday) {
      return NextResponse.json(
        { ok: false, alreadyPlayedToday: true, error: 'Daily limit reached (1 game reward per mobile number per day).' },
        { status: 409 }
      );
    }

    let referrer = null;
    if (enteredRef) {
      referrer = sheet.Customers.find((c) => c.my_ref_code === enteredRef) || null;
      if (referrer && referrer.phone === phone) {
        return NextResponse.json({ ok: false, error: 'Self-referral is not permitted.' }, { status: 400 });
      }
    }

    const nowIST = formatISTTimestamp();
    let customer = sheet.Customers.find((c) => c.phone === phone);
    const isBrandNewUser = !customer;

    if (isBrandNewUser) {
      customer = {
        phone,
        name,
        my_ref_code: generateUniqueRefCode(sheet.Customers),
        referred_by_phone: referrer ? referrer.phone : '',
        joined_at: nowIST,
      };
      await appendCustomerRow(customer);
    }

    const nextNum = 1001 + sheet.Coupons.length;
    const newCoupons = $$\n      {\n        coupon_id: `CPN-${nextNum}`,\n        user_phone: phone,\n        type: 'GAME_REWARD',\n        reward_label: rewardLabel,\n        status: 'UNLOCKED',\n        triggered_by_phone: '',\n        unlocked_at: nowIST,\n        redeemed_at: '',\n      },\n    $$;

    if (isBrandNewUser && referrer) {
      newCoupons.push({
        coupon_id: CPN-${nextNum + 1},
        user_phone: referrer.phone,
        type: 'REFERRAL_CONE',
        reward_label: sheet.Settings.referral_reward_text || 'Free ₹100 Cone',
        status: 'PENDING',
        triggered_by_phone: phone,
        unlocked_at: '',
        redeemed_at: '',
      });
    }

    await appendCouponRows(newCoupons);
    const updatedSheet = await readFullSheetState();

    return NextResponse.json({ ok: true, customer, data: updatedSheet });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to claim reward in Google Sheet' },
      { status: 500 }
    );
  }
}
