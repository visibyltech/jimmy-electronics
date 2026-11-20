# JIMMY ELECTRONICS | MIND J-E MULTI CONCEPT — Deployment & API Integration Guide

## 1. Architecture Overview
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Vite (`src/`)
- **Backend Server**: Express (`server.ts`) handling:
  - Authoritative Shipping Eligibility Engine (`POST /api/calculations/shipping`)
  - Authoritative Save to Buy Instalment & Late Fee Engine (`POST /api/calculations/save-to-buy`, `POST /api/calculations/late-fee`)
  - Cloudinary Signed Upload Proxy (`POST /api/cloudinary/upload`) for payment receipts (`JPG/JPEG/PNG/PDF`) and product images
  - Credably BNPL Merchant Integration & Webhook Verification (`GET /api/credably/status`, `POST /api/credably/initiate`, `GET /api/credably/verify/:reference`, `POST /api/credably/webhook`)
- **Database & Auth**: Firebase Authentication + Cloud Firestore (`firebase-applet-config.json`, `firestore.rules`, `firebase-blueprint.json`)

---

## 2. Environment Variables (`.env`)
Configure the following server-side secrets in your hosting environment (do **NOT** prefix secret keys with `VITE_`):

```env
# Cloudinary (Required for live receipt & product image uploads)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"

# Credably BNPL Merchant Integration (https://credably.ng/)
CREDABLY_BASE_URL="https://api.credably.ng/v1"
CREDABLY_MERCHANT_ID="your_credably_merchant_id"
CREDABLY_API_KEY="your_credably_secret_api_key"
CREDABLY_WEBHOOK_SECRET="your_credably_webhook_signing_secret"

# Application URL (used for Credably webhook & callback URLs)
APP_URL="https://your-production-domain.com"
```

---

## 3. Firebase Authentication Setup
1. **Google Sign-In**: Already provisioned and active.
2. **Email/Password Registration & Password Reset**:
   - Open [Firebase Console](https://console.firebase.google.com/) → Select your project (`gen-lang-client-0087310115`) → **Authentication** → **Sign-in method**.
   - Click **Add new provider** → Enable **Email/Password** and save.
   - Note: `firestore.rules` enforces `request.auth.token.email_verified == true` on customer writes. Newly registered email/password users automatically receive a verification email (`sendEmailVerification`) and can click "Check Verified" in their Account dashboard once confirmed.

---

## 4. Administrator Access & Seeding the Catalogue
- Bootstrapped administrator emails in `firestore.rules`:
  - `mindjemulticoncept@gmail.com`
  - `usitakatelvin@gmail.com`
- Additional administrators can be granted access by adding a document in `/admins/{uid}` (`{ uid, email, grantedAt }`) from a bootstrapped admin session.
- **Catalogue Seeding**: Sign in as an administrator, open the **Admin** dashboard, and click **Sync Full 44-Product Catalogue** to write all 11 categories, 12 brands, default shipping/Save-to-Buy settings, and 44 initial products into Firestore. You can also batch-upload additional products using **Bulk Product Import (CSV / JSON)**.

---

## 5. Business Rules Enforced by Backend & Firestore Rules
- **Bank Transfer Details**: Zenith Bank · Account Name: `MIND J-E MULTI CONCEPT` · Account Number: `1310307892`.
- **Shipping Policy**:
  - Free shipping applies **ONLY** within **Ibadan** when order subtotal is **strictly above ₦2,000,000** (`subtotal > 2000000`).
  - Orders of exactly `₦2,000,000` do **not** qualify.
  - Regional fees for Ibadan (≤ ₦2M), Lagos, Oyo State, South-West, and Other States are configurable in Admin → Shipping & Rates.
  - Standard delivery target: **Within 30 days**.
- **Save to Buy Instalment Engine**:
  - 50% initial deposit required.
  - Interest rates apply strictly to the remaining 50% balance: `3 months (0%)`, `6 months (12%)`, `9 months (18%)`, `12 months (24%)` — configurable by admin.
  - Default policy: 7-day grace period, 1% weekly non-compounding late fee capped at 5% of the overdue instalment, with admin-approved extensions supported.
  - Products are not released until full payment is received and verified.
- **Credably BNPL (`https://credably.ng/`)**:
  - Set Credably merchant credentials (`CREDABLY_MERCHANT_ID`, `CREDABLY_API_KEY`, `CREDABLY_WEBHOOK_SECRET`) and register `${APP_URL}/api/credably/webhook` in your Credably merchant portal.

---

## 6. Build & Production Start
```bash
npm install
npm run build
NODE_ENV=production npm start
```
