import crypto from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const config = {
  api: {
    bodyParser: { sizeLimit: '16mb' },
  },
};

const firebaseApp = getApps()[0] || initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'jimmy-electronics',
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in again before uploading.' });
  }

  try {
    await getAuth(firebaseApp).verifyIdToken(authHeader.slice(7));
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Image uploads are temporarily unavailable. Please contact the store administrator.' });
  }

  const { fileName, mimeType, base64Data, folder } = req.body || {};
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!fileName || !mimeType || !base64Data || !allowedMimes.includes(String(mimeType).toLowerCase())) {
    return res.status(400).json({ error: 'Choose a JPG, PNG or WEBP image.' });
  }

  const cleanBase64 = String(base64Data).includes(',')
    ? String(base64Data).split(',')[1]
    : String(base64Data);
  const bufferSize = Buffer.byteLength(cleanBase64, 'base64');
  if (!bufferSize || bufferSize > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image must be 10MB or smaller.' });
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const targetFolder = folder === 'receipts' ? 'jimmy-electronics/receipts' : 'jimmy-electronics/products';
    const signature = crypto
      .createHash('sha1')
      .update(`folder=${targetFolder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const form = new URLSearchParams({
      file: `data:${mimeType};base64,${cleanBase64}`,
      api_key: apiKey,
      timestamp: String(timestamp),
      folder: targetFolder,
      signature,
    });

    const upload = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const payload = await upload.json() as Record<string, any>;
    if (!upload.ok) {
      return res.status(502).json({
        error: payload?.error?.message || 'The image service rejected this upload. Please try another image.',
      });
    }

    return res.status(200).json({
      configured: true,
      url: payload.secure_url,
      publicId: payload.public_id,
      bytes: payload.bytes,
      format: payload.format,
    });
  } catch {
    return res.status(502).json({ error: 'The image could not be uploaded. Please check your connection and try again.' });
  }
}
