import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { type Request, type Response, type NextFunction } from 'express';
import dotenv from 'dotenv';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

dotenv.config();

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseProjectId = '';
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    if (cfg?.projectId && cfg.projectId !== 'remixed-project-id') {
      firebaseProjectId = cfg.projectId;
    }
  } catch {
    // Ignore malformed config during boot
  }
}

const adminApp = firebaseProjectId
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId: firebaseProjectId })
  : null;

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
  };
}

async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication bearer token is required.' });
    return;
  }
  if (!adminApp) {
    res.status(500).json({ error: 'Firebase project configuration is missing on the server.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase authentication token.' });
  }
}

// Authoritative Shipping Policy Calculator
function calculateShippingServer(params: {
  city: string;
  state: string;
  subtotalNgn: number;
  settings?: {
    ibadanFreeShippingThresholdNgn?: number;
    ibadanStandardFeeNgn?: number;
    lagosFeeNgn?: number;
    oyoStateFeeNgn?: number;
    southWestFeeNgn?: number;
    otherStatesFeeNgn?: number;
    deliveryTargetDays?: number;
  };
}) {
  const subtotal = Math.max(0, Number(params.subtotalNgn) || 0);
  const cityNorm = (params.city || '').trim().toLowerCase();
  const stateNorm = (params.state || '').trim().toLowerCase();

  const threshold = Number(params.settings?.ibadanFreeShippingThresholdNgn ?? 2000000);
  const ibadanStandardFee = Number(params.settings?.ibadanStandardFeeNgn ?? 15000);
  const lagosFee = Number(params.settings?.lagosFeeNgn ?? 35000);
  const oyoStateFee = Number(params.settings?.oyoStateFeeNgn ?? 25000);
  const southWestFee = Number(params.settings?.southWestFeeNgn ?? 45000);
  const otherStatesFee = Number(params.settings?.otherStatesFeeNgn ?? 65000);
  const deliveryTargetDays = Number(params.settings?.deliveryTargetDays ?? 30);

  const isIbadan = cityNorm === 'ibadan' || cityNorm.includes('ibadan');
  const isLagos = cityNorm.includes('lagos') || stateNorm === 'lagos';
  const isOyo = stateNorm === 'oyo' || stateNorm === 'oyo state';
  const southWestStates = ['ogun', 'osun', 'ondo', 'ekiti', 'lagos', 'oyo'];
  const isSouthWest = southWestStates.some((s) => stateNorm.includes(s));

  // STRICT RULE: Free shipping applies ONLY within Ibadan AND strictly ABOVE ₦2,000,000.
  // Orders of exactly ₦2,000,000 do NOT qualify.
  if (isIbadan && subtotal > threshold) {
    return {
      city: params.city,
      state: params.state,
      subtotalNgn: subtotal,
      freeShippingApplied: true,
      shippingFeeNgn: 0,
      totalNgn: subtotal,
      reason: `Free Ibadan delivery unlocked (order strictly exceeds ₦${threshold.toLocaleString('en-NG')}).`,
      deliveryTargetDays,
    };
  }

  let shippingFeeNgn = otherStatesFee;
  let reason = 'Standard nationwide delivery charge.';

  if (isIbadan) {
    shippingFeeNgn = ibadanStandardFee;
    reason =
      subtotal === threshold
        ? `Orders of exactly ₦${threshold.toLocaleString('en-NG')} do not qualify for free Ibadan shipping (must exceed ₦${threshold.toLocaleString('en-NG')}).`
        : `Ibadan standard delivery charge (free shipping applies strictly above ₦${threshold.toLocaleString('en-NG')}).`;
  } else if (isLagos) {
    shippingFeeNgn = lagosFee;
    reason = 'Lagos interstate delivery fee (free shipping is restricted to qualifying Ibadan orders).';
  } else if (isOyo) {
    shippingFeeNgn = oyoStateFee;
    reason = 'Oyo State (outside Ibadan) delivery fee.';
  } else if (isSouthWest) {
    shippingFeeNgn = southWestFee;
    reason = 'South-West interstate delivery fee.';
  }

  return {
    city: params.city,
    state: params.state,
    subtotalNgn: subtotal,
    freeShippingApplied: false,
    shippingFeeNgn,
    totalNgn: subtotal + shippingFeeNgn,
    reason,
    deliveryTargetDays,
  };
}

// Authoritative Save to Buy Instalment Calculator
function calculateSaveToBuyServer(params: {
  totalOrderNgn: number;
  durationMonths: 3 | 6 | 9 | 12;
  rates?: Record<string, number>;
  depositPercent?: number;
  startDateIso?: string;
}) {
  const totalOrderNgn = Math.max(0, Math.round(Number(params.totalOrderNgn) || 0));
  const allowedDurations = [3, 6, 9, 12];
  const durationMonths = allowedDurations.includes(Number(params.durationMonths))
    ? (Number(params.durationMonths) as 3 | 6 | 9 | 12)
    : 3;

  const defaultRates: Record<number, number> = { 3: 0, 6: 12, 9: 18, 12: 24 };
  const configuredRate = params.rates?.[String(durationMonths)];
  const interestRatePercent =
    typeof configuredRate === 'number' && Number.isFinite(configuredRate) && configuredRate >= 0
      ? configuredRate
      : defaultRates[durationMonths];

  const depositPct = Number(params.depositPercent ?? 50);
  const initialDepositNgn = Math.round(totalOrderNgn * (depositPct / 100));
  const outstandingPrincipalNgn = Math.max(0, totalOrderNgn - initialDepositNgn);
  // Interest applies strictly to the outstanding balance after the 50% initial deposit
  const interestAmountNgn = Math.round(outstandingPrincipalNgn * (interestRatePercent / 100));
  const totalRepaymentNgn = outstandingPrincipalNgn + interestAmountNgn;
  const baseMonthly = Math.floor(totalRepaymentNgn / durationMonths);
  const remainder = totalRepaymentNgn - baseMonthly * durationMonths;

  const baseDate = params.startDateIso ? new Date(params.startDateIso) : new Date();
  const schedule = Array.from({ length: durationMonths }, (_, idx) => {
    const due = new Date(baseDate);
    due.setMonth(due.getMonth() + (idx + 1));
    const amountNgn = idx === durationMonths - 1 ? baseMonthly + remainder : baseMonthly;
    return {
      instalmentNumber: idx + 1,
      dueDateIso: due.toISOString(),
      amountNgn,
      lateFeeNgn: 0,
      status: 'pending' as const,
    };
  });

  return {
    totalOrderNgn,
    initialDepositNgn,
    outstandingPrincipalNgn,
    durationMonths,
    interestRatePercent,
    interestAmountNgn,
    totalRepaymentNgn,
    monthlyInstalmentNgn: Math.round(totalRepaymentNgn / durationMonths),
    schedule,
  };
}

// Authoritative Save to Buy Late Fee Calculator (7-day grace period, 1% weekly, max 5%, non-compounding)
function calculateLateFeeServer(params: {
  instalmentAmountNgn: number;
  dueDateIso: string;
  extensionDaysGranted?: number;
  referenceDateIso?: string;
}) {
  const due = new Date(params.dueDateIso);
  const ref = params.referenceDateIso ? new Date(params.referenceDateIso) : new Date();
  const extensionDays = Math.max(0, Number(params.extensionDaysGranted ?? 0));
  const graceDays = 7;

  const effectiveDue = new Date(due.getTime() + (graceDays + extensionDays) * 86400000);
  const msOverdue = ref.getTime() - effectiveDue.getTime();
  if (msOverdue <= 0) {
    return {
      isOverdue: false,
      overdueDays: 0,
      overdueWeeks: 0,
      lateFeePercent: 0,
      lateFeeNgn: 0,
      totalDueNgn: params.instalmentAmountNgn,
    };
  }
  const overdueDays = Math.ceil(msOverdue / 86400000);
  const overdueWeeks = Math.ceil(overdueDays / 7);
  // 1% per overdue week, capped at 5% of the overdue instalment, non-compounding
  const lateFeePercent = Math.min(5, overdueWeeks * 1);
  const lateFeeNgn = Math.round(params.instalmentAmountNgn * (lateFeePercent / 100));
  return {
    isOverdue: true,
    overdueDays,
    overdueWeeks,
    lateFeePercent,
    lateFeeNgn,
    totalDueNgn: params.instalmentAmountNgn + lateFeeNgn,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '16mb' }));

  // Health & External Integration Status (never returns secrets)
  app.get('/api/health', (_req: Request, res: Response) => {
    const cloudinaryConfigured = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
    const credablyConfigured = Boolean(
      process.env.CREDABLY_MERCHANT_ID && process.env.CREDABLY_API_KEY
    );

    res.json({
      ok: true,
      firebaseProjectConfigured: Boolean(firebaseProjectId),
      cloudinary: {
        configured: cloudinaryConfigured,
        missingEnv: cloudinaryConfigured
          ? []
          : ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
      },
      credably: {
        configured: credablyConfigured,
        baseUrl: process.env.CREDABLY_BASE_URL || 'https://api.credably.ng/v1',
        missingEnv: credablyConfigured
          ? []
          : ['CREDABLY_MERCHANT_ID', 'CREDABLY_API_KEY', 'CREDABLY_WEBHOOK_SECRET'],
      },
    });
  });

  // Authoritative Backend Financial Calculations
  app.post('/api/calculations/shipping', (req: Request, res: Response) => {
    const { city, state, subtotalNgn, settings } = req.body || {};
    if (typeof subtotalNgn !== 'number' || subtotalNgn < 0) {
      res.status(400).json({ error: 'Valid subtotalNgn is required.' });
      return;
    }
    res.json(calculateShippingServer({ city: city || '', state: state || '', subtotalNgn, settings }));
  });

  app.post('/api/calculations/save-to-buy', (req: Request, res: Response) => {
    const { totalOrderNgn, durationMonths, rates, depositPercent, startDateIso } = req.body || {};
    if (typeof totalOrderNgn !== 'number' || totalOrderNgn <= 0) {
      res.status(400).json({ error: 'Valid totalOrderNgn > 0 is required.' });
      return;
    }
    res.json(
      calculateSaveToBuyServer({
        totalOrderNgn,
        durationMonths,
        rates,
        depositPercent,
        startDateIso,
      })
    );
  });

  app.post('/api/calculations/late-fee', (req: Request, res: Response) => {
    const { instalmentAmountNgn, dueDateIso, extensionDaysGranted, referenceDateIso } = req.body || {};
    if (typeof instalmentAmountNgn !== 'number' || !dueDateIso) {
      res.status(400).json({ error: 'instalmentAmountNgn and dueDateIso are required.' });
      return;
    }
    res.json(
      calculateLateFeeServer({
        instalmentAmountNgn,
        dueDateIso,
        extensionDaysGranted,
        referenceDateIso,
      })
    );
  });

  // Secure Server-Side Cloudinary Upload Proxy (Receipts & Product Images)
  app.post('/api/cloudinary/upload', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      res.status(503).json({
        configured: false,
        error: 'Cloudinary server credentials are not configured.',
        missingEnv: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
      });
      return;
    }

    const { fileName, mimeType, base64Data, folder } = req.body || {};
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!fileName || !mimeType || !base64Data) {
      res.status(400).json({ error: 'fileName, mimeType, and base64Data are required.' });
      return;
    }
    if (!allowedMimes.includes(String(mimeType).toLowerCase())) {
      res.status(400).json({ error: 'Unsupported file type. Allowed formats: JPG, JPEG, PNG, PDF.' });
      return;
    }

    const cleanBase64 = String(base64Data).includes(',')
      ? String(base64Data).split(',')[1]
      : String(base64Data);
    const bufferSize = Buffer.byteLength(cleanBase64, 'base64');
    if (bufferSize <= 0 || bufferSize > 15 * 1024 * 1024) {
      res.status(400).json({ error: 'File must be between 1 byte and 15MB.' });
      return;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const targetFolder = folder === 'products' ? 'jimmy-electronics/products' : 'jimmy-electronics/receipts';
      const signaturePayload = `folder=${targetFolder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

      const dataUri = `data:${mimeType};base64,${cleanBase64}`;
      const formBody = new URLSearchParams({
        file: dataUri,
        api_key: apiKey,
        timestamp: String(timestamp),
        folder: targetFolder,
        signature,
      });

      const resourceType = mimeType === 'application/pdf' ? 'raw' : 'image';
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
      });

      const uploadJson = (await uploadRes.json()) as Record<string, unknown>;
      if (!uploadRes.ok) {
        res.status(uploadRes.status).json({
          error: (uploadJson?.error as { message?: string })?.message || 'Cloudinary upload rejected.',
        });
        return;
      }

      res.json({
        configured: true,
        url: uploadJson.secure_url,
        publicId: uploadJson.public_id,
        bytes: uploadJson.bytes,
        format: uploadJson.format,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to upload file to Cloudinary.',
      });
    }
  });

  // Credably BNPL Integration Endpoints (https://credably.ng/)
  app.get('/api/credably/status', (_req: Request, res: Response) => {
    const merchantId = process.env.CREDABLY_MERCHANT_ID;
    const apiKey = process.env.CREDABLY_API_KEY;
    const webhookSecret = process.env.CREDABLY_WEBHOOK_SECRET;
    const configured = Boolean(merchantId && apiKey);
    res.json({
      configured,
      baseUrl: process.env.CREDABLY_BASE_URL || 'https://api.credably.ng/v1',
      webhookConfigured: Boolean(webhookSecret),
      missingEnv: [
        ...(!merchantId ? ['CREDABLY_MERCHANT_ID'] : []),
        ...(!apiKey ? ['CREDABLY_API_KEY'] : []),
        ...(!webhookSecret ? ['CREDABLY_WEBHOOK_SECRET'] : []),
      ],
      providerWebsite: 'https://credably.ng/',
    });
  });

  app.post('/api/credably/initiate', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const merchantId = process.env.CREDABLY_MERCHANT_ID;
    const apiKey = process.env.CREDABLY_API_KEY;
    const baseUrl = process.env.CREDABLY_BASE_URL || 'https://api.credably.ng/v1';

    if (!merchantId || !apiKey) {
      res.status(503).json({
        configured: false,
        status: 'PENDING_CREDENTIALS',
        message:
          'Credably BNPL merchant credentials are not configured on the server. Live financing cannot be simulated.',
        missingEnv: ['CREDABLY_MERCHANT_ID', 'CREDABLY_API_KEY', 'CREDABLY_WEBHOOK_SECRET'],
        onboardingUrl: 'https://credably.ng/',
      });
      return;
    }

    const { orderRef, amountNgn, customerName, customerEmail, customerPhone, items, callbackUrl } = req.body || {};
    if (!orderRef || typeof amountNgn !== 'number' || amountNgn <= 0 || !customerEmail) {
      res.status(400).json({ error: 'orderRef, positive amountNgn, and customerEmail are required.' });
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/bnpl/applications/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Merchant-Id': merchantId,
        },
        body: JSON.stringify({
          merchantId,
          reference: orderRef,
          amount: amountNgn,
          currency: 'NGN',
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
          },
          items: Array.isArray(items) ? items : [],
          callbackUrl: callbackUrl || `${process.env.APP_URL || ''}/checkout/credably-callback`,
          webhookUrl: `${process.env.APP_URL || ''}/api/credably/webhook`,
        }),
      });

      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        res.status(response.status).json({
          configured: true,
          status: 'failed',
          error: (payload?.message as string) || 'Credably API rejected application initialization.',
          raw: payload,
        });
        return;
      }

      res.json({
        configured: true,
        status: (payload?.status as string) || 'pending',
        credablyReference: payload?.reference || payload?.transactionReference || orderRef,
        checkoutUrl: payload?.checkoutUrl || payload?.authorizationUrl || null,
        raw: payload,
      });
    } catch (err) {
      res.status(502).json({
        configured: true,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unable to reach Credably BNPL service.',
      });
    }
  });

  app.get('/api/credably/verify/:reference', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
    const merchantId = process.env.CREDABLY_MERCHANT_ID;
    const apiKey = process.env.CREDABLY_API_KEY;
    const baseUrl = process.env.CREDABLY_BASE_URL || 'https://api.credably.ng/v1';

    if (!merchantId || !apiKey) {
      res.status(503).json({
        configured: false,
        status: 'PENDING_CREDENTIALS',
        error: 'Credably merchant credentials are not configured.',
      });
      return;
    }

    const reference = String(req.params.reference || '').trim();
    if (!reference) {
      res.status(400).json({ error: 'Transaction reference is required.' });
      return;
    }

    try {
      const verifyRes = await fetch(`${baseUrl}/bnpl/transactions/verify/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Merchant-Id': merchantId,
        },
      });
      const payload = (await verifyRes.json()) as Record<string, unknown>;
      res.status(verifyRes.status).json({
        configured: true,
        reference,
        status: payload?.status || 'pending',
        settlementStatus: payload?.settlementStatus || 'unsettled',
        payload,
      });
    } catch (err) {
      res.status(502).json({
        configured: true,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Credably verification failed.',
      });
    }
  });

  app.post('/api/credably/webhook', (req: Request, res: Response) => {
    const webhookSecret = process.env.CREDABLY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      res.status(503).json({ error: 'CREDABLY_WEBHOOK_SECRET is not configured.' });
      return;
    }
    const signature = String(req.headers['x-credably-signature'] || '');
    const computed = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    if (!signature || signature.length !== computed.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))) {
      res.status(401).json({ error: 'Invalid Credably webhook signature.' });
      return;
    }

    // Verified Credably webhook event acknowledged
    res.json({ received: true, event: req.body?.event || 'unknown' });
  });

  // Vite dev middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JIMMY ELECTRONICS | MIND J-E MULTI CONCEPT server running on port ${PORT}`);
  });
}

startServer();
