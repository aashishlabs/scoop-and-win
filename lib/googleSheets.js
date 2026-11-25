import { google } from 'googleapis';

const DEFAULT_SETTINGS = {
  staff_pin: process.env.STAFF_PIN || '2580',
  campaign_active: true,
  referral_reward_text: 'Free ₹100 Cone',
};

function getAppsScriptUrl() {
  return String(process.env.APPS_SCRIPT_URL || '').trim();
}

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !rawKey || !sheetId) {
    throw new Error(
      'Missing Google Sheets configuration. Set APPS_SCRIPT_URL (recommended) or GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEET_ID.'
    );
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return {
    sheets: google.sheets({ version: 'v4', auth }),
    sheetId,
  };
}

export function formatISTTimestamp(date = new Date()) {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const pad = (n) => String(n).padStart(2, '0');
  return `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())} ${pad(istDate.getHours())}:${pad(istDate.getMinutes())}:${pad(istDate.getSeconds())}`;
}

export function getTodayISTDate() {
  return formatISTTimestamp().slice(0, 10);
}

export function generateUniqueRefCode(existingCustomers = []) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const used = new Set(existingCustomers.map((c) => c.my_ref_code));
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (used.has(code));
  return code;
}

async function callAppsScript(payload) {
  const url = getAppsScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
    cache: 'no-store',
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Apps Script returned non-JSON response: ${text.slice(0, 160)}`);
  }

  if (!res.ok || parsed.ok === false) {
    throw new Error(parsed.error || 'Apps Script request failed');
  }

  return parsed;
}

function normalizeSheetState(raw = {}) {
  const Customers = (Array.isArray(raw.Customers) ? raw.Customers : [])
    .filter((row) => row && row.phone)
    .map((row) => ({
      phone: String(row.phone || '').trim(),
      name: String(row.name || '').trim(),
      my_ref_code: String(row.my_ref_code || '').trim().toUpperCase(),
      referred_by_phone: String(row.referred_by_phone || '').trim(),
      joined_at: String(row.joined_at || '').trim(),
    }));

  const Coupons = (Array.isArray(raw.Coupons) ? raw.Coupons : [])
    .filter((row) => row && row.coupon_id)
    .map((row) => ({
      coupon_id: String(row.coupon_id || '').trim(),
      user_phone: String(row.user_phone || '').trim(),
      type: String(row.type || 'GAME_REWARD').trim(),
      reward_label: String(row.reward_label || '').trim(),
      status: String(row.status || 'UNLOCKED').trim(),
      triggered_by_phone: String(row.triggered_by_phone || '').trim(),
      unlocked_at: String(row.unlocked_at || '').trim(),
      redeemed_at: String(row.redeemed_at || '').trim(),
    }));

  const rawSettings = raw.Settings || {};
  const Settings = {
    staff_pin: String(rawSettings.staff_pin || DEFAULT_SETTINGS.staff_pin).trim(),
    campaign_active:
      rawSettings.campaign_active !== undefined
        ? String(rawSettings.campaign_active).toUpperCase() !== 'FALSE' &&
        rawSettings.campaign_active !== false
        : DEFAULT_SETTINGS.campaign_active,
    referral_reward_text: String(
      rawSettings.referral_reward_text || DEFAULT_SETTINGS.referral_reward_text
    ).trim(),
  };

  return { Customers, Coupons, Settings };
}

export async function readFullSheetState() {
  if (getAppsScriptUrl()) {
    const res = await callAppsScript({ action: 'readAll' });
    return normalizeSheetState(res.data || res);
  }

  const { sheets, sheetId } = getSheetsClient();

  const [custRes, coupRes, setRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Customers!A2:E' }).catch(() => ({ data: { values: [] } })),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Coupons!A2:H' }).catch(() => ({ data: { values: [] } })),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Settings!A2:B10' }).catch(() => ({ data: { values: [] } })),
  ]);

  const Customers = (custRes.data.values || [])
    .filter((row) => row && row[0])
    .map((row) => ({
      phone: String(row[0] || '').trim(),
      name: String(row[1] || '').trim(),
      my_ref_code: String(row[2] || '').trim().toUpperCase(),
      referred_by_phone: String(row[3] || '').trim(),
      joined_at: String(row[4] || '').trim(),
    }));

  const Coupons = (coupRes.data.values || [])
    .filter((row) => row && row[0])
    .map((row) => ({
      coupon_id: String(row[0] || '').trim(),
      user_phone: String(row[1] || '').trim(),
      type: String(row[2] || 'GAME_REWARD').trim(),
      reward_label: String(row[3] || '').trim(),
      status: String(row[4] || 'UNLOCKED').trim(),
      triggered_by_phone: String(row[5] || '').trim(),
      unlocked_at: String(row[6] || '').trim(),
      redeemed_at: String(row[7] || '').trim(),
    }));

  const Settings = { ...DEFAULT_SETTINGS };
  for (const row of setRes.data.values || []) {
    const key = String(row[0] || '').trim();
    const val = row[1];
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
  if (getAppsScriptUrl()) {
    await callAppsScript({ action: 'appendCustomer', customer });
    return;
  }

  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Customers!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        customer.phone,
        customer.name || '',
        customer.my_ref_code,
        customer.referred_by_phone || '',
        customer.joined_at,
      ]],
    },
  });
}

export async function appendCouponRows(coupons) {
  if (!coupons.length) return;

  if (getAppsScriptUrl()) {
    await callAppsScript({ action: 'appendCoupons', coupons });
    return;
  }

  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Coupons!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: coupons.map((cp) => [
        cp.coupon_id,
        cp.user_phone,
        cp.type,
        cp.reward_label,
        cp.status,
        cp.triggered_by_phone || '',
        cp.unlocked_at || '',
        cp.redeemed_at || '',
      ]),
    },
  });
}

export async function syncAllCouponsToSheet(coupons) {
  if (getAppsScriptUrl()) {
    await callAppsScript({ action: 'syncCoupons', coupons });
    return;
  }

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
        values: coupons.map((cp) => [
          cp.coupon_id,
          cp.user_phone,
          cp.type,
          cp.reward_label,
          cp.status,
          cp.triggered_by_phone || '',
          cp.unlocked_at || '',
          cp.redeemed_at || '',
        ]),
      },
    });
  }
}

export async function saveSettingsToSheet(settings) {
  if (getAppsScriptUrl()) {
    await callAppsScript({ action: 'saveSettings', settings });
    return;
  }

  const { sheets, sheetId } = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Settings!A2:B4',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        ['staff_pin', String(settings.staff_pin)],
        ['campaign_active', settings.campaign_active ? 'TRUE' : 'FALSE'],
        ['referral_reward_text', String(settings.referral_reward_text)],
      ],
    },
  });
}