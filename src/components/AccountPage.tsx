import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  Eye,
  EyeOff,
  LogOut,
  Package,
  CalendarClock,
  Receipt,
  MapPin,
  Bell,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { STORE_BANK_DETAILS } from '../data/seedCatalog';
import { formatNgn, formatShortDate, generateDocId } from '../lib/format';
import { calculateLateFeeApi, fileToBase64, uploadFileToCloudinary } from '../lib/api';
import {
  cancelCustomerOrder,
  deleteDeliveryAddress,
  fetchUserAddresses,
  markNotificationRead,
  saveDeliveryAddress,
  submitInstalmentPayment,
  subscribeUserInstalmentPlans,
  subscribeUserNotifications,
  subscribeUserOrders,
  subscribeUserPayments,
  updateUserProfile,
} from '../lib/firestoreService';
import type {
  DeliveryAddress,
  InstalmentPlanRecord,
  NotificationRecord,
  OrderRecord,
  PaymentRecord,
  UserProfile,
} from '../types';

interface AccountPageProps {
  user: User | null;
  profile: UserProfile | null;
  initialTab?: 'orders' | 'save_to_buy' | 'payments' | 'addresses' | 'profile';
  onProfileUpdated: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  user,
  profile,
  initialTab,
  onProfileUpdated,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<'orders' | 'save_to_buy' | 'payments' | 'addresses' | 'profile'>(
    initialTab || 'orders'
  );
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [plans, setPlans] = useState<InstalmentPlanRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);

  // Address Form
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('Ibadan');
  const [addrState, setAddrState] = useState('Oyo');
  const [addrLandmark, setAddrLandmark] = useState('');
  const [addrBusy, setAddrBusy] = useState(false);

  // Profile Edit Form
  const [profName, setProfName] = useState(profile?.fullName || '');
  const [profPhone, setProfPhone] = useState(profile?.phone || '');
  const [profCity, setProfCity] = useState(profile?.defaultCity || 'Ibadan');
  const [profState, setProfState] = useState(profile?.defaultState || 'Oyo');
  const [profSavedMsg, setProfSavedMsg] = useState('');

  // Instalment Receipt Repayment State
  const [activePlanUploadId, setActivePlanUploadId] = useState<string | null>(null);
  const [activeInstNum, setActiveInstNum] = useState<number>(1);
  const [instFile, setInstFile] = useState<File | null>(null);
  const [instRef, setInstRef] = useState('');
  const [instBusy, setInstBusy] = useState(false);
  const [instMsg, setInstMsg] = useState('');
  const [copiedAcct, setCopiedAcct] = useState(false);
  const [lateFeesMap, setLateFeesMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (profile) {
      setProfName(profile.fullName || '');
      setProfPhone(profile.phone || '');
      setProfCity(profile.defaultCity || 'Ibadan');
      setProfState(profile.defaultState || 'Oyo');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setPayments([]);
      setPlans([]);
      setNotifications([]);
      setAddresses([]);
      return;
    }

    const u1 = subscribeUserOrders(user.uid, setOrders);
    const u2 = subscribeUserPayments(user.uid, setPayments);
    const u3 = subscribeUserInstalmentPlans(user.uid, setPlans);
    const u4 = subscribeUserNotifications(user.uid, setNotifications);
    fetchUserAddresses(user.uid).then(setAddresses).catch(() => {});

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [user]);

  // Compute live overdue late fees for pending instalments
  useEffect(() => {
    plans.forEach((plan) => {
      plan.schedule.forEach((item) => {
        if (item.status === 'pending' || item.status === 'overdue') {
          calculateLateFeeApi({
            instalmentAmountNgn: item.amountNgn,
            dueDateIso: item.dueDateIso,
            extensionDaysGranted: plan.extensionDaysGranted || 0,
          })
            .then((res) => {
              if (res.lateFeeNgn > 0) {
                setLateFeesMap((prev) => ({
                  ...prev,
                  [`${plan.id}_${item.instalmentNumber}`]: res.lateFeeNgn,
                }));
              }
            })
            .catch(() => {});
        }
      });
    });
  }, [plans]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setAuthBusy(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (authMode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        setAuthNotice('Account created successfully. You can now sign in and use your account.');
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setAuthNotice('Password reset instructions have been sent to your email inbox.');
        setAuthMode('login');
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'Email/Password sign-in is not yet enabled in Firebase Authentication Console. Enable "Email/Password" under Authentication > Sign-in method in Firebase Console, or sign in instantly with Google below.'
        );
      } else {
        setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAddrBusy(true);
    try {
      await saveDeliveryAddress(user.uid, {
        label: addrLabel,
        recipientName: addrName || profName || user.displayName || 'Customer',
        phone: addrPhone || profPhone || '',
        streetAddress: addrStreet,
        city: addrCity,
        state: addrState,
        landmark: addrLandmark,
        isDefault: addresses.length === 0,
      });
      setAddrStreet('');
      setAddrLandmark('');
      const updated = await fetchUserAddresses(user.uid);
      setAddresses(updated);
    } finally {
      setAddrBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await updateUserProfile(user.uid, {
      fullName: profName,
      phone: profPhone,
      defaultCity: profCity,
      defaultState: profState,
    });
    onProfileUpdated();
    setProfSavedMsg('Profile updated.');
    setTimeout(() => setProfSavedMsg(''), 3000);
  };

  const handleSubmitInstalmentReceipt = async (plan: InstalmentPlanRecord) => {
    if (!user || !instFile) return;
    setInstMsg('');
    setInstBusy(true);
    try {
      const targetItem = plan.schedule.find((s) => s.instalmentNumber === activeInstNum);
      if (!targetItem) return;
      const lateFee = lateFeesMap[`${plan.id}_${activeInstNum}`] || 0;
      const payableNgn = targetItem.amountNgn + lateFee;

      const base64Data = await fileToBase64(instFile);
      const uploadRes = await uploadFileToCloudinary({
        fileName: instFile.name,
        mimeType: instFile.type,
        base64Data,
        folder: 'receipts',
      });

      if (!uploadRes.configured || !uploadRes.url) {
        setInstMsg(
          uploadRes.error ||
            `Cloudinary upload unavailable (${(uploadRes.missingEnv || []).join(', ')}).`
        );
        setInstBusy(false);
        return;
      }

      const paymentId = generateDocId('pay');
      const receiptId = generateDocId('rcpt');

      await submitInstalmentPayment({
        payment: {
          id: paymentId,
          orderId: plan.orderId,
          orderRef: plan.orderRef,
          userId: user.uid,
          instalmentPlanId: plan.id,
          instalmentNumber: activeInstNum,
          amountNgn: payableNgn,
          method: 'save_to_buy_instalment',
          bankName: STORE_BANK_DETAILS.bankName,
          accountNumber: STORE_BANK_DETAILS.accountNumber,
          accountName: STORE_BANK_DETAILS.accountName,
          referenceCode: instRef.trim() || `${plan.orderRef}-INST-${activeInstNum}`,
          receiptId,
          receiptUrl: uploadRes.url,
          status: 'pending_verification',
        },
        receipt: {
          id: receiptId,
          orderId: plan.orderId,
          paymentId,
          userId: user.uid,
          instalmentPlanId: plan.id,
          fileName: instFile.name,
          mimeType: instFile.type as 'image/jpeg' | 'image/jpg' | 'image/png' | 'application/pdf',
          fileSize: instFile.size,
          ...(uploadRes.publicId ? { cloudinaryPublicId: uploadRes.publicId } : {}),
          fileUrl: uploadRes.url,
        },
        notification: {
          id: generateDocId('notif'),
          userId: user.uid,
          title: `Instalment #${activeInstNum} Receipt Submitted`,
          message: `Receipt for ${formatNgn(payableNgn)} (${plan.orderRef}) is awaiting admin verification.`,
          type: 'instalment',
          relatedOrderId: plan.orderId,
          isRead: false,
        },
      });

      setActivePlanUploadId(null);
      setInstFile(null);
      setInstRef('');
      setInstMsg('Instalment receipt submitted for admin verification.');
    } catch (err) {
      setInstMsg(err instanceof Error ? err.message : 'Failed to submit instalment receipt.');
    } finally {
      setInstBusy(false);
    }
  };

  // Unauthenticated View
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-sm space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-[#141619]">
              {authMode === 'login'
                ? 'Customer Sign In'
                : authMode === 'register'
                ? 'Create Customer Account'
                : 'Reset Password'}
            </h1>
            <p className="text-xs text-gray-600">
              JIMMY ELECTRONICS | MIND J-E MULTI CONCEPT
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F4F5F7] rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
              className={`py-2 rounded-md cursor-pointer ${
                authMode === 'login' ? 'bg-white text-[#141619] shadow-sm' : 'text-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
              className={`py-2 rounded-md cursor-pointer ${
                authMode === 'register' ? 'bg-white text-[#141619] shadow-sm' : 'text-gray-600'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-3.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
              />
            </div>

            {authMode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Password</label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setAuthMode('reset')}
                      className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full h-11 pl-3.5 pr-11 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-800 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 leading-relaxed">
                {authError}
              </div>
            )}
            {authNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 leading-relaxed">
                {authNotice}
              </div>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full h-11 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {authBusy
                ? 'Please wait...'
                : authMode === 'login'
                ? 'Sign In'
                : authMode === 'register'
                ? 'Create Account'
                : 'Send Reset Link'}
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <span className="border-t border-gray-200 w-full" />
            <span className="bg-white px-3 text-xs text-gray-500 shrink-0">or</span>
            <span className="border-t border-gray-200 w-full" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authBusy}
            className="w-full h-11 border border-gray-300 hover:bg-gray-50 text-[#141619] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#141619]">
            Welcome, {profile?.fullName || user.displayName || user.email}
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>



      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            { id: 'orders', label: 'Orders & Tracking', icon: Package },
            { id: 'save_to_buy', label: 'Save to Buy Plans', icon: CalendarClock },
            { id: 'payments', label: 'Payments & Receipts', icon: Receipt },
            { id: 'addresses', label: 'Delivery Addresses', icon: MapPin },
            { id: 'profile', label: 'Profile & Alerts', icon: Bell },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors min-h-[42px] ${
                tab === item.id
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Orders */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-600">
              You have not placed any orders yet.
            </div>
          ) : (
            orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <p className="font-mono-num text-sm font-bold text-[#141619]">
                      {ord.orderRef}
                    </p>
                    <p className="text-xs text-gray-500">
                      Placed {formatShortDate(ord.createdAt)} · {ord.deliveryCity}, {ord.deliveryState}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold text-[#141619]">
                      Order: {ord.orderStatus.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    <p className="text-gray-600">
                      Payment: {ord.paymentStatus.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {ord.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between gap-4">
                      <span className="text-gray-700">
                        {it.name} × {it.quantity}
                      </span>
                      <span className="font-mono-num font-semibold">
                        {formatNgn(it.lineTotalNgn)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Total: </span>
                    <span className="font-mono-num font-extrabold text-[#141619]">
                      {formatNgn(ord.totalNgn)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({ord.freeShippingApplied ? 'Free Ibadan Shipping' : `Shipping: ${formatNgn(ord.shippingFeeNgn)}`})
                    </span>
                  </div>

                  {ord.orderStatus === 'processing' && (
                    <button
                      type="button"
                      onClick={() => cancelCustomerOrder(ord.id)}
                      className="px-3.5 py-1.5 border border-red-300 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      Cancel Processing Order
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Save to Buy Plans */}
      {tab === 'save_to_buy' && (
        <div className="space-y-5">
          {instMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
              {instMsg}
            </div>
          )}

          {plans.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-600">
              You have no active Save to Buy instalment plans.
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white border border-gray-200 rounded-xl p-6 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <p className="font-mono-num text-base font-bold text-[#141619]">
                      {plan.orderRef} · {plan.durationMonths}-Month Plan ({plan.interestRatePercent}% Interest)
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Status: <strong className="text-[#141619]">{plan.status.replace(/_/g, ' ').toUpperCase()}</strong>
                      {plan.extensionDaysGranted ? ` · ${plan.extensionDaysGranted}-day extension granted` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">Remaining Balance</span>
                    <span className="font-mono-num text-lg font-extrabold text-[#DC2626]">
                      {formatNgn(plan.remainingBalanceNgn)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#F8F9FA] p-4 rounded-lg border border-gray-200">
                  <div>
                    <span className="text-gray-500 block">Order Total</span>
                    <span className="font-mono-num font-bold text-[#141619]">
                      {formatNgn(plan.totalOrderNgn)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">50% Deposit</span>
                    <span className="font-mono-num font-bold text-[#141619]">
                      {formatNgn(plan.initialDepositNgn)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Verified Paid</span>
                    <span className="font-mono-num font-bold text-emerald-700">
                      {formatNgn(plan.amountPaidVerifiedNgn)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Release Status</span>
                    <span className="font-bold text-[#141619]">
                      {plan.remainingBalanceNgn <= 0 ? 'Eligible for Dispatch' : 'Held until Full Payment'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-gray-200 text-gray-500">
                      <tr>
                        <th className="py-2 pr-4">Instalment</th>
                        <th className="py-2 pr-4">Due Date</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Late Fee</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {plan.schedule.map((row) => {
                        const liveFee = lateFeesMap[`${plan.id}_${row.instalmentNumber}`] || row.lateFeeNgn || 0;
                        return (
                          <tr key={row.instalmentNumber}>
                            <td className="py-2.5 pr-4 font-semibold">
                              Month {row.instalmentNumber}
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums">
                              {formatShortDate(row.dueDateIso)}
                            </td>
                            <td className="py-2.5 pr-4 font-mono-num font-semibold">
                              {formatNgn(row.amountNgn)}
                            </td>
                            <td className="py-2.5 pr-4 font-mono-num text-red-700">
                              {liveFee > 0 ? formatNgn(liveFee) : '₦0'}
                            </td>
                            <td className="py-2.5 pr-4 font-semibold capitalize">
                              {row.status}
                            </td>
                            <td className="py-2.5 text-right">
                              {row.status !== 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePlanUploadId(plan.id);
                                    setActiveInstNum(row.instalmentNumber);
                                  }}
                                  className="px-3 py-1.5 bg-[#141619] text-white rounded-md font-semibold cursor-pointer hover:bg-[#DC2626]"
                                >
                                  Upload Receipt
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {activePlanUploadId === plan.id && (
                  <div className="border border-gray-300 rounded-xl p-4 bg-[#F8F9FA] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#141619]">
                        Pay Instalment #{activeInstNum} to {STORE_BANK_DETAILS.bankName} ({STORE_BANK_DETAILS.accountNumber} · {STORE_BANK_DETAILS.accountName})
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(STORE_BANK_DETAILS.accountNumber);
                          setCopiedAcct(true);
                          setTimeout(() => setCopiedAcct(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#141619] text-white rounded text-xs cursor-pointer"
                      >
                        {copiedAcct ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedAcct ? 'Copied' : 'Copy Account'}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Transfer Reference (Optional)"
                        value={instRef}
                        onChange={(e) => setInstRef(e.target.value)}
                        className="h-10 px-3 text-sm bg-white border border-gray-300 rounded-lg"
                      />
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={(e) => setInstFile(e.target.files?.[0] || null)}
                        className="text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#141619] file:text-white file:font-semibold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!instFile || instBusy}
                        onClick={() => handleSubmitInstalmentReceipt(plan)}
                        className="px-4 py-2 bg-[#DC2626] text-white text-xs font-semibold rounded-lg disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{instBusy ? 'Uploading...' : 'Submit Instalment Receipt'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePlanUploadId(null)}
                        className="px-4 py-2 border border-gray-300 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Payments & Receipts */}
      {tab === 'payments' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-600">
              No payment records yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F8F9FA] border-b border-gray-200 text-xs text-gray-600">
                  <tr>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((pay) => (
                    <tr key={pay.id}>
                      <td className="py-3 px-4 font-mono-num font-bold">{pay.orderRef}</td>
                      <td className="py-3 px-4 text-xs capitalize">
                        {pay.method.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 font-mono-num font-semibold">
                        {formatNgn(pay.amountNgn)}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold capitalize">
                        {pay.status.replace(/_/g, ' ')}
                        {pay.rejectionReason && (
                          <span className="block text-red-700 font-normal">
                            {pay.rejectionReason}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {pay.receiptUrl ? (
                          <a
                            href={pay.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#DC2626] font-semibold hover:underline"
                          >
                            View Receipt
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Delivery Addresses */}
      {tab === 'addresses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddAddress}
            className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-bold text-[#141619]">
              Add Delivery Address
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Label (Home, Office)"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                className="h-10 px-3 text-sm border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="Recipient Name"
                value={addrName}
                onChange={(e) => setAddrName(e.target.value)}
                className="h-10 px-3 text-sm border border-gray-300 rounded-lg"
              />
              <input
                type="tel"
                required
                placeholder="Phone Number"
                value={addrPhone}
                onChange={(e) => setAddrPhone(e.target.value)}
                className="h-10 px-3 text-sm border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="City (e.g. Ibadan)"
                value={addrCity}
                onChange={(e) => setAddrCity(e.target.value)}
                className="h-10 px-3 text-sm border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                required
                placeholder="State (e.g. Oyo)"
                value={addrState}
                onChange={(e) => setAddrState(e.target.value)}
                className="h-10 px-3 text-sm border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Landmark"
                value={addrLandmark}
                onChange={(e) => setAddrLandmark(e.target.value)}
                className="h-10 px-3 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <input
              type="text"
              required
              placeholder="Full Street Address"
              value={addrStreet}
              onChange={(e) => setAddrStreet(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={addrBusy}
              className="w-full h-10 bg-[#141619] hover:bg-[#DC2626] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Save Address</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {addresses.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-600">
                No saved delivery addresses yet.
              </div>
            ) : (
              addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4"
                >
                  <div className="text-sm space-y-1">
                    <p className="font-bold text-[#141619]">
                      {addr.label} · {addr.recipientName}
                    </p>
                    <p className="text-gray-600">
                      {addr.streetAddress}, {addr.city}, {addr.state}
                    </p>
                    <p className="text-xs text-gray-500">{addr.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteDeliveryAddress(user.uid, addr.id);
                      setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
                    }}
                    className="p-2 text-gray-400 hover:text-[#DC2626] cursor-pointer"
                    aria-label="Delete address"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Profile & Notifications */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-bold text-[#141619]">
              Customer Profile
            </h2>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={profPhone}
                onChange={(e) => setProfPhone(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Default City</label>
                <input
                  type="text"
                  value={profCity}
                  onChange={(e) => setProfCity(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Default State</label>
                <input
                  type="text"
                  value={profState}
                  onChange={(e) => setProfState(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            {profSavedMsg && (
              <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{profSavedMsg}</span>
              </p>
            )}
            <button
              type="submit"
              disabled={false}
              className="px-5 py-2.5 bg-[#DC2626] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Save Profile
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-[#141619]">
              Notifications
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500">No notifications yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <div key={n.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-[#141619]">{n.title}</p>
                      <p className="text-xs text-gray-600">{n.message}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="text-xs font-semibold text-[#DC2626] shrink-0 cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
