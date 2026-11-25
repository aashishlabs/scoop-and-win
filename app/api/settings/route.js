import { NextResponse } from 'next/server';
import { readFullSheetState, saveSettingsToSheet } from '@/lib/googleSheets';

export async function POST(request) {
  try {
    const body = await request.json();
    const pin = String(body.staff_pin || '').replace(/\D/g, '');
    const referralRewardText = String(body.referral_reward_text || 'Free ₹100 Cone').trim();
    const campaignActive = Boolean(body.campaign_active);

    if (pin.length !== 4) {
      return NextResponse.json({ ok: false, error: 'Staff PIN must be exactly 4 digits.' }, { status: 400 });
    }

    const nextSettings = {
      staff_pin: pin,
      campaign_active: campaignActive,
      referral_reward_text: referralRewardText,
    };

    await saveSettingsToSheet(nextSettings);
    const updatedSheet = await readFullSheetState();
    return NextResponse.json({ ok: true, data: updatedSheet });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to update Google Sheet settings' },
      { status: 500 }
    );
  }
}
