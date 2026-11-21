import { auth } from './firebase';
import type { SaveToBuyCalculation, ShippingCalculation, StoreSettings } from '../types';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return { 'Content-Type': 'application/json' };
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchServerHealth(): Promise<{
  ok: boolean;
  firebaseProjectConfigured: boolean;
  cloudinary: { configured: boolean; missingEnv: string[] };
  credably: { configured: boolean; baseUrl: string; missingEnv: string[] };
}> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Unable to fetch backend health status.');
  return res.json();
}

export async function calculateShippingApi(params: {
  city: string;
  state: string;
  subtotalNgn: number;
  settings?: Partial<StoreSettings>;
}): Promise<ShippingCalculation> {
  const res = await fetch('/api/calculations/shipping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Shipping calculation failed.');
  return data;
}

export async function calculateSaveToBuyApi(params: {
  totalOrderNgn: number;
  durationMonths: 3 | 6 | 9 | 12;
  rates?: Record<string, number>;
  depositPercent?: number;
}): Promise<SaveToBuyCalculation> {
  const res = await fetch('/api/calculations/save-to-buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Save to Buy calculation failed.');
  return data;
}

export async function calculateLateFeeApi(params: {
  instalmentAmountNgn: number;
  dueDateIso: string;
  extensionDaysGranted?: number;
}): Promise<{
  isOverdue: boolean;
  overdueDays: number;
  overdueWeeks: number;
  lateFeePercent: number;
  lateFeeNgn: number;
  totalDueNgn: number;
}> {
  const res = await fetch('/api/calculations/late-fee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Late fee calculation failed.');
  return data;
}

export interface CloudinaryUploadResult {
  configured: boolean;
  url?: string;
  publicId?: string;
  bytes?: number;
  format?: string;
  error?: string;
  missingEnv?: string[];
}

export async function uploadFileToCloudinary(params: {
  fileName: string;
  mimeType: string;
  base64Data: string;
  folder: 'receipts' | 'products';
}): Promise<CloudinaryUploadResult> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/cloudinary/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const responseText = await res.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Image upload service returned an unexpected response (${res.status}). Please retry; if it continues, contact the administrator.`);
  }
  if (!res.ok) {
    return {
      configured: data?.configured ?? false,
      error: data?.error || 'Cloudinary upload failed.',
      missingEnv: data?.missingEnv,
    };
  }
  return data;
}

export interface CredablyStatusResult {
  configured: boolean;
  baseUrl: string;
  webhookConfigured: boolean;
  missingEnv: string[];
  providerWebsite: string;
}

export async function fetchCredablyStatus(): Promise<CredablyStatusResult> {
  const res = await fetch('/api/credably/status');
  if (!res.ok) throw new Error('Unable to check Credably BNPL service status.');
  return res.json();
}

export async function initiateCredablyApplication(params: {
  orderRef: string;
  amountNgn: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{ name: string; sku: string; quantity: number; unitPriceNgn: number }>;
}): Promise<{
  configured: boolean;
  status: string;
  credablyReference?: string;
  checkoutUrl?: string | null;
  message?: string;
  error?: string;
  missingEnv?: string[];
  onboardingUrl?: string;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/credably/initiate', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function verifyCredablyTransaction(reference: string): Promise<{
  configured: boolean;
  reference?: string;
  status: string;
  settlementStatus?: string;
  error?: string;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/credably/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers,
  });
  return res.json();
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}
