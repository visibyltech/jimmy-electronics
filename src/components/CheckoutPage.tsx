import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  Landmark,
  CalendarClock,
  Upload,
  AlertCircle,
  Truck,
  ExternalLink,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { STORE_BANK_DETAILS } from '../data/seedCatalog';
import { formatNgn, generateDocId, generateOrderRef, formatShortDate } from '../lib/format';
import {
  calculateSaveToBuyApi,
  calculateShippingApi,
  fetchCredablyStatus,
  fileToBase64,
  initiateCredablyApplication,
  uploadFileToCloudinary,
  type CredablyStatusResult,
} from '../lib/api';
import { createOrderBundle, fetchUserAddresses } from '../lib/firestoreService';
import type {
  CartItem,
  DeliveryAddress,
  PaymentMethod,
  SaveToBuyCalculation,
  ShippingCalculation,
  StoreSettings,
  UserProfile,
} from '../types';
import type { AppRoute } from './Header';

interface CheckoutPageProps {
  items: CartItem[];
  storeSettings: StoreSettings;
  user: User | null;
  profile: UserProfile | null;
  initialMethod?: PaymentMethod;
  navigate: (next: AppRoute) => void;
  onClearCart: () => void;
}

const NIGERIAN_STATES = [
  'Oyo',
  'Lagos',
  'Ogun',
  'Osun',
  'Ondo',
  'Ekiti',
  'Abuja (FCT)',
  'Rivers',
  'Kano',
  'Enugu',
  'Anambra',
  'Delta',
  'Edo',
  'Kwara',
  'Kaduna',
  'Other',
];

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  items,
  storeSettings,
  user,
  profile,
  initialMethod,
  navigate,
  onClearCart,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialMethod || 'pay_now');
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);

  const [customerName, setCustomerName] = useState(profile?.fullName || user?.displayName || '');
  const [customerEmail, setCustomerEmail] = useState(profile?.email || user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(profile?.phone || '');
  const [streetAddress, setStreetAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState(profile?.defaultCity || 'Ibadan');
  const [deliveryState, setDeliveryState] = useState(profile?.defaultState || 'Oyo');

  const [shippingCalc, setShippingCalc] = useState<ShippingCalculation | null>(null);
  const [durationMonths, setDurationMonths] = useState<3 | 6 | 9 | 12>(3);
  const [stbCalc, setStbCalc] = useState<SaveToBuyCalculation | null>(null);
  const [acceptedStbPolicy, setAcceptedStbPolicy] = useState(false);

  const [orderRef] = useState(() => generateOrderRef());
  const [copiedAcct, setCopiedAcct] = useState(false);
  const [transferReference, setTransferReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploadError, setReceiptUploadError] = useState('');

  const [credablyStatus, setCredablyStatus] = useState<CredablyStatusResult | null>(null);
  const [credablyOutcome, setCredablyOutcome] = useState<{
    status: string;
    message: string;
    reference?: string;
    checkoutUrl?: string | null;
    missingEnv?: string[];
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedOrderRef, setCompletedOrderRef] = useState<string | null>(null);

  const subtotalNgn = useMemo(
    () => items.reduce((sum, item) => sum + item.priceNgn * item.quantity, 0),
    [items]
  );

  useEffect(() => {
    if (profile) {
      setCustomerName((prev) => prev || profile.fullName);
      setCustomerEmail((prev) => prev || profile.email);
      setCustomerPhone((prev) => prev || profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    fetchUserAddresses(user.uid)
      .then((list) => {
        setSavedAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0];
        if (def) {
          setStreetAddress(def.streetAddress);
          setDeliveryCity(def.city);
          setDeliveryState(def.state);
          if (!customerPhone) setCustomerPhone(def.phone);
          if (!customerName) setCustomerName(def.recipientName);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchCredablyStatus()
      .then(setCredablyStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    calculateShippingApi({
      city: deliveryCity,
      state: deliveryState,
      subtotalNgn,
      settings: storeSettings,
    })
      .then((res) => {
        if (active) setShippingCalc(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deliveryCity, deliveryState, subtotalNgn, storeSettings]);

  const orderTotalNgn = shippingCalc ? shippingCalc.totalNgn : subtotalNgn;

  useEffect(() => {
    let active = true;
    if (orderTotalNgn <= 0) return;
    calculateSaveToBuyApi({
      totalOrderNgn: orderTotalNgn,
      durationMonths,
      rates: storeSettings.saveToBuyRates,
      depositPercent: storeSettings.depositPercent,
    })
      .then((res) => {
        if (active) setStbCalc(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [orderTotalNgn, durationMonths, storeSettings]);

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(STORE_BANK_DETAILS.accountNumber);
      setCopiedAcct(true);
      setTimeout(() => setCopiedAcct(false), 2500);
    } catch {
      setCopiedAcct(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptUploadError('');
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptFile(null);
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setReceiptUploadError('Only JPG, JPEG, PNG, or PDF receipts are accepted.');
      setReceiptFile(null);
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setReceiptUploadError('Receipt file size must be 3MB or less.');
      setReceiptFile(null);
      return;
    }
    setReceiptFile(file);
  };

  if (completedOrderRef) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-5">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#141619]">
            Order Placed — Awaiting Payment Verification
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Order Reference <strong className="font-mono-num text-[#141619]">{completedOrderRef}</strong> has been recorded with your uploaded Zenith Bank receipt. An administrator at MIND J-E MULTI CONCEPT will verify your transfer before processing dispatch.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate({ page: 'account', tab: 'orders' })}
              className="px-6 py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              Track Order in Account
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'catalog' })}
              className="px-6 py-3 border border-gray-300 text-[#141619] text-sm font-semibold rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#141619]">Your cart is empty</h1>
        <p className="text-sm text-gray-600">
          Add products to your cart before proceeding to checkout.
        </p>
        <button
          type="button"
          onClick={() => navigate({ page: 'catalog' })}
          className="px-6 py-3 bg-[#DC2626] text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          Browse Catalogue
        </button>
      </div>
    );
  }

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setReceiptUploadError('');
    setCredablyOutcome(null);

    if (!user) {
      setErrorMsg('Please sign in or register an account before placing an order.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !streetAddress.trim() || !deliveryCity.trim()) {
      setErrorMsg('Please complete all delivery contact and street address fields.');
      return;
    }

    // Handle Credably BNPL real integration path
    if (paymentMethod === 'credably_bnpl') {
      setSubmitting(true);
      try {
        const res = await initiateCredablyApplication({
          orderRef,
          amountNgn: orderTotalNgn,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          items: items.map((i) => ({
            name: i.name,
            sku: i.sku,
            quantity: i.quantity,
            unitPriceNgn: i.priceNgn,
          })),
        });

        if (!res.configured) {
          setCredablyOutcome({
            status: res.status || 'PENDING_CREDENTIALS',
            message:
              res.message ||
              'Credably merchant credentials are required on the server before live BNPL applications can be processed.',
            missingEnv: res.missingEnv,
          });
          setSubmitting(false);
          return;
        }

        if (res.status === 'failed' || res.status === 'declined') {
          setCredablyOutcome({
            status: res.status,
            message: res.error || `Credably BNPL transaction ${res.status}.`,
          });
          setSubmitting(false);
          return;
        }

        const orderId = generateDocId('ord');
        await createOrderBundle({
          order: {
            id: orderId,
            orderRef,
            userId: user.uid,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            customerPhone: customerPhone.trim(),
            deliveryAddress: streetAddress.trim(),
            deliveryCity: deliveryCity.trim(),
            deliveryState: deliveryState.trim(),
            items: items.map((i) => ({
              productId: i.productId,
              name: i.name,
              sku: i.sku,
              brand: i.brand,
              category: i.category,
              unitPriceNgn: i.priceNgn,
              quantity: i.quantity,
              lineTotalNgn: i.priceNgn * i.quantity,
              image: i.image,
            })),
            subtotalNgn,
            shippingFeeNgn: shippingCalc?.shippingFeeNgn ?? 0,
            freeShippingApplied: Boolean(shippingCalc?.freeShippingApplied),
            totalNgn: orderTotalNgn,
            paymentMethod: 'credably_bnpl',
            paymentStatus: res.status === 'approved' ? 'credably_approved' : 'credably_pending',
            orderStatus: res.status === 'approved' ? 'processing' : 'awaiting_payment_verification',
            credablyReference: res.credablyReference || orderRef,
            credablySettlementStatus: 'pending',
          },
          notification: {
            id: generateDocId('notif'),
            userId: user.uid,
            title: `Credably BNPL Application (${orderRef})`,
            message: `Your Credably application reference ${res.credablyReference || orderRef} is currently ${res.status}.`,
            type: 'payment',
            relatedOrderId: orderId,
            isRead: false,
          },
        });

        setCredablyOutcome({
          status: res.status,
          reference: res.credablyReference,
          checkoutUrl: res.checkoutUrl,
          message: 'Credably application initialized. Complete verification on Credably to finalize settlement.',
        });
        onClearCart();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to initialize Credably BNPL.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Pay Now & Save to Buy require Zenith Bank receipt upload to Cloudinary
    if (!receiptFile) {
      setReceiptUploadError('Please upload your Zenith Bank transfer receipt (JPG, JPEG, PNG, or PDF).');
      return;
    }

    if (paymentMethod === 'save_to_buy') {
      if (!acceptedStbPolicy) {
        setErrorMsg('Please confirm acceptance of the Save to Buy 7-day grace & late fee policy.');
        return;
      }
      if (!stbCalc) {
        setErrorMsg('Save to Buy schedule is still calculating. Please try again.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const base64Data = await fileToBase64(receiptFile);
      const uploadRes = await uploadFileToCloudinary({
        fileName: receiptFile.name,
        mimeType: receiptFile.type,
        base64Data,
        folder: 'receipts',
      });

      if (!uploadRes.configured || !uploadRes.url) {
        setReceiptUploadError(
          uploadRes.error ||
            `Cloudinary upload unavailable. Missing server configuration: ${(
              uploadRes.missingEnv || []
            ).join(', ')}`
        );
        setSubmitting(false);
        return;
      }

      const orderId = generateDocId('ord');
      const paymentId = generateDocId('pay');
      const receiptId = generateDocId('rcpt');
      const planId = paymentMethod === 'save_to_buy' ? generateDocId('plan') : undefined;

      const payableNowNgn =
        paymentMethod === 'save_to_buy' && stbCalc ? stbCalc.initialDepositNgn : orderTotalNgn;

      await createOrderBundle({
        order: {
          id: orderId,
          orderRef,
          userId: user.uid,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          deliveryAddress: streetAddress.trim(),
          deliveryCity: deliveryCity.trim(),
          deliveryState: deliveryState.trim(),
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            sku: i.sku,
            brand: i.brand,
            category: i.category,
            unitPriceNgn: i.priceNgn,
            quantity: i.quantity,
            lineTotalNgn: i.priceNgn * i.quantity,
            image: i.image,
          })),
          subtotalNgn,
          shippingFeeNgn: shippingCalc?.shippingFeeNgn ?? 0,
          freeShippingApplied: Boolean(shippingCalc?.freeShippingApplied),
          totalNgn: orderTotalNgn,
          paymentMethod,
          paymentStatus:
            paymentMethod === 'save_to_buy'
              ? 'deposit_pending_verification'
              : 'awaiting_payment_verification',
          orderStatus: 'awaiting_payment_verification',
          ...(planId ? { instalmentPlanId: planId } : {}),
        },
        ...(paymentMethod === 'save_to_buy' && planId && stbCalc
          ? {
              instalmentPlan: {
                id: planId,
                orderId,
                orderRef,
                userId: user.uid,
                totalOrderNgn: orderTotalNgn,
                initialDepositNgn: stbCalc.initialDepositNgn,
                outstandingPrincipalNgn: stbCalc.outstandingPrincipalNgn,
                durationMonths: stbCalc.durationMonths,
                interestRatePercent: stbCalc.interestRatePercent,
                interestAmountNgn: stbCalc.interestAmountNgn,
                totalRepaymentNgn: stbCalc.totalRepaymentNgn,
                monthlyInstalmentNgn: stbCalc.monthlyInstalmentNgn,
                amountPaidVerifiedNgn: 0,
                remainingBalanceNgn: stbCalc.initialDepositNgn + stbCalc.totalRepaymentNgn,
                status: 'pending_deposit',
                adminApproved: false,
                schedule: stbCalc.schedule,
              },
            }
          : {}),
        receipt: {
          id: receiptId,
          orderId,
          paymentId,
          userId: user.uid,
          ...(planId ? { instalmentPlanId: planId } : {}),
          fileName: receiptFile.name,
          mimeType: receiptFile.type as 'image/jpeg' | 'image/jpg' | 'image/png' | 'application/pdf',
          fileSize: receiptFile.size,
          ...(uploadRes.publicId ? { cloudinaryPublicId: uploadRes.publicId } : {}),
          fileUrl: uploadRes.url,
        },
        payment: {
          id: paymentId,
          orderId,
          orderRef,
          userId: user.uid,
          ...(planId ? { instalmentPlanId: planId, instalmentNumber: 0 } : {}),
          amountNgn: payableNowNgn,
          method: paymentMethod === 'save_to_buy' ? 'save_to_buy_deposit' : 'bank_transfer',
          bankName: STORE_BANK_DETAILS.bankName,
          accountNumber: STORE_BANK_DETAILS.accountNumber,
          accountName: STORE_BANK_DETAILS.accountName,
          referenceCode: transferReference.trim() || orderRef,
          receiptId,
          receiptUrl: uploadRes.url,
          status: 'pending_verification',
        },
        notification: {
          id: generateDocId('notif'),
          userId: user.uid,
          title: `Order ${orderRef} Received`,
          message: `Receipt uploaded for ${formatNgn(payableNowNgn)}. Your order is Awaiting Payment Verification.`,
          type: 'order',
          relatedOrderId: orderId,
          isRead: false,
        },
      });

      onClearCart();
      setCompletedOrderRef(orderRef);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  const amountDueNow =
    paymentMethod === 'save_to_buy' && stbCalc ? stbCalc.initialDepositNgn : orderTotalNgn;

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141619]">
          Secure Checkout
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Order Reference: <span className="font-mono-num font-bold text-[#141619]">{orderRef}</span>
        </p>
      </div>

      {!user && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-sm text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Please sign in or create a customer account to complete your order, track deliveries, and upload payment receipts.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'account', tab: 'orders' })}
            className="px-4 py-2 bg-[#141619] text-white text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
          >
            Sign In / Register
          </button>
        </div>
      )}

      <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery & Payment Selection */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Delivery Information */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-[#141619]">
                1. Delivery Address & Shipping Validation
              </h2>
              {savedAddresses.length > 0 && (
                <select
                  onChange={(e) => {
                    const addr = savedAddresses.find((a) => a.id === e.target.value);
                    if (addr) {
                      setStreetAddress(addr.streetAddress);
                      setDeliveryCity(addr.city);
                      setDeliveryState(addr.state);
                      setCustomerPhone(addr.phone);
                      setCustomerName(addr.recipientName);
                    }
                  }}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Use saved address...
                  </option>
                  {savedAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} ({a.city})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+234 800 000 0000"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Delivery State *
                </label>
                <select
                  value={deliveryState}
                  onChange={(e) => setDeliveryState(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                >
                  {NIGERIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Delivery City *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ibadan, Ikeja, Lekki"
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Street Address & Landmark *
                </label>
                <input
                  type="text"
                  required
                  placeholder="House No, Street, Area"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                />
              </div>
            </div>

            {shippingCalc && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                  shippingCalc.freeShippingApplied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-[#F8F9FA] border-gray-200 text-gray-800'
                }`}
              >
                <Truck className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {shippingCalc.freeShippingApplied
                      ? 'Free Ibadan Delivery Applied (₦0)'
                      : `Shipping Fee: ${formatNgn(shippingCalc.shippingFeeNgn)}`}
                  </p>
                  <p className="mt-0.5">{shippingCalc.reason}</p>
                  <p className="mt-0.5 text-gray-500">
                    Standard delivery target: Within {shippingCalc.deliveryTargetDays} days, subject to availability and delivery arrangements.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 2. Payment Method */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#141619]">
              2. Choose Payment Method
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('pay_now')}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  paymentMethod === 'pay_now'
                    ? 'border-[#DC2626] bg-red-50/40 ring-1 ring-[#DC2626]'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <Landmark className="w-5 h-5 text-[#DC2626] mb-2" />
                <p className="text-sm font-bold text-[#141619]">A. Pay Now</p>
                <p className="text-xs text-gray-600 mt-0.5">Zenith Bank Transfer + Receipt</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('save_to_buy')}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  paymentMethod === 'save_to_buy'
                    ? 'border-[#DC2626] bg-red-50/40 ring-1 ring-[#DC2626]'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <CalendarClock className="w-5 h-5 text-[#DC2626] mb-2" />
                <p className="text-sm font-bold text-[#141619]">B. Save to Buy</p>
                <p className="text-xs text-gray-600 mt-0.5">50% Deposit + 3–12 Mo. Plan</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credably_bnpl')}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  paymentMethod === 'credably_bnpl'
                    ? 'border-[#DC2626] bg-red-50/40 ring-1 ring-[#DC2626]'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <CreditCard className="w-5 h-5 text-[#DC2626] mb-2" />
                <p className="text-sm font-bold text-[#141619]">C. Credably BNPL</p>
                <p className="text-xs text-gray-600 mt-0.5">Buy Now Pay Later (credably.ng)</p>
              </button>
            </div>

            {/* Save to Buy Plan Configuration */}
            {paymentMethod === 'save_to_buy' && (
              <div className="border border-gray-200 rounded-xl p-5 bg-[#F8F9FA] space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#141619]">
                    Select Save to Buy Duration (50% Initial Deposit Required)
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Interest applies only to the remaining 50% balance after your initial deposit.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {([3, 6, 9, 12] as const).map((m) => {
                    const rate = storeSettings.saveToBuyRates[String(m) as '3' | '6' | '9' | '12'];
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDurationMonths(m)}
                        className={`p-3 rounded-lg border text-center cursor-pointer transition-colors ${
                          durationMonths === m
                            ? 'bg-[#141619] text-white border-[#141619]'
                            : 'bg-white text-[#141619] border-gray-200'
                        }`}
                      >
                        <span className="block text-sm font-bold">{m} Months</span>
                        <span className="block text-xs opacity-80">{rate}% Interest</span>
                      </button>
                    );
                  })}
                </div>

                {stbCalc && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-gray-200 rounded-lg p-3.5 text-xs">
                      <div>
                        <span className="text-gray-500 block">50% Deposit Now</span>
                        <span className="font-mono-num text-sm font-bold text-[#DC2626]">
                          {formatNgn(stbCalc.initialDepositNgn)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Outstanding Balance</span>
                        <span className="font-mono-num text-sm font-bold text-[#141619]">
                          {formatNgn(stbCalc.outstandingPrincipalNgn)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">
                          Interest ({stbCalc.interestRatePercent}%)
                        </span>
                        <span className="font-mono-num text-sm font-bold text-[#141619]">
                          {formatNgn(stbCalc.interestAmountNgn)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Total Repayment</span>
                        <span className="font-mono-num text-sm font-bold text-[#141619]">
                          {formatNgn(stbCalc.totalRepaymentNgn)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-3.5">
                      <p className="text-xs font-bold text-[#141619] mb-2">
                        Monthly Repayment Schedule ({formatNgn(stbCalc.monthlyInstalmentNgn)}/mo est.)
                      </p>
                      <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 text-xs">
                        {stbCalc.schedule.map((row) => (
                          <div key={row.instalmentNumber} className="py-1.5 flex justify-between">
                            <span className="text-gray-600">
                              Instalment {row.instalmentNumber} · Due {formatShortDate(row.dueDateIso)}
                            </span>
                            <span className="font-mono-num font-semibold text-[#141619]">
                              {formatNgn(row.amountNgn)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedStbPolicy}
                    onChange={(e) => setAcceptedStbPolicy(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#DC2626]"
                  />
                  <span>
                    I understand and accept the Save to Buy policy: 7-day grace period per due date, 1% weekly late fee (max 5% of overdue instalment, non-compounding), and products are released only after full payment is received and verified.
                  </span>
                </label>
              </div>
            )}

            {/* Zenith Bank Transfer & Receipt Upload (for Pay Now & Save to Buy) */}
            {(paymentMethod === 'pay_now' || paymentMethod === 'save_to_buy') && (
              <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="bg-[#141619] text-white rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-300">
                      Official Transfer Account
                    </span>
                    <span className="text-xs font-mono-num text-[#EF4444]">
                      Ref: {orderRef}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block">Bank</span>
                      <span className="font-bold">{STORE_BANK_DETAILS.bankName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Account Name</span>
                      <span className="font-bold">{STORE_BANK_DETAILS.accountName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-base font-extrabold">
                          {STORE_BANK_DETAILS.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyAccount}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-[#DC2626] hover:bg-[#B91C1C] rounded text-white cursor-pointer"
                        >
                          {copiedAcct ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-sm">
                    <span className="text-gray-300">
                      {paymentMethod === 'save_to_buy' ? '50% Initial Deposit Due Now:' : 'Total Amount Due:'}
                    </span>
                    <span className="font-mono-num text-lg font-extrabold text-white">
                      {formatNgn(amountDueNow)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Bank Transfer Session ID / Sender Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Zenith NIP reference or sender name"
                    value={transferReference}
                    onChange={(e) => setTransferReference(e.target.value)}
                    className="w-full h-10 px-3.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Upload Payment Receipt (JPG, JPEG, PNG, or PDF) *
                  </label>
                  <label className="border-2 border-dashed border-gray-300 hover:border-[#DC2626] rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#F8F9FA]">
                    <Upload className="w-5 h-5 text-[#DC2626] mb-1.5" />
                    <span className="text-sm font-semibold text-[#141619]">
                      {receiptFile ? receiptFile.name : 'Click to attach bank transfer receipt'}
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      Uploaded securely to Cloudinary · Max 15MB
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  {receiptUploadError && (
                    <p className="text-xs text-red-700 font-medium mt-2 flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{receiptUploadError}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Credably BNPL Section */}
            {paymentMethod === 'credably_bnpl' && (
              <div className="border border-gray-200 rounded-xl p-5 bg-[#F8F9FA] space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-[#141619]">Credably BNPL Financing</h3>
                  <a
                    href="https://credably.ng/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#DC2626] inline-flex items-center gap-1 hover:underline"
                  >
                    <span>credably.ng</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Applications are processed directly through Credably’s live merchant verification API and server-side webhook settlement callbacks. Approvals are never simulated.
                </p>

                {credablyStatus && !credablyStatus.configured && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                    <p className="font-bold">Merchant Activation Required</p>
                    <p>
                      To activate live Credably BNPL checkout, configure these server environment variables:{' '}
                      <span className="font-mono-num font-semibold">
                        {credablyStatus.missingEnv.join(', ')}
                      </span>
                    </p>
                  </div>
                )}

                {credablyOutcome && (
                  <div className="p-3.5 bg-white border border-gray-300 rounded-lg text-xs space-y-1.5">
                    <p className="font-bold text-[#141619]">
                      Credably Status: {credablyOutcome.status}
                    </p>
                    <p className="text-gray-700">{credablyOutcome.message}</p>
                    {credablyOutcome.missingEnv && (
                      <p className="font-mono-num text-gray-600">
                        Required Env: {credablyOutcome.missingEnv.join(', ')}
                      </p>
                    )}
                    {credablyOutcome.checkoutUrl && (
                      <a
                        href={credablyOutcome.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DC2626] text-white font-semibold rounded-lg mt-1"
                      >
                        <span>Continue on Credably</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer min-h-[52px]"
          >
            {submitting
              ? 'Processing Order & Uploading Receipt...'
              : paymentMethod === 'credably_bnpl'
              ? `Apply for Credably BNPL (${formatNgn(orderTotalNgn)})`
              : paymentMethod === 'save_to_buy'
              ? `Submit Save to Buy Deposit (${formatNgn(amountDueNow)})`
              : `Submit Order & Receipt (${formatNgn(orderTotalNgn)})`}
          </button>
        </div>

        {/* Right Column: Order Summary */}
        <aside className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-6 space-y-5 lg:sticky lg:top-28">
          <h2 className="font-display text-lg font-bold text-[#141619]">Order Summary</h2>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <div key={item.productId} className="py-3 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-[#141619] line-clamp-2">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                    Qty {item.quantity} × {formatNgn(item.priceNgn)}
                  </p>
                </div>
                <span className="font-mono-num font-bold text-[#141619] shrink-0">
                  {formatNgn(item.priceNgn * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Items Subtotal</span>
              <span className="font-mono-num font-semibold">{formatNgn(subtotalNgn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping ({deliveryCity || 'Select city'})</span>
              <span className="font-mono-num font-semibold">
                {shippingCalc?.freeShippingApplied
                  ? 'FREE'
                  : formatNgn(shippingCalc?.shippingFeeNgn ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-[#141619] pt-2 border-t border-gray-100">
              <span>Order Total</span>
              <span className="font-mono-num">{formatNgn(orderTotalNgn)}</span>
            </div>

            {paymentMethod === 'save_to_buy' && stbCalc && (
              <div className="flex justify-between text-sm font-bold text-[#DC2626] pt-1">
                <span>50% Deposit Payable Now</span>
                <span className="font-mono-num">{formatNgn(stbCalc.initialDepositNgn)}</span>
              </div>
            )}
          </div>

          <div className="bg-[#F8F9FA] border border-gray-200 rounded-lg p-3.5 text-xs text-gray-600 flex items-start gap-2">
            <FileText className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <span>
              Orders stay in <strong>Awaiting Payment Verification</strong> until our finance team confirms your Zenith Bank transfer.
            </span>
          </div>
        </aside>
      </form>
    </div>
  );
};
