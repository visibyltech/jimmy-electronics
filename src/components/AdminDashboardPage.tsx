import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Package,
  ShoppingBag,
  CalendarClock,
  CreditCard,
  Truck,
  Plus,
  Trash2,
  Edit3,
  Upload,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { SEED_BRANDS, SEED_CATEGORIES } from '../data/seedCatalog';
import { formatNgn, formatShortDate, parseBulkProductsCsv, slugify } from '../lib/format';
import {
  fileToBase64,
  uploadFileToCloudinary,
  verifyCredablyTransaction,
} from '../lib/api';
import {
  adminManageInstalmentPlan,
  adminUpdateOrderStatus,
  adminVerifyPayment,
  bulkImportProductsToFirestore,
  deleteProductById,
  saveStoreSettings,
  seedFullCatalogToFirestore,
  subscribeAllCustomers,
  subscribeAllInstalmentPlans,
  subscribeAllOrders,
  subscribeAllPayments,
  subscribeAllReceipts,
  upsertProduct,
} from '../lib/firestoreService';
import { ResilientImage } from './ResilientImage';
import type {
  InstalmentPlanRecord,
  OrderFulfillmentStatus,
  OrderRecord,
  PaymentRecord,
  Product,
  ReceiptRecord,
  StoreSettings,
  UserProfile,
} from '../types';

interface AdminDashboardPageProps {
  user: User;
  products: Product[];
  storeSettings: StoreSettings;
  onSettingsUpdated: (next: StoreSettings) => void;
  initialTab?: 'analytics' | 'products' | 'orders' | 'save_to_buy' | 'credably' | 'shipping';
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  user,
  products,
  storeSettings,
  onSettingsUpdated,
  initialTab,
}) => {
  const [tab, setTab] = useState<
    'analytics' | 'products' | 'orders' | 'save_to_buy' | 'credably' | 'shipping'
  >(initialTab || 'analytics');

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [plans, setPlans] = useState<InstalmentPlanRecord[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);

  const [statusBanner, setStatusBanner] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  // Product Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pBrand, setPBrand] = useState('LG');
  const [pCategory, setPCategory] = useState<string>(SEED_CATEGORIES[0].name);
  const [pPrice, setPPrice] = useState('');
  const [pOriginalPrice, setPOriginalPrice] = useState('');
  const [pStock, setPStock] = useState('10');
  const [pWarranty, setPWarranty] = useState('2 Years Official Manufacturer Warranty');
  const [pShortDesc, setPShortDesc] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pImages, setPImages] = useState<string[]>([]);
  const [pImageUrlInput, setPImageUrlInput] = useState('');
  const [pendingProductImages, setPendingProductImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [pFeatured, setPFeatured] = useState(false);
  const [pPromo, setPPromo] = useState(false);

  // Bulk Import State
  const [bulkText, setBulkText] = useState('');
  const [bulkPreviewCount, setBulkPreviewCount] = useState<number | null>(null);

  // Rejection / Extension inputs
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [extDays, setExtDays] = useState<Record<string, string>>({});
  const [extReasons, setExtReasons] = useState<Record<string, string>>({});

  // Save to Buy Rates & Shipping Config Drafts
  const [draftSettings, setDraftSettings] = useState<StoreSettings>(storeSettings);

  useEffect(() => {
    setDraftSettings(storeSettings);
  }, [storeSettings]);

  useEffect(() => {
    const u1 = subscribeAllOrders(setOrders);
    const u2 = subscribeAllPayments(setPayments);
    const u3 = subscribeAllReceipts(setReceipts);
    const u4 = subscribeAllInstalmentPlans(setPlans);
    const u5 = subscribeAllCustomers(setCustomers);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, []);

  // Live Analytics Computed Strictly from Firestore Data
  const analytics = useMemo(() => {
    const approvedPayments = payments.filter((p) => p.status === 'approved');
    const verifiedRevenue = approvedPayments.reduce((s, p) => s + p.amountNgn, 0);
    const pendingVerifications = payments.filter((p) => p.status === 'pending_verification').length;
    const activePlans = plans.filter((pl) => pl.status === 'active' || pl.status === 'pending_deposit').length;
    const lowStockProducts = products.filter((pr) => pr.stockQty <= 5);
    return {
      verifiedRevenue,
      totalOrders: orders.length,
      totalCustomers: customers.length,
      pendingVerifications,
      activePlans,
      lowStockCount: lowStockProducts.length,
      totalProducts: products.length,
    };
  }, [payments, orders, customers, plans, products]);

  const notify = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(''), 5000);
  };

  const handleSeedCatalog = async () => {
    setBusyAction(true);
    try {
      const res = await seedFullCatalogToFirestore();
      notify(
        `Seeded ${res.productsCount} products across ${res.categoriesCount} categories and ${res.brandsCount} brands to Firestore.`
      );
    } finally {
      setBusyAction(false);
    }
  };

  const resetProductForm = () => {
    setEditingId(null);
    setPName('');
    setPSku('');
    setPBrand('LG');
    setPCategory(SEED_CATEGORIES[0].name);
    setPPrice('');
    setPOriginalPrice('');
    setPStock('10');
    setPWarranty('2 Years Official Manufacturer Warranty');
    setPShortDesc('');
    setPDesc('');
    setPImages([]);
    pendingProductImages.forEach((item) => URL.revokeObjectURL(item.preview));
    setPendingProductImages([]);
    setPImageUrlInput('');
    setPFeatured(false);
    setPPromo(false);
  };

  const loadProductForEdit = (p: Product) => {
    setEditingId(p.id);
    setPName(p.name);
    setPSku(p.sku);
    setPBrand(p.brand);
    setPCategory(p.category);
    setPPrice(String(p.priceNgn));
    setPOriginalPrice(p.originalPriceNgn ? String(p.originalPriceNgn) : '');
    setPStock(String(p.stockQty));
    setPWarranty(p.warranty);
    setPShortDesc(p.shortDescription);
    setPDesc(p.description);
    setPImages(p.images || []);
    pendingProductImages.forEach((item) => URL.revokeObjectURL(item.preview));
    setPendingProductImages([]);
    setPFeatured(p.featured);
    setPPromo(p.onPromotion);
    setTab('products');
  };

  const handleUploadProductImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);
    input.value = '';
    const available = Math.max(0, 5 - pImages.length - pendingProductImages.length);
    const selected = files.slice(0, available);
    if (files.length > available) notify('You can add up to 5 product images.');
    const valid = selected.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (valid.length !== selected.length) notify('Choose JPG, PNG or WEBP images only.');
    const additions = valid.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    if (additions.length) setPendingProductImages((prev) => [...prev, ...additions].slice(0, 5));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      const uploadedPendingImages: string[] = [];
      for (const item of pendingProductImages) {
        const base64Data = await fileToBase64(item.file);
        const res = await uploadFileToCloudinary({
          fileName: item.file.name,
          mimeType: item.file.type,
          base64Data,
          folder: 'products',
        });
        if (!res.configured || !res.url) {
          throw new Error(res.error || 'A product image could not be saved. Please try again.');
        }
        uploadedPendingImages.push(res.url);
      }
      const finalImages = [...pImages, ...uploadedPendingImages].slice(0, 5);
      if (!finalImages.length) {
        finalImages.push('/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png');
      }
      await upsertProduct({
        ...(editingId ? { id: editingId } : {}),
        name: pName,
        slug: slugify(pName),
        sku: pSku,
        brand: pBrand,
        category: pCategory,
        priceNgn: Number(pPrice),
        ...(pOriginalPrice ? { originalPriceNgn: Number(pOriginalPrice) } : {}),
        stockQty: Number(pStock),
        warranty: pWarranty,
        shortDescription: pShortDesc || pName,
        description: pDesc || pShortDesc || pName,
        images: finalImages,
        featured: pFeatured,
        onPromotion: pPromo,
        isActive: true,
      });
      notify(editingId ? 'Product updated in Firestore.' : 'New product published to Firestore.');
      resetProductForm();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Product could not be saved. Please try again.');
    } finally {
      setBusyAction(false);
    }
  };

  const parseBulkPayload = (): Array<Omit<Product, 'id'>> => {
    const trimmed = bulkText.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      const arr = JSON.parse(trimmed) as Array<Record<string, unknown>>;
      return arr.map((item) => ({
        name: String(item.name || ''),
        slug: slugify(String(item.slug || item.name || '')),
        sku: String(item.sku || `JE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`),
        brand: String(item.brand || 'LG'),
        category: String(item.category || 'Others'),
        priceNgn: Number(item.priceNgn || 100000),
        ...(item.originalPriceNgn ? { originalPriceNgn: Number(item.originalPriceNgn) } : {}),
        stockQty: Number(item.stockQty ?? 5),
        warranty: String(item.warranty || 'Official Manufacturer Warranty'),
        shortDescription: String(item.shortDescription || item.name || ''),
        description: String(item.description || item.shortDescription || item.name || ''),
        images: Array.isArray(item.images)
          ? (item.images as string[]).slice(0, 8)
          : ['/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png'],
        featured: Boolean(item.featured),
        onPromotion: Boolean(item.onPromotion),
        isActive: true,
      }));
    }

    const rows = parseBulkProductsCsv(trimmed);
    return rows.map((r) => ({
      name: r.name || '',
      slug: slugify(r.name || ''),
      sku: r.sku || `JE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      brand: r.brand || 'LG',
      category: r.category || 'Others',
      priceNgn: Number(r.priceNgn || 100000),
      ...(r.originalPriceNgn ? { originalPriceNgn: Number(r.originalPriceNgn) } : {}),
      stockQty: Number(r.stockQty || 5),
      warranty: r.warranty || 'Official Manufacturer Warranty',
      shortDescription: r.shortDescription || r.name || '',
      description: r.description || r.shortDescription || r.name || '',
      images: r.imageUrl
        ? r.imageUrl.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 8)
        : ['/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png'],
      featured: r.featured === 'true',
      onPromotion: r.onPromotion === 'true',
      isActive: true,
    }));
  };

  const handleBulkImport = async () => {
    setBusyAction(true);
    try {
      const parsed = parseBulkPayload().filter((p) => p.name && p.priceNgn > 0);
      if (parsed.length === 0) {
        notify('No valid product rows found in CSV/JSON input.');
        setBusyAction(false);
        return;
      }
      const count = await bulkImportProductsToFirestore(parsed);
      setBulkText('');
      setBulkPreviewCount(null);
      notify(`Imported ${count} products into Firestore.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bulk import failed.');
    } finally {
      setBusyAction(false);
    }
  };

  const downloadCsvTemplate = () => {
    const csv = [
      'name,sku,brand,category,priceNgn,originalPriceNgn,stockQty,warranty,shortDescription,description,imageUrl,featured,onPromotion',
      '"Hisense TV QLED 50 Inch Q6Q 4K Smart",HISTV50Q6Q,Hisense,TVs,549000,0,12,"Hisense Official Manufacturer Warranty","QLED Colour 4K Smart TV","Dolby Vision, Dolby Atmos, VIDAA Smart TV.",https://salva.ams3.cdn.digitaloceanspaces.com/production/tenants/fouani/picture/7/75be5a17-a93c-427f-863f-7239ac6800dc/image.webp,false,false',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jimmy-electronics-bulk-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      await saveStoreSettings(draftSettings);
      onSettingsUpdated(draftSettings);
      notify('Store shipping & Save to Buy settings saved to Firestore.');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-8 py-5 lg:py-8 space-y-5 lg:space-y-7">
      <div className="relative overflow-hidden bg-[#15171B] text-white rounded-2xl p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="absolute -right-12 -top-16 w-56 h-56 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
        <div className="relative min-w-0">
          <p className="text-[10px] sm:text-xs tracking-[0.18em] uppercase font-bold text-red-400">Mind J-E Multi Concept</p>
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold mt-2">Store Dashboard</h1>
          <p className="text-xs sm:text-sm text-white/60 mt-1">Overview of sales, orders and store activity</p>
        </div>
        <button type="button" disabled={busyAction} onClick={handleSeedCatalog} className="relative px-4 py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50">
          <RefreshCw className="w-4 h-4" /><span>{busyAction ? 'Syncing…' : 'Sync Product Catalogue'}</span>
        </button>
      </div>

      {statusBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900 font-medium">
          {statusBanner}
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/70">
        {(
          [
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'products', label: 'Products & Bulk Import', icon: Package },
            { id: 'orders', label: `Orders & Receipts (${analytics.pendingVerifications})`, icon: ShoppingBag },
            { id: 'save_to_buy', label: 'Save to Buy', icon: CalendarClock },
            { id: 'credably', label: 'Credably BNPL', icon: CreditCard },
            { id: 'shipping', label: 'Shipping & Rates', icon: Truck },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer min-h-[42px] transition-colors ${tab === item.id ? 'bg-[#17191D] text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Analytics */}
      {tab === 'analytics' && (
        <div className="space-y-4 lg:space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_2px_12px_rgba(15,23,42,0.035)]">
              <p className="text-xs font-semibold text-gray-500">Verified Revenue (Firestore)</p>
              <p className="font-mono-num text-2xl font-extrabold text-[#141619] mt-1">
                {formatNgn(analytics.verifiedRevenue)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500">Total Orders</p>
              <p className="font-mono-num text-2xl font-extrabold text-[#141619] mt-1">
                {analytics.totalOrders}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500">Pending Payment Verifications</p>
              <p className="font-mono-num text-2xl font-extrabold text-[#DC2626] mt-1">
                {analytics.pendingVerifications}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500">Registered Customers</p>
              <p className="font-mono-num text-2xl font-extrabold text-[#141619] mt-1">
                {analytics.totalCustomers}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500">Active / Pending Save to Buy Plans</p>
              <p className="font-mono-num text-2xl font-extrabold text-[#141619] mt-1">
                {analytics.activePlans}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500">Low Stock Items (≤ 5 units)</p>
              <p className="font-mono-num text-2xl font-extrabold text-[#141619] mt-1">
                {analytics.lowStockCount} / {analytics.totalProducts}
              </p>
            </div>
          </div>

        </div>
      )}

      {/* 2. Products & Bulk Import */}
      {tab === 'products' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Add/Edit Form */}
            <form
              onSubmit={handleSaveProduct}
              className="lg:col-span-6 bg-white border border-gray-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-[#141619]">
                  {editingId ? 'Edit Product' : 'Add New Product'}
                </h2>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetProductForm}
                    className="text-xs font-semibold text-[#DC2626] cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={pSku}
                    onChange={(e) => setPSku(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Brand *</label>
                  <select
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-gray-300 rounded-lg"
                  >
                    {SEED_BRANDS.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-gray-300 rounded-lg"
                  >
                    {SEED_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Price (₦) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Original Price (₦, Optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pOriginalPrice}
                    onChange={(e) => setPOriginalPrice(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Warranty *</label>
                <input
                  type="text"
                  required
                  value={pWarranty}
                  onChange={(e) => setPWarranty(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Short Summary</label>
                <input
                  type="text"
                  value={pShortDesc}
                  onChange={(e) => setPShortDesc(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Description</label>
                <textarea
                  rows={3}
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  className="w-full p-3 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              {/* Up to 5 Product Images */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">
                  Product Images (Up to 5 · {pImages.length}/5 added)
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="px-3 py-2 bg-[#141619] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Images</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={pImages.length + pendingProductImages.length >= 5}
                      onChange={handleUploadProductImage}
                      className="sr-only"
                    />
                  </label>
                  <div className="flex-1 flex gap-1.5 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Or paste image link"
                      value={pImageUrlInput}
                      onChange={(e) => setPImageUrlInput(e.target.value)}
                      className="flex-1 h-9 px-3 text-xs border border-gray-300 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={!pImageUrlInput.trim() || pImages.length + pendingProductImages.length >= 5}
                      onClick={() => {
                        setPImages((prev) => [...prev, pImageUrlInput.trim()].slice(0, 5));
                        setPImageUrlInput('');
                      }}
                      className="px-3 h-9 bg-gray-200 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
                {(pImages.length > 0 || pendingProductImages.length > 0) && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                    {pImages.map((img, i) => (
                      <div key={i} className="relative border border-gray-200 rounded-xl p-1.5 bg-white">
                        <ResilientImage src={img} alt={`Product image ${i + 1} preview`} className="w-full h-20 object-contain" />
                        <button
                          type="button"
                          aria-label={`Remove product image ${i + 1}`}
                          onClick={() => setPImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-6 h-6 text-xs font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {pendingProductImages.map((item, i) => (
                      <div key={item.preview} className="relative border border-gray-200 rounded-xl p-1.5 bg-white">
                        <img src={item.preview} alt={`Selected product image ${i + 1}`} className="w-full h-20 object-contain" />
                        <button
                          type="button"
                          aria-label={`Remove selected image ${i + 1}`}
                          onClick={() => {
                            URL.revokeObjectURL(item.preview);
                            setPendingProductImages((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-6 h-6 text-xs font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6 text-xs font-medium">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pFeatured}
                    onChange={(e) => setPFeatured(e.target.checked)}
                    className="accent-[#DC2626]"
                  />
                  <span>Featured Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pPromo}
                    onChange={(e) => setPPromo(e.target.checked)}
                    className="accent-[#DC2626]"
                  />
                  <span>On Promotion</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={busyAction}
                className="w-full py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{editingId ? 'Save Product Changes' : 'Publish Product'}</span>
              </button>
            </form>

            {/* Bulk CSV / JSON Importer */}
            <div className="lg:col-span-6 bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-[#141619]">
                  Bulk Product Import (CSV / JSON)
                </h2>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV Template</span>
                </button>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Paste CSV rows (with header row) or a JSON array of products to batch-publish items directly into Firestore.
              </p>

              <input
                type="file"
                accept=".csv,.json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const txt = await f.text();
                  setBulkText(txt);
                }}
                className="text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#141619] file:text-white file:font-semibold"
              />

              <textarea
                rows={10}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Paste CSV or JSON array here..."
                className="w-full p-3 font-mono-num text-xs border border-gray-300 rounded-lg"
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const count = parseBulkPayload().filter((p) => p.name).length;
                      setBulkPreviewCount(count);
                    } catch {
                      setBulkPreviewCount(0);
                    }
                  }}
                  className="px-4 py-2.5 border border-gray-300 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Validate Payload
                </button>
                <button
                  type="button"
                  disabled={!bulkText.trim() || busyAction}
                  onClick={handleBulkImport}
                  className="px-5 py-2.5 bg-[#141619] hover:bg-[#DC2626] text-white text-xs font-semibold rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Import Products to Catalogue
                </button>
                {bulkPreviewCount !== null && (
                  <span className="text-xs font-semibold text-gray-700">
                    {bulkPreviewCount} valid rows detected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Product Inventory Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#141619]">
                Live Catalogue Inventory ({products.length} items)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F8F9FA] border-b border-gray-200 text-xs text-gray-600">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-medium text-[#141619] max-w-xs truncate">
                        {p.name}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs text-gray-600">{p.sku}</td>
                      <td className="py-3 px-4 text-xs">{p.category}</td>
                      <td className="py-3 px-4 font-mono-num font-bold">
                        {formatNgn(p.priceNgn)}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs">{p.stockQty}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => loadProductForEdit(p)}
                          className="p-1.5 text-gray-600 hover:text-[#141619] cursor-pointer mr-1"
                          aria-label="Edit product"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProductById(p.id)}
                          className="p-1.5 text-gray-400 hover:text-[#DC2626] cursor-pointer"
                          aria-label="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Orders & Bank Verification */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-600">
              No customer orders recorded in Firestore yet.
            </div>
          ) : (
            orders.map((ord) => {
              const ordPayments = payments.filter((p) => p.orderId === ord.id);
              const ordReceipts = receipts.filter((r) => r.orderId === ord.id);
              const ordPlan = plans.find((pl) => pl.orderId === ord.id);

              return (
                <div
                  key={ord.id}
                  className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <p className="font-mono-num text-base font-bold text-[#141619]">
                        {ord.orderRef} · {ord.customerName}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {ord.customerEmail} · {ord.customerPhone} · {ord.deliveryAddress}, {ord.deliveryCity}, {ord.deliveryState}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Placed {formatShortDate(ord.createdAt)} · Method: {ord.paymentMethod.replace(/_/g, ' ')}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="font-mono-num text-lg font-extrabold text-[#141619]">
                        {formatNgn(ord.totalNgn)}
                      </span>
                      <select
                        value={ord.orderStatus}
                        onChange={(e) =>
                          adminUpdateOrderStatus(ord, e.target.value as OrderFulfillmentStatus)
                        }
                        className="h-9 px-3 text-xs font-semibold border border-gray-300 rounded-lg bg-white"
                      >
                        <option value="awaiting_payment_verification">Awaiting Payment Verification</option>
                        <option value="processing">Processing</option>
                        <option value="ready_for_dispatch">Ready for Dispatch</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  {/* Payments & Receipts Verification */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-700">
                      Bank Transfer & Payment Records ({ordPayments.length})
                    </h3>
                    {ordPayments.map((pay) => (
                      <div
                        key={pay.id}
                        className="p-4 rounded-lg bg-[#F8F9FA] border border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-[#141619]">
                            {formatNgn(pay.amountNgn)} · {pay.method.replace(/_/g, ' ')} · Status:{' '}
                            <span className="uppercase">{pay.status.replace(/_/g, ' ')}</span>
                          </p>
                          <p className="text-gray-600">
                            Ref: {pay.referenceCode || '—'} ·{' '}
                            {pay.receiptUrl ? (
                              <a
                                href={pay.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#DC2626] font-semibold underline"
                              >
                                Inspect Receipt ({ordReceipts.find((r) => r.id === pay.receiptId)?.fileName || 'File'})
                              </a>
                            ) : (
                              'No receipt attached'
                            )}
                          </p>
                        </div>

                        {pay.status === 'pending_verification' && (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              placeholder="Rejection reason (if rejecting)"
                              value={rejectReasons[pay.id] || ''}
                              onChange={(e) =>
                                setRejectReasons((prev) => ({
                                  ...prev,
                                  [pay.id]: e.target.value,
                                }))
                              }
                              className="h-9 px-3 border border-gray-300 rounded-lg bg-white text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                adminVerifyPayment({
                                  payment: pay,
                                  order: ord,
                                  plan: ordPlan,
                                  action: 'approved',
                                  adminUid: user.uid,
                                })
                              }
                              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                adminVerifyPayment({
                                  payment: pay,
                                  order: ord,
                                  plan: ordPlan,
                                  action: 'rejected',
                                  adminUid: user.uid,
                                  rejectionReason: rejectReasons[pay.id] || 'Transfer not confirmed on statement',
                                })
                              }
                              className="px-3.5 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. Save to Buy Manager */}
      {tab === 'save_to_buy' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-[#141619]">
              Active & Pending Save to Buy Instalment Plans ({plans.length})
            </h2>
            {plans.length === 0 ? (
              <p className="text-sm text-gray-500">No Save to Buy plans created yet.</p>
            ) : (
              <div className="space-y-4">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="border border-gray-200 rounded-xl p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono-num text-sm font-bold text-[#141619]">
                          {plan.orderRef} · {plan.durationMonths} Months ({plan.interestRatePercent}% int.)
                        </p>
                        <p className="text-gray-600">
                          Paid: {formatNgn(plan.amountPaidVerifiedNgn)} · Remaining:{' '}
                          <strong className="text-[#DC2626]">{formatNgn(plan.remainingBalanceNgn)}</strong> · Status:{' '}
                          <strong className="uppercase">{plan.status}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!plan.adminApproved && (
                          <button
                            type="button"
                            onClick={() =>
                              adminManageInstalmentPlan(plan, {
                                adminApproved: true,
                                status: 'active',
                              })
                            }
                            className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer"
                          >
                            Approve Plan
                          </button>
                        )}
                        <select
                          value={plan.status}
                          onChange={(e) =>
                            adminManageInstalmentPlan(plan, {
                              status: e.target.value as InstalmentPlanRecord['status'],
                            })
                          }
                          className="h-8 px-2 border border-gray-300 rounded-lg bg-white"
                        >
                          <option value="pending_application">Pending Application</option>
                          <option value="pending_deposit">Pending Deposit</option>
                          <option value="active">Active</option>
                          <option value="overdue">Overdue</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        placeholder="Extension days"
                        value={extDays[plan.id] || ''}
                        onChange={(e) =>
                          setExtDays((prev) => ({ ...prev, [plan.id]: e.target.value }))
                        }
                        className="w-32 h-8 px-2.5 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Extension reason"
                        value={extReasons[plan.id] || ''}
                        onChange={(e) =>
                          setExtReasons((prev) => ({ ...prev, [plan.id]: e.target.value }))
                        }
                        className="flex-1 min-w-[180px] h-8 px-2.5 border border-gray-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          adminManageInstalmentPlan(plan, {
                            extensionDaysGranted: Number(extDays[plan.id] || 7),
                            extensionReason: extReasons[plan.id] || 'Administrator-approved extension',
                          })
                        }
                        className="px-3 py-1.5 bg-[#141619] text-white rounded-lg font-semibold cursor-pointer"
                      >
                        Grant Extension
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Credably BNPL Monitor */}
      {tab === 'credably' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="font-display text-lg font-bold text-[#141619]">Credably BNPL Transactions</h2>
            <p className="text-xs text-gray-500 mt-1">Review customer financing applications and transaction status</p>
          </div>

          <div className="space-y-3">
            {orders.filter((o) => o.paymentMethod === 'credably_bnpl').length === 0 ? (
              <p className="text-sm text-gray-500">No Credably BNPL orders recorded yet.</p>
            ) : (
              orders
                .filter((o) => o.paymentMethod === 'credably_bnpl')
                .map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-mono-num font-bold text-[#141619]">
                        {ord.orderRef} · Ref: {ord.credablyReference || '—'}
                      </p>
                      <p className="text-gray-600">
                        {ord.customerName} · {formatNgn(ord.totalNgn)} · Payment: {ord.paymentStatus} · Settlement: {ord.credablySettlementStatus || 'pending'}
                      </p>
                    </div>
                    {ord.credablyReference && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await verifyCredablyTransaction(ord.credablyReference!);
                          notify(`Credably status for ${ord.orderRef}: ${res.status} (${res.error || 'checked'})`);
                        }}
                        className="px-3 py-1.5 bg-[#141619] text-white rounded-lg font-semibold cursor-pointer"
                      >
                        Verify Live Status
                      </button>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* 6. Shipping & Save to Buy Rate Settings */}
      {tab === 'shipping' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-gray-200 rounded-xl p-6 space-y-6"
        >
          <h2 className="font-display text-lg font-bold text-[#141619]">
            Shipping Charges & Save to Buy Interest Rates
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Ibadan Free Shipping Threshold (Strictly Above ₦)
              </label>
              <input
                type="number"
                value={draftSettings.ibadanFreeShippingThresholdNgn}
                onChange={(e) =>
                  setDraftSettings((s) => ({
                    ...s,
                    ibadanFreeShippingThresholdNgn: Number(e.target.value),
                  }))
                }
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Ibadan Standard Fee (₦)
              </label>
              <input
                type="number"
                value={draftSettings.ibadanStandardFeeNgn}
                onChange={(e) =>
                  setDraftSettings((s) => ({
                    ...s,
                    ibadanStandardFeeNgn: Number(e.target.value),
                  }))
                }
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Lagos Delivery Fee (₦)
              </label>
              <input
                type="number"
                value={draftSettings.lagosFeeNgn}
                onChange={(e) =>
                  setDraftSettings((s) => ({ ...s, lagosFeeNgn: Number(e.target.value) }))
                }
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Oyo State (Outside Ibadan) Fee (₦)
              </label>
              <input
                type="number"
                value={draftSettings.oyoStateFeeNgn}
                onChange={(e) =>
                  setDraftSettings((s) => ({ ...s, oyoStateFeeNgn: Number(e.target.value) }))
                }
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                South-West States Fee (₦)
              </label>
              <input
                type="number"
                value={draftSettings.southWestFeeNgn}
                onChange={(e) =>
                  setDraftSettings((s) => ({ ...s, southWestFeeNgn: Number(e.target.value) }))
                }
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Other Nigerian States Fee (₦)
              </label>
              <input
                type="number"
                value={draftSettings.otherStatesFeeNgn}
                onChange={(e) =>
                  setDraftSettings((s) => ({ ...s, otherStatesFeeNgn: Number(e.target.value) }))
                }
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-bold text-[#141619] mb-3">
              Save to Buy Interest Rates (% on Outstanding Balance)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(['3', '6', '9', '12'] as const).map((m) => (
                <div key={m}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {m} Months (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draftSettings.saveToBuyRates[m]}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        saveToBuyRates: {
                          ...s.saveToBuyRates,
                          [m]: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg font-mono-num"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={busyAction}
            className="px-6 py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            Save Configuration
          </button>
        </form>
      )}
    </div>
  );
};
