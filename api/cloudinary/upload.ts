import crypto from 'node:crypto';

export const config = {
  api: { bodyParser: { sizeLimit: '4.5mb' } },
};

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'jimmy-electronics';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache: { expiresAt: number; certs: Record<string, string> } | null = null;

async function getFirebaseCerts() {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;
  const response = await fetch(CERTS_URL);
  if (!response.ok) throw new Error('Could not retrieve Firebase token verification certificates.');
  const certs = await response.json() as Record<string, string>;
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 300);
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

async function verifyFirebaseToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed Firebase token.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported token signature.');
  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Unknown Firebase signing key.');
  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(parts[0] + '.' + parts[1]),
    cert,
    Buffer.from(parts[2], 'base64url'),
  );
  const now = Math.floor(Date.now() / 1000);
  if (!valid || payload.aud !== FIREBASE_PROJECT_ID ||
      payload.iss !== 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID ||
      !payload.sub || payload.sub.length > 128 || !payload.exp || payload.exp <= now ||
      !payload.iat || payload.iat > now || !payload.auth_time || payload.auth_time > now) {
    throw new Error('Invalid or expired Firebase session.');
  }
  return payload as { email?: string; sub: string };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ configured: false, error: 'Please sign in again before uploading.' });
  }

  let user: { email?: string; sub: string };
  try {
    user = await verifyFirebaseToken(authHeader.slice(7));
  } catch {
    return res.status(401).json({ configured: false, error: 'Your sign-in session could not be verified. Sign in again and retry.' });
  }

  const { fileName, mimeType, base64Data, folder } = req.body || {};
  if (folder !== 'receipts' && folder !== 'products') {
    return res.status(400).json({ configured: false, error: 'Invalid upload destination.' });
  }
  if (folder === 'products' && user.email !== 'mindjemulticoncept@gmail.com' && user.email !== 'usitakatelvin@gmail.com') {
    return res.status(403).json({ configured: false, error: 'Only an authorised store administrator can upload product images.' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({
      configured: false,
      error: 'Cloudinary is not fully connected to the live website. The Cloudinary API secret must be added to the Vercel project.',
      missingEnv: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].filter((key) => !process.env[key]),
    });
  }

  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  if (!fileName || !mimeType || !base64Data || !allowedMimes.includes(String(mimeType).toLowerCase()) || (folder === 'products' && mimeType === 'application/pdf')) {
    return res.status(400).json({ configured: true, error: folder === 'products' ? 'Choose a JPG, PNG or WebP product image.' : 'Choose a JPG, PNG, WebP or PDF payment receipt.' });
  }

  const cleanBase64 = String(base64Data).includes(',') ? String(base64Data).split(',')[1] : String(base64Data);
  const bytes = Buffer.from(cleanBase64, 'base64');
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) {
    return res.status(400).json({ configured: true, error: 'Each image must be 3MB or less.' });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const isProductImage = folder === 'products';
  const targetFolder = isProductImage ? 'jimmy-electronics/products' : 'jimmy-electronics/receipts';
  const resourceType = mimeType === 'application/pdf' ? 'raw' : 'image';
  const signature = crypto.createHash('sha1')
    .update(`folder=${targetFolder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');
  const form = new URLSearchParams({
    file: `data:${mimeType};base64,${cleanBase64}`,
    api_key: apiKey,
    timestamp: String(timestamp),
    folder: targetFolder,
    signature,
  });

  try {
    const upload = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const result = await upload.json() as Record<string, any>;
    if (!upload.ok || !result.secure_url) {
      return res.status(502).json({ configured: true, error: result.error?.message || 'Cloudinary could not save this image. Please retry.' });
    }
    return res.status(200).json({
      configured: true,
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
      format: result.format,
    });
  } catch {
    return res.status(502).json({ configured: true, error: 'Could not reach Cloudinary. Check your connection and retry.' });
  }
}
