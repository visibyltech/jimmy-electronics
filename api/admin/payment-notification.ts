import crypto from 'node:crypto';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'jimmy-electronics';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache: { expiresAt: number; certs: Record<string, string> } | null = null;

async function verifyAdminToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid token');
  if (!certCache || certCache.expiresAt <= Date.now()) {
    const response = await fetch(CERTS_URL);
    if (!response.ok) throw new Error('Token verification unavailable');
    const certs = await response.json() as Record<string, string>;
    const maxAge = Number((response.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 300);
    certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  }
  const cert = certCache.certs[header.kid];
  if (!cert || !crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), cert, Buffer.from(parts[2], 'base64url'))) throw new Error('Invalid signature');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID || payload.iss !== 'https://securetoken.google.com/' + PROJECT_ID ||
      !payload.sub || !payload.exp || payload.exp <= now || !payload.iat || payload.iat > now) throw new Error('Expired token');
  if (payload.email !== 'mindjemulticoncept@gmail.com' && payload.email !== 'usitakatelvin@gmail.com') throw new Error('Not an administrator');
  return payload;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const bearer = String(req.headers.authorization || '');
  if (!bearer.startsWith('Bearer ')) return res.status(401).json({ error: 'Administrator sign-in required.' });
  try {
    await verifyAdminToken(bearer.slice(7));
  } catch {
    return res.status(403).json({ error: 'Administrator session could not be verified.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(503).json({ sent: false, error: 'Email notifications are not configured yet. Add RESEND_API_KEY to Vercel.' });

  const body = req.body || {};
  const orderRef = String(body.orderRef || '').slice(0, 100);
  const customerName = String(body.customerName || '').slice(0, 160);
  const customerEmail = String(body.customerEmail || '').slice(0, 200);
  const amountNgn = Number(body.amountNgn);
  const method = String(body.method || '').slice(0, 80);
  const referenceCode = String(body.referenceCode || '').slice(0, 120);
  if (!orderRef || !Number.isFinite(amountNgn) || amountNgn <= 0) return res.status(400).json({ error: 'Payment details are incomplete.' });

  const to = process.env.ADMIN_NOTIFICATION_EMAIL || 'mindjemulticoncept@gmail.com';
  const from = process.env.RESEND_FROM_EMAIL || 'Jimmy Electronics <onboarding@resend.dev>';
  const html = `<div style="font-family:Arial,sans-serif;color:#17191d;max-width:600px;margin:auto"><h2>Payment confirmed</h2><p>A payment has been approved in the Jimmy Electronics admin dashboard.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;border-bottom:1px solid #ddd">Order</td><td style="padding:8px;border-bottom:1px solid #ddd"><b>${escapeHtml(orderRef)}</b></td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd">Customer</td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(customerName)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd">Customer email</td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(customerEmail)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd">Amount</td><td style="padding:8px;border-bottom:1px solid #ddd">₦${amountNgn.toLocaleString('en-NG')}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #ddd">Method</td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(method)}</td></tr><tr><td style="padding:8px">Reference</td><td style="padding:8px">${escapeHtml(referenceCode)}</td></tr></table><p>Open the admin dashboard to review the order and receipt.</p></div>`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: 'Payment confirmed — ' + orderRef, html }),
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) return res.status(502).json({ sent: false, error: String(result.message || 'Email provider rejected the notification.') });
    return res.status(200).json({ sent: true });
  } catch {
    return res.status(502).json({ sent: false, error: 'Could not reach the email provider.' });
  }
}
