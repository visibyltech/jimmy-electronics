export type CategoryName =
  | 'Promotions'
  | 'Refrigerator'
  | 'Freezer'
  | 'Washing Machines'
  | 'TVs'
  | 'Audio'
  | 'ACs'
  | 'Cookers/Microwave'
  | 'Small Appliances/Fans'
  | 'Power Solution'
  | 'Furniture'
  | 'Apple'
  | 'Others';

export interface SubCategoryItem {
  id: number | string;
  name: string;
  slug: string;
  parentId: number | string;
  productCount?: number;
  sortOrder?: number;
}

export interface Product {
  id: string;
  numericId?: number;
  name: string;
  slug: string;
  sku: string;
  brand: string;
  brandId?: number;
  category: CategoryName | string;
  categories?: string[];
  subCategories?: string[];
  categoryIds?: number[];
  priceNgn: number;
  originalPriceNgn?: number;
  stockQty: number;
  nbViews?: number;
  createdAtIso?: string;
  warranty: string;
  shortDescription: string;
  description: string;
  specs?: Record<string, string>;
  images: string[];
  thumbImage?: string;
  featured: boolean;
  onPromotion: boolean;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CategoryItem {
  id: string;
  numericId?: number;
  name: CategoryName | string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
  displayOrder: number;
  subCategories?: SubCategoryItem[];
  isActive: boolean;
}

export interface BrandItem {
  id: string;
  numericId?: number;
  name: string;
  slug: string;
  tagline?: string;
  image?: string;
  productCount?: number;
  isActive: boolean;
}

export interface HomeBannerItem {
  title: string;
  description: string;
  buttonText: string;
  buttonAction: number;
  webImage: string;
  mobileImage: string;
  categoryId: number | null;
  categoryName: string | null;
  subCategoryId: number | null;
  subCategoryName: string | null;
  brandId: number | null;
  brandName: string | null;
  productId: string | null;
  productName: string | null;
  externalUrl: string | null;
}

export interface FouaniHomeLayout {
  heroBanners: HomeBannerItem[];
  shopByBrands: Array<{ id: number; name: string; image: string }>;
  spotlightProductId: string;
  categoryCards: Array<{ id: number; name: string; image: string }>;
  promoBanners3Col: HomeBannerItem[];
  brandBanners2Col: HomeBannerItem[];
  featuredProductIds: string[];
  hisenseWideBanner: HomeBannerItem | null;
  solarProductIds: string[];
  lgWideBanner: HomeBannerItem | null;
  kitchenProductIds: string[];
  sortOptions: Array<{ id: number; name: string }>;
}

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  priceNgn: number;
  image: string;
  warranty: string;
  quantity: number;
  stockQty: number;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  defaultCity?: string;
  defaultState?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeliveryAddress {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  landmark?: string;
  isDefault: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PaymentMethod = 'pay_now' | 'save_to_buy' | 'credably_bnpl';

export type OrderPaymentStatus =
  | 'awaiting_payment_verification'
  | 'deposit_pending_verification'
  | 'partially_paid'
  | 'paid_verified'
  | 'credably_pending'
  | 'credably_approved'
  | 'credably_declined'
  | 'credably_failed'
  | 'rejected';

export type OrderFulfillmentStatus =
  | 'awaiting_payment_verification'
  | 'processing'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderLineItem {
  productId: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  unitPriceNgn: number;
  quantity: number;
  lineTotalNgn: number;
  image: string;
}

export interface OrderRecord {
  id: string;
  orderRef: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  items: OrderLineItem[];
  subtotalNgn: number;
  shippingFeeNgn: number;
  freeShippingApplied: boolean;
  totalNgn: number;
  paymentMethod: PaymentMethod;
  paymentStatus: OrderPaymentStatus;
  orderStatus: OrderFulfillmentStatus;
  instalmentPlanId?: string;
  credablyReference?: string;
  credablySettlementStatus?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderRef: string;
  userId: string;
  instalmentPlanId?: string;
  instalmentNumber?: number;
  amountNgn: number;
  method: 'bank_transfer' | 'save_to_buy_deposit' | 'save_to_buy_instalment' | 'credably_bnpl';
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  referenceCode?: string;
  receiptId?: string;
  receiptUrl?: string;
  status: 'pending_verification' | 'approved' | 'rejected';
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReceiptRecord {
  id: string;
  orderId: string;
  paymentId?: string;
  userId: string;
  instalmentPlanId?: string;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/jpg' | 'image/png' | 'application/pdf';
  fileSize: number;
  cloudinaryPublicId?: string;
  fileUrl: string;
  createdAt?: unknown;
}

export interface InstalmentScheduleItem {
  instalmentNumber: number;
  dueDateIso: string;
  amountNgn: number;
  lateFeeNgn: number;
  status: 'pending' | 'submitted' | 'paid' | 'overdue';
  paidAtIso?: string;
  paymentId?: string;
}

export interface InstalmentPlanRecord {
  id: string;
  orderId: string;
  orderRef: string;
  userId: string;
  totalOrderNgn: number;
  initialDepositNgn: number;
  outstandingPrincipalNgn: number;
  durationMonths: 3 | 6 | 9 | 12;
  interestRatePercent: number;
  interestAmountNgn: number;
  totalRepaymentNgn: number;
  monthlyInstalmentNgn: number;
  amountPaidVerifiedNgn: number;
  remainingBalanceNgn: number;
  status: 'pending_application' | 'pending_deposit' | 'active' | 'completed' | 'overdue' | 'cancelled';
  adminApproved: boolean;
  extensionDaysGranted?: number;
  extensionReason?: string;
  schedule: InstalmentScheduleItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'instalment' | 'shipping' | 'system';
  relatedOrderId?: string;
  isRead: boolean;
  createdAt?: unknown;
}

export interface StoreSettings {
  ibadanFreeShippingThresholdNgn: number;
  ibadanStandardFeeNgn: number;
  lagosFeeNgn: number;
  oyoStateFeeNgn: number;
  southWestFeeNgn: number;
  otherStatesFeeNgn: number;
  deliveryTargetDays: number;
  saveToBuyRates: {
    '3': number;
    '6': number;
    '9': number;
    '12': number;
  };
  depositPercent: number;
  gracePeriodDays: number;
  weeklyLateFeePercent: number;
  maxLateFeePercent: number;
  updatedAt?: unknown;
}

export interface SaveToBuyCalculation {
  totalOrderNgn: number;
  initialDepositNgn: number;
  outstandingPrincipalNgn: number;
  durationMonths: 3 | 6 | 9 | 12;
  interestRatePercent: number;
  interestAmountNgn: number;
  totalRepaymentNgn: number;
  monthlyInstalmentNgn: number;
  schedule: InstalmentScheduleItem[];
}

export interface ShippingCalculation {
  city: string;
  state: string;
  subtotalNgn: number;
  freeShippingApplied: boolean;
  shippingFeeNgn: number;
  totalNgn: number;
  reason: string;
  deliveryTargetDays: number;
}
