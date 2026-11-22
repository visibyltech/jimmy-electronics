import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_STORE_SETTINGS,
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
} from '../data/seedCatalog';
import { generateDocId, slugify } from './format';
import type {
  BrandItem,
  CategoryItem,
  DeliveryAddress,
  InstalmentPlanRecord,
  NotificationRecord,
  OrderFulfillmentStatus,
  OrderRecord,
  PaymentRecord,
  Product,
  ReceiptRecord,
  StoreSettings,
  SubCategoryItem,
  UserProfile,
} from '../types';

export async function checkIsUserAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  const path = 'settings/store_config';
  try {
    const snap = await getDoc(doc(db, 'settings', 'store_config'));
    if (!snap.exists()) return DEFAULT_STORE_SETTINGS;
    return { ...DEFAULT_STORE_SETTINGS, ...(snap.data() as Partial<StoreSettings>) };
  } catch (err) {
    console.warn('Using default store settings:', err);
    return DEFAULT_STORE_SETTINGS;
  }
}

export async function saveStoreSettings(settings: Partial<StoreSettings>): Promise<void> {
  const path = 'settings/store_config';
  try {
    await setDoc(
      doc(db, 'settings', 'store_config'),
      {
        ...DEFAULT_STORE_SETTINGS,
        ...settings,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeCatalogProducts(
  onData: (products: Product[]) => void
): Unsubscribe {
  const path = 'products';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(SEED_PRODUCTS);
        return;
      }
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function seedFullCatalogToFirestore(): Promise<{
  productsCount: number;
  categoriesCount: number;
  brandsCount: number;
}> {
  try {
    const batch1 = writeBatch(db);
    for (const cat of SEED_CATEGORIES) {
      batch1.set(doc(db, 'categories', cat.id), {
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        ...(cat.image ? { image: cat.image.slice(0, 600) } : {}),
        ...(typeof cat.productCount === 'number' ? { productCount: cat.productCount } : {}),
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const brand of SEED_BRANDS) {
      batch1.set(doc(db, 'brands', brand.id), {
        name: brand.name,
        slug: brand.slug,
        tagline: brand.tagline || '',
        ...(brand.image ? { image: brand.image.slice(0, 600) } : {}),
        ...(typeof brand.productCount === 'number' ? { productCount: brand.productCount } : {}),
        isActive: brand.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    batch1.set(doc(db, 'settings', 'store_config'), {
      ...DEFAULT_STORE_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    await batch1.commit();

    // Products in batches of 100 (827 products = 9 commits)
    const chunkSize = 100;
    for (let i = 0; i < SEED_PRODUCTS.length; i += chunkSize) {
      const pBatch = writeBatch(db);
      const chunk = SEED_PRODUCTS.slice(i, i + chunkSize);
      for (const p of chunk) {
        pBatch.set(doc(db, 'products', p.id), {
          name: p.name.slice(0, 220),
          slug: slugify(p.slug || p.name).slice(0, 220) || p.id,
          sku: p.sku.slice(0, 64),
          brand: p.brand.slice(0, 80),
          category: p.category.slice(0, 80),
          ...(p.categories?.length ? { categories: p.categories.slice(0, 15) } : {}),
          ...(p.subCategories?.length ? { subCategories: p.subCategories.slice(0, 20) } : {}),
          priceNgn: Math.max(1, Number(p.priceNgn)),
          ...(p.originalPriceNgn ? { originalPriceNgn: Number(p.originalPriceNgn) } : {}),
          stockQty: Math.max(0, Number(p.stockQty)),
          ...(typeof p.nbViews === 'number' ? { nbViews: p.nbViews } : {}),
          warranty: p.warranty.slice(0, 140),
          shortDescription: p.shortDescription.slice(0, 340),
          description: p.description.slice(0, 4500),
          specs: p.specs || {},
          images: (p.images.length ? p.images : ['']).filter(Boolean).slice(0, 8),
          ...(p.thumbImage ? { thumbImage: p.thumbImage.slice(0, 600) } : {}),
          ...(p.createdAtIso ? { createdAtIso: p.createdAtIso.slice(0, 64) } : {}),
          featured: Boolean(p.featured),
          onPromotion: Boolean(p.onPromotion),
          isActive: Boolean(p.isActive),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await pBatch.commit();
    }

    return {
      productsCount: SEED_PRODUCTS.length,
      categoriesCount: SEED_CATEGORIES.length,
      brandsCount: SEED_BRANDS.length,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'products');
  }
}

export async function upsertProduct(product: Omit<Product, 'id'> & { id?: string }): Promise<string> {
  const id = product.id || generateDocId('prod');
  const path = `products/${id}`;
  const isNew = !product.id;
  try {
    const cleanSlug = slugify(product.slug || product.name).slice(0, 220) || id;
    const payload: Record<string, unknown> = {
      name: product.name.trim().slice(0, 220),
      slug: cleanSlug,
      sku: product.sku.trim().slice(0, 64),
      brand: product.brand.trim().slice(0, 80),
      category: product.category.trim().slice(0, 80),
      ...(product.categories?.length ? { categories: product.categories.slice(0, 15) } : {}),
      ...(product.subCategories?.length ? { subCategories: product.subCategories.slice(0, 20) } : {}),
      priceNgn: Math.max(1, Number(product.priceNgn)),
      stockQty: Math.max(0, Math.floor(Number(product.stockQty))),
      warranty: product.warranty.trim().slice(0, 140),
      shortDescription: product.shortDescription.trim().slice(0, 340),
      description: product.description.trim().slice(0, 4500),
      specs: product.specs || {},
      images: (product.images || []).filter(Boolean).slice(0, 8),
      featured: Boolean(product.featured),
      onPromotion: Boolean(product.onPromotion),
      isActive: Boolean(product.isActive),
      updatedAt: serverTimestamp(),
    };
    if (product.originalPriceNgn && Number(product.originalPriceNgn) > 0) {
      payload.originalPriceNgn = Number(product.originalPriceNgn);
    }
    if (isNew) {
      payload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'products', id), payload);
    } else {
      const existingSnap = await getDoc(doc(db, 'products', id));
      if (!existingSnap.exists()) {
        payload.createdAt = serverTimestamp();
        await setDoc(doc(db, 'products', id), payload);
      } else {
        await updateDoc(doc(db, 'products', id), payload);
      }
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteProductById(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function bulkImportProductsToFirestore(
  items: Array<Omit<Product, 'id'>>
): Promise<number> {
  try {
    let imported = 0;
    const chunkSize = 100;
    for (let i = 0; i < items.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + chunkSize);
      for (const item of chunk) {
        const id = generateDocId('prod');
        batch.set(doc(db, 'products', id), {
          name: item.name.trim().slice(0, 220),
          slug: slugify(item.slug || item.name).slice(0, 220) || id,
          sku: item.sku.trim().slice(0, 64),
          brand: item.brand.trim().slice(0, 80),
          category: item.category.trim().slice(0, 80),
          priceNgn: Math.max(1, Number(item.priceNgn)),
          ...(item.originalPriceNgn && item.originalPriceNgn > 0
            ? { originalPriceNgn: Number(item.originalPriceNgn) }
            : {}),
          stockQty: Math.max(0, Math.floor(Number(item.stockQty))),
          warranty: (item.warranty || 'Official Manufacturer Warranty').slice(0, 140),
          shortDescription: (item.shortDescription || item.name).slice(0, 340),
          description: (item.description || item.shortDescription || item.name).slice(0, 4500),
          specs: item.specs || {},
          images: (item.images?.length ? item.images : ['/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png']).slice(0, 8),
          featured: Boolean(item.featured),
          onPromotion: Boolean(item.onPromotion),
          isActive: item.isActive !== false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        imported++;
      }
      await batch.commit();
    }
    return imported;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'products');
  }
}

// User Profiles & Delivery Addresses
export async function ensureUserProfile(profile: {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
}): Promise<UserProfile> {
  const path = `users/${profile.uid}`;
  try {
    const ref = doc(db, 'users', profile.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const data = {
        uid: profile.uid,
        fullName: profile.fullName.trim().slice(0, 120) || 'Valued Customer',
        email: profile.email.trim().slice(0, 160),
        phone: (profile.phone || '').trim().slice(0, 32),
        defaultCity: 'Ibadan',
        defaultState: 'Oyo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, data);
      return data;
    }
    return snap.data() as UserProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: { fullName: string; phone: string; defaultCity: string; defaultState: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      fullName: updates.fullName.trim().slice(0, 120),
      phone: updates.phone.trim().slice(0, 32),
      defaultCity: updates.defaultCity.trim().slice(0, 80),
      defaultState: updates.defaultState.trim().slice(0, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchUserAddresses(uid: string): Promise<DeliveryAddress[]> {
  const path = `users/${uid}/addresses`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'addresses'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeliveryAddress, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveDeliveryAddress(
  uid: string,
  address: Omit<DeliveryAddress, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  const id = address.id || generateDocId('addr');
  const path = `users/${uid}/addresses/${id}`;
  try {
    const ref = doc(db, 'users', uid, 'addresses', id);
    const snap = await getDoc(ref);
    const payload = {
      userId: uid,
      label: address.label.trim().slice(0, 60),
      recipientName: address.recipientName.trim().slice(0, 120),
      phone: address.phone.trim().slice(0, 32),
      streetAddress: address.streetAddress.trim().slice(0, 250),
      city: address.city.trim().slice(0, 80),
      state: address.state.trim().slice(0, 80),
      landmark: (address.landmark || '').trim().slice(0, 160),
      isDefault: Boolean(address.isDefault),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
    } else {
      await updateDoc(ref, payload);
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteDeliveryAddress(uid: string, addressId: string): Promise<void> {
  const path = `users/${uid}/addresses/${addressId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'addresses', addressId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Orders, Payments, Receipts, Instalment Plans, Notifications
export async function createOrderBundle(params: {
  order: Omit<OrderRecord, 'createdAt' | 'updatedAt'>;
  payment?: Omit<PaymentRecord, 'createdAt' | 'updatedAt'>;
  receipt?: Omit<ReceiptRecord, 'createdAt'>;
  instalmentPlan?: Omit<InstalmentPlanRecord, 'createdAt' | 'updatedAt'>;
  notification?: Omit<NotificationRecord, 'createdAt'>;
}): Promise<void> {
  const orderPath = `orders/${params.order.id}`;
  try {
    await setDoc(doc(db, 'orders', params.order.id), {
      ...params.order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.instalmentPlan) {
      await setDoc(doc(db, 'instalment_plans', params.instalmentPlan.id), {
        ...params.instalmentPlan,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (params.receipt) {
      await setDoc(doc(db, 'receipts', params.receipt.id), {
        ...params.receipt,
        createdAt: serverTimestamp(),
      });
    }

    if (params.payment) {
      await setDoc(doc(db, 'payments', params.payment.id), {
        ...params.payment,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (params.notification) {
      await setDoc(doc(db, 'notifications', params.notification.id), {
        ...params.notification,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, orderPath);
  }
}

export async function submitInstalmentPayment(params: {
  payment: Omit<PaymentRecord, 'createdAt' | 'updatedAt'>;
  receipt: Omit<ReceiptRecord, 'createdAt'>;
  notification: Omit<NotificationRecord, 'createdAt'>;
}): Promise<void> {
  const path = `payments/${params.payment.id}`;
  try {
    await setDoc(doc(db, 'receipts', params.receipt.id), {
      ...params.receipt,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'payments', params.payment.id), {
      ...params.payment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'notifications', params.notification.id), {
      ...params.notification,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function cancelCustomerOrder(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      orderStatus: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Subscriptions for User Dashboard
export function subscribeUserOrders(uid: string, onData: (orders: OrderRecord[]) => void): Unsubscribe {
  const path = 'orders';
  const q = query(collection(db, path), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeUserPayments(uid: string, onData: (payments: PaymentRecord[]) => void): Unsubscribe {
  const path = 'payments';
  const q = query(collection(db, path), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeUserInstalmentPlans(
  uid: string,
  onData: (plans: InstalmentPlanRecord[]) => void
): Unsubscribe {
  const path = 'instalment_plans';
  const q = query(collection(db, path), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InstalmentPlanRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeUserNotifications(
  uid: string,
  onData: (items: NotificationRecord[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, path), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

// Admin Subscriptions & Actions
export function subscribeAllOrders(onData: (orders: OrderRecord[]) => void): Unsubscribe {
  const path = 'orders';
  return onSnapshot(
    collection(db, path),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderRecord, 'id'>) }))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllPayments(onData: (payments: PaymentRecord[]) => void): Unsubscribe {
  const path = 'payments';
  return onSnapshot(
    collection(db, path),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) }))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllReceipts(onData: (receipts: ReceiptRecord[]) => void): Unsubscribe {
  const path = 'receipts';
  return onSnapshot(
    collection(db, path),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReceiptRecord, 'id'>) }))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllInstalmentPlans(
  onData: (plans: InstalmentPlanRecord[]) => void
): Unsubscribe {
  const path = 'instalment_plans';
  return onSnapshot(
    collection(db, path),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InstalmentPlanRecord, 'id'>) }))),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllCustomers(onData: (users: UserProfile[]) => void): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snap) => onData(snap.docs.map((d) => d.data() as UserProfile)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function adminVerifyPayment(params: {
  payment: PaymentRecord;
  order: OrderRecord;
  plan?: InstalmentPlanRecord;
  action: 'approved' | 'rejected';
  adminUid: string;
  rejectionReason?: string;
}): Promise<void> {
  try {
    const { payment, order, plan, action, adminUid, rejectionReason } = params;

    await updateDoc(doc(db, 'payments', payment.id), {
      status: action,
      verifiedBy: adminUid,
      ...(action === 'rejected' && rejectionReason ? { rejectionReason } : {}),
      updatedAt: serverTimestamp(),
    });

    if (action === 'approved') {
      if (order.paymentMethod === 'pay_now') {
        await updateDoc(doc(db, 'orders', order.id), {
          paymentStatus: 'paid_verified',
          orderStatus: order.orderStatus === 'awaiting_payment_verification' ? 'processing' : order.orderStatus,
          updatedAt: serverTimestamp(),
        });
      } else if (order.paymentMethod === 'save_to_buy' && plan) {
        const newPaid = plan.amountPaidVerifiedNgn + payment.amountNgn;
        const totalExpected = plan.initialDepositNgn + plan.totalRepaymentNgn;
        const newRemaining = Math.max(0, totalExpected - newPaid);
        const isCompleted = newRemaining <= 0;

        const updatedSchedule = plan.schedule.map((item) => {
          if (payment.instalmentNumber && item.instalmentNumber === payment.instalmentNumber) {
            return {
              ...item,
              status: 'paid' as const,
              paidAtIso: new Date().toISOString(),
              paymentId: payment.id,
            };
          }
          return item;
        });

        await updateDoc(doc(db, 'instalment_plans', plan.id), {
          amountPaidVerifiedNgn: newPaid,
          remainingBalanceNgn: newRemaining,
          adminApproved: true,
          status: isCompleted ? 'completed' : 'active',
          schedule: updatedSchedule,
          updatedAt: serverTimestamp(),
        });

        // Do NOT release products for delivery until full payment is verified!
        await updateDoc(doc(db, 'orders', order.id), {
          paymentStatus: isCompleted ? 'paid_verified' : 'partially_paid',
          orderStatus: isCompleted ? 'processing' : 'awaiting_payment_verification',
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // Rejected transfer
      if (order.paymentMethod === 'pay_now') {
        await updateDoc(doc(db, 'orders', order.id), {
          paymentStatus: 'rejected',
          updatedAt: serverTimestamp(),
        });
      }
    }

    await setDoc(doc(db, 'notifications', generateDocId('notif')), {
      userId: order.userId,
      title: action === 'approved' ? `Payment Verified (${order.orderRef})` : `Payment Verification Rejected (${order.orderRef})`,
      message:
        action === 'approved'
          ? `Your payment of ₦${payment.amountNgn.toLocaleString('en-NG')} has been verified by MIND J-E MULTI CONCEPT.`
          : `Your payment of ₦${payment.amountNgn.toLocaleString('en-NG')} was not verified: ${rejectionReason || 'Receipt mismatch'}.`,
      type: 'payment',
      relatedOrderId: order.id,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `payments/${params.payment.id}`);
  }
}

export async function adminUpdateOrderStatus(
  order: OrderRecord,
  newStatus: OrderFulfillmentStatus
): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    await updateDoc(doc(db, 'orders', order.id), {
      orderStatus: newStatus,
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'notifications', generateDocId('notif')), {
      userId: order.userId,
      title: `Order ${order.orderRef} Status Updated`,
      message: `Your order status is now: ${newStatus.replace(/_/g, ' ').toUpperCase()}.`,
      type: 'shipping',
      relatedOrderId: order.id,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminManageInstalmentPlan(
  plan: InstalmentPlanRecord,
  updates: {
    adminApproved?: boolean;
    status?: InstalmentPlanRecord['status'];
    extensionDaysGranted?: number;
    extensionReason?: string;
  }
): Promise<void> {
  const path = `instalment_plans/${plan.id}`;
  try {
    await updateDoc(doc(db, 'instalment_plans', plan.id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'notifications', generateDocId('notif')), {
      userId: plan.userId,
      title: `Save to Buy Plan Updated (${plan.orderRef})`,
      message: updates.extensionDaysGranted
        ? `An administrator granted a ${updates.extensionDaysGranted}-day extension on your Save to Buy schedule.`
        : `Your Save to Buy plan status is now ${updates.status || plan.status}.`,
      type: 'instalment',
      relatedOrderId: plan.orderId,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchAllCategories(): Promise<CategoryItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('displayOrder', 'asc')));
    if (snap.empty) return SEED_CATEGORIES;
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CategoryItem, 'id'>) }));
  } catch {
    return SEED_CATEGORIES;
  }
}

export async function fetchAllBrands(): Promise<BrandItem[]> {
  try {
    const snap = await getDocs(collection(db, 'brands'));
    if (snap.empty) return SEED_BRANDS;
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BrandItem, 'id'>) }));
  } catch {
    return SEED_BRANDS;
  }
}


export async function createStoreSubCategory(categoryId: string, name: string): Promise<SubCategoryItem> {
  const cleanName = name.trim().slice(0, 80);
  if (!categoryId || !cleanName) throw new Error('Choose a category and enter a subcategory name.');
  const categoryRef = doc(db, 'categories', categoryId);
  const categorySnap = await getDoc(categoryRef);
  if (!categorySnap.exists()) throw new Error('The selected category could not be found.');
  const current = (categorySnap.data().subCategories || []) as SubCategoryItem[];
  if (current.some((item) => item.name.toLowerCase() === cleanName.toLowerCase())) throw new Error('That subcategory already exists in this category.');
  const item: SubCategoryItem = { id: Date.now(), name: cleanName, slug: slugify(cleanName), parentId: categorySnap.data().numericId || categoryId, sortOrder: current.length + 1 };
  try {
    await updateDoc(categoryRef, { subCategories: arrayUnion(item), updatedAt: serverTimestamp() });
    return item;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `categories/${categoryId}`);
  }
}

export async function createStoreBrand(name: string): Promise<BrandItem> {
  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) throw new Error('Enter a brand name.');
  const slug = slugify(cleanName);
  const id = `custom-${slug}`;
  const brand: Omit<BrandItem, 'id'> = { name: cleanName, slug, isActive: true, productCount: 0 };
  try {
    await setDoc(doc(db, 'brands', id), { ...brand, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { id, ...brand };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `brands/${id}`);
  }
}


export async function createStoreCategory(name: string): Promise<CategoryItem> {
  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) throw new Error('Enter a category name.');
  const slug = slugify(cleanName);
  const id = `custom-${slug}`;
  const category: Omit<CategoryItem, 'id'> = {
    name: cleanName,
    slug,
    description: '',
    displayOrder: Date.now(),
    isActive: true,
    productCount: 0,
  };
  try {
    await setDoc(doc(db, 'categories', id), {
      ...category,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, ...category };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `categories/${id}`);
  }
}
