import React, { useState } from 'react';
import { Phone, Mail, MapPin, Landmark, CheckCircle2 } from 'lucide-react';
import { STORE_BANK_DETAILS, STORE_CONTACT } from '../data/seedCatalog';

interface LegalAndInfoPagesProps {
  doc: 'about' | 'contact' | 'terms' | 'privacy' | 'returns' | 'delivery';
}

export const LegalAndInfoPages: React.FC<LegalAndInfoPagesProps> = ({ doc }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Product or Order Enquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailto = `mailto:${STORE_CONTACT.email}?subject=${encodeURIComponent(
      `[JIMMY ELECTRONICS] ${subject} — ${name}`
    )}&body=${encodeURIComponent(`From: ${name} (${email})\n\n${message}`)}`;
    window.location.href = mailto;
    setSubmitted(true);
  };

  if (doc === 'about') {
    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-10 space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-5">
          <p className="text-xs font-semibold text-[#DC2626]">
            {STORE_CONTACT.brandIdentity} | {STORE_CONTACT.businessName}
          </p>
          <h1 className="font-display text-3xl font-bold text-[#141619]">About Us</h1>
          <p className="text-base text-gray-800 font-medium leading-relaxed bg-[#F8F9FA] border border-gray-200 rounded-xl p-5">
            {STORE_CONTACT.aboutDescription}
          </p>
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <p>
              Operated by <strong>{STORE_CONTACT.businessName}</strong> under our retail identity <strong>{STORE_CONTACT.brandIdentity}</strong>, we supply Nigerian households, offices, and commercial spaces with genuine factory-warranty refrigerators, freezers, washing machines, 4K OLED/QLED televisions, dual-inverter air conditioners, Jinko Solar & Felicity energy systems, contemporary furniture, and Apple devices.
            </p>
            <p>
              Customers can complete purchases via immediate Zenith Bank transfer, spread balances using our flexible 50%-deposit <strong>Save to Buy</strong> instalment engine, or apply for BNPL financing through <strong>Credably</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (doc === 'contact') {
    return (
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-[#141619] text-white rounded-2xl p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#EF4444]">
              Customer Care & Return Requests
            </p>
            <h1 className="font-display text-3xl font-bold mt-1">Contact Us</h1>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed">
              Reach our sales, order verification, and warranty desk directly for quotes, delivery scheduling, and return requests.
            </p>
          </div>

          <div className="space-y-4 text-sm">
            <a
              href={`tel:${STORE_CONTACT.phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-3 text-gray-200 hover:text-white"
            >
              <Phone className="w-5 h-5 text-[#EF4444] shrink-0" />
              <span className="tabular-nums font-semibold">{STORE_CONTACT.phoneDisplay}</span>
            </a>
            <a
              href={`mailto:${STORE_CONTACT.email}`}
              className="flex items-center gap-3 text-gray-200 hover:text-white break-all"
            >
              <Mail className="w-5 h-5 text-[#EF4444] shrink-0" />
              <span className="font-semibold">{STORE_CONTACT.email}</span>
            </a>
            <div className="flex items-center gap-3 text-gray-300">
              <MapPin className="w-5 h-5 text-[#EF4444] shrink-0" />
              <span>{STORE_CONTACT.cityHub}</span>
            </div>
            <div className="flex items-start gap-3 text-gray-300 pt-3 border-t border-gray-800">
              <Landmark className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-white">{STORE_BANK_DETAILS.bankName}</p>
                <p>{STORE_BANK_DETAILS.accountName}</p>
                <p className="font-mono-num text-sm font-bold text-white">
                  {STORE_BANK_DETAILS.accountNumber}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleContactSubmit}
          className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-8 space-y-5"
        >
          <h2 className="font-display text-xl font-bold text-[#141619]">
            Send an Enquiry to {STORE_CONTACT.email}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-11 px-3.5 text-sm bg-white border border-gray-300 rounded-lg"
            >
              <option>Product or Order Enquiry</option>
              <option>Payment Verification Follow-up</option>
              <option>Save to Buy Instalment Support</option>
              <option>Return Request (Within 24 Hours of Delivery)</option>
              <option>Warranty Claim</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Message</label>
            <textarea
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Include your Order Reference if enquiring about an existing order or return..."
              className="w-full p-3.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>

          {submitted && (
            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Your email client has been opened addressed to {STORE_CONTACT.email}.</span>
            </p>
          )}

          <button
            type="submit"
            className="px-6 py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            Compose Enquiry Email
          </button>
        </form>
      </div>
    );
  }

  if (doc === 'delivery') {
    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-5 text-sm text-gray-700 leading-relaxed">
          <h1 className="font-display text-3xl font-bold text-[#141619]">Delivery Policy</h1>
          <ul className="list-disc pl-5 space-y-3">
            <li>
              <strong>Free Shipping Eligibility (Ibadan Only):</strong> Free shipping applies <strong>ONLY</strong> to delivery addresses within <strong>Ibadan</strong> where the customer’s qualifying order subtotal is strictly <strong>ABOVE ₦2,000,000</strong>. Orders of exactly ₦2,000,000 do not qualify for free shipping.
            </li>
            <li>
              <strong>Other Locations:</strong> Deliveries outside Ibadan (including Lagos, other Oyo State towns, South-West states, and nationwide destinations) attract configurable regional delivery charges displayed transparently during checkout.
            </li>
            <li>
              <strong>Standard Delivery Target:</strong> Within <strong>30 days</strong>, subject to stock availability, payment verification, and scheduled delivery arrangements.
            </li>
            <li>
              <strong>Verification & Release Gate:</strong> Orders remain in <em>Awaiting Payment Verification</em> until bank transfers are confirmed by our finance team. Save to Buy orders are not released for delivery until full payment (deposit + all scheduled instalments) has been received and verified.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (doc === 'returns') {
    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-5 text-sm text-gray-700 leading-relaxed">
          <h1 className="font-display text-3xl font-bold text-[#141619]">
            Return and Refund Policy
          </h1>
          <ul className="list-disc pl-5 space-y-3">
            <li>
              <strong>24-Hour Reporting Window:</strong> Eligible returns must be reported within <strong>24 hours of delivery</strong> by emailing <a href={`mailto:${STORE_CONTACT.email}`} className="text-[#DC2626] font-semibold underline">{STORE_CONTACT.email}</a> or calling {STORE_CONTACT.phoneDisplay}.
            </li>
            <li>
              <strong>Condition of Returned Items:</strong> Returned products must be completely unused, sealed in their original manufacturer packaging, and accompanied by valid proof of purchase (order reference and verified receipt).
            </li>
            <li>
              <strong>Policy Exclusions:</strong> <strong>Jinko Solar Panels</strong> and products with damaged packaging, missing accessories, physical impact, or tampered serial numbers are excluded from voluntary returns, subject to applicable rights under the Federal Competition and Consumer Protection Act (FCCPA) and Nigerian consumer protection laws.
            </li>
            <li>
              <strong>Order Cancellations:</strong> Cancellation requests are accepted for orders currently in <strong>Processing</strong> (or Awaiting Payment Verification) status prior to dispatch.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (doc === 'privacy') {
    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-10">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-5 text-sm text-gray-700 leading-relaxed">
          <h1 className="font-display text-3xl font-bold text-[#141619]">
            Privacy Policy (Nigeria Data Protection Act Compliance)
          </h1>
          <p>
            <strong>{STORE_CONTACT.brandIdentity} | {STORE_CONTACT.businessName}</strong> respects your privacy and processes personal data in strict accordance with the Nigeria Data Protection Act (NDPA) and applicable Nigerian consumer protection laws.
          </p>
          <h2 className="font-display text-lg font-bold text-[#141619] pt-2">
            1. Data Collection
          </h2>
          <p>
            We collect your full name, email address, telephone number, delivery addresses, order history, bank transfer receipts, and Save to Buy instalment records solely to fulfil purchases, verify payments, and provide warranty support.
          </p>
          <h2 className="font-display text-lg font-bold text-[#141619] pt-2">
            2. Use & Protection
          </h2>
          <p>
            Customer profiles and delivery addresses are isolated in Firebase Firestore using strict role-based security rules so customers can only access their own records. Payment receipts are transmitted over encrypted HTTPS connections to Cloudinary.
          </p>
          <h2 className="font-display text-lg font-bold text-[#141619] pt-2">
            3. Sharing of Information
          </h2>
          <p>
            We never sell customer data. Personal information is shared strictly with authorized logistics partners for delivery execution or with Credably (https://credably.ng/) only when you explicitly apply for Credably BNPL financing. Enquiries or data deletion requests may be sent to <strong>{STORE_CONTACT.email}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-10">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-5 text-sm text-gray-700 leading-relaxed">
        <h1 className="font-display text-3xl font-bold text-[#141619]">Terms and Conditions</h1>
        <p>
          These Terms govern purchases made on <strong>{STORE_CONTACT.brandIdentity}</strong>, operated by <strong>{STORE_CONTACT.businessName}</strong>, in accordance with Nigerian commercial and consumer protection laws.
        </p>
        <ul className="list-disc pl-5 space-y-2.5">
          <li>
            <strong>Bank Transfer Verification:</strong> Payments made to Zenith Bank Account <strong>{STORE_BANK_DETAILS.accountNumber}</strong> ({STORE_BANK_DETAILS.accountName}) require receipt upload and remain in <em>Awaiting Payment Verification</em> until cleared by an administrator.
          </li>
          <li>
            <strong>Save to Buy Instalments:</strong> All Save to Buy plans require a 50% initial deposit. Interest rates (3 months: 0%, 6 months: 12%, 9 months: 18%, 12 months: 24%, configurable by store administrators) apply to the remaining balance. A 7-day grace period applies per due date, after which a 1% weekly non-compounding late fee (capped at 5% of the overdue instalment) applies unless an administrator grants an extension. Products are never released until full payment is verified.
          </li>
          <li>
            <strong>Credably BNPL:</strong> Financing applications submitted via Credably are governed by Credably’s credit underwriting terms and live merchant settlement confirmation.
          </li>
          <li>
            <strong>Cancellations & Returns:</strong> Orders in Processing status may be cancelled prior to dispatch. Eligible returns must be reported within 24 hours of delivery to {STORE_CONTACT.email}.
          </li>
        </ul>
      </div>
    </div>
  );
};
