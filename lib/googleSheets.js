import { google } from 'googleapis';

const DEFAULT_SETTINGS = {
  staff_pin: process.env.STAFF_PIN || '2580',
  campaign_active: true,
  referral_reward_text: 'Free ₹100 Cone',
};

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !rawKey || !sheetId) {
    throw new Error('Missing Google Sheets environment variables.');
  }

  const privateKey = rawKey.replace(/\n/g, '
');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: $$'https://www.googleapis.com/auth/spreadsheets'$$,
  });

  return {
    sheets: google.sheets({ version: 'v4', auth }),
    sheetId,
  };
}

export function formatISTTimestamp(date = new Date()) {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const pad = (n) => String(n).padStart(2, '0');
  return ${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())} ${pad(istDate.getHours())}:${pad(istDate.getMinutes())}:${pad(istDate.getSeconds())};
}

export function getTodayISTDate() {
  return formatISTTimestamp().slice(0, 10);
}

export function generateUniqueRefCode(existingCustomers = ) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const used = new Set(existingCustomers.map((c) => c.my_ref_code));
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars$$Math.floor(Math.random() \* chars.length)$$;
    }
  } while (used.has(code));
  return code;
}

export async function readFullSheetState() {
  const { sheets, sheetId } = getSheetsClient();

  const $$custRes, coupRes, setRes$$ = await Promise.all($$\n    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Customers!A2:E' }).catch(() => ({ data: { values: \[$$ } })),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Coupons!A2:H' }).catch(() => ({ data: { values:  } })),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Settings!A2:B10' }).catch(() => ({ data: { values:  } })),
  ]);

  const Customers = (custRes.data.values || )
    .filter((row) => row && row$$0$$)
    .map((row) => ({
      phone: String(row$$0$$ || '').trim(),
      name: String(row$$1$$ || '').trim(),
      my_ref_code: String(row$$2$$ || '').trim().toUpperCase(),
      referred_by_phone: String(row$$3$$ || '').trim(),
      joined_at: String(row$$4$$ || '').trim(),
    }));

  const Coupons = (coupRes.data.values || )
    .filter((row) => row && row$$0$$)
    .map((row) => ({
      coupon_id: String(row$$0$$ || '').trim(),
      user_phone: String(row$$1$$ || '').trim(),
      type: String(row$$2$$ || 'GAME_REWARD').trim(),
      reward_label: String(row$$3$$ || '').trim(),
      status: String(row$$4$$ || 'UNLOCKED').trim(),
      triggered_by_phone: String(row$$5$$ || '').trim(),
      unlocked_at: String(row$$6$$ || '').trim(),
      redeemed_at: String(row$$7$$ || '').trim(),
    }));

  const Settings = { ...DEFAULT_SETTINGS };
  for (const row of setRes.data.values || ) {
    const key = String(row$$0$$ || '').trim();
    const val = row$$1$$;
    if (key === 'staff_pin' && val) Settings.staff_pin = String(val).trim();
    if (key === 'campaign_active' && val !== undefined) {
      Settings.campaign_active = String(val).toUpperCase() !== 'FALSE';
    }
    if (key === 'referral_reward_text' && val) {
      Settings.referral_reward_text = String(val).trim();
    }
  }

  return { Customers, Coupons, Settings };
}

export async function appendCustomerRow(customer) {
  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Customers!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: $$\[\n        customer.phone,\n        customer.name || '',\n        customer.my_ref_code,\n        customer.referred_by_phone || '',\n        customer.joined_at,\n      $$],
    },
  });
}

export async function appendCouponRows(coupons) {
  if (!coupons.length) return;
  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Coupons!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: coupons.map((cp) => $$\n        cp.coupon_id,\n        cp.user_phone,\n        cp.type,\n        cp.reward_label,\n        cp.status,\n        cp.triggered_by_phone || '',\n        cp.unlocked_at || '',\n        cp.redeemed_at || '',\n      $$),
    },
  });
}

export async function syncAllCouponsToSheet(coupons) {
  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: 'Coupons!A2:H5000',
  });
  if (coupons.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Coupons!A2',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: coupons.map((cp) => $$\n          cp.coupon_id,\n          cp.user_phone,\n          cp.type,\n          cp.reward_label,\n          cp.status,\n          cp.triggered_by_phone || '',\n          cp.unlocked_at || '',\n          cp.redeemed_at || '',\n        $$),
      },
    });
  }
}

export async function saveSettingsToSheet(settings) {
  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Settings!A2:B4',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: $$\n        \['staff_pin', String(settings.staff_pin)$$,
        $$'campaign_active', settings.campaign_active ? 'TRUE' : 'FALSE'$$,
        $$'referral_reward_text', String(settings.referral_reward_text)$$,
      ],
    },
  });
}
