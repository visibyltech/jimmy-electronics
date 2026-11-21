import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Truck,
  CalendarClock,
  CreditCard,
  ShoppingCart,
  Minus,
  Plus,
  Check,
} from 'lucide-react';
import { formatNgn } from '../lib/format';
import { calculateSaveToBuyApi } from '../lib/api';
import { ProductCard } from './ProductCard';
import { ResilientImage } from './ResilientImage';
import type { Product, SaveToBuyCalculation, StoreSettings } from '../types';
import type { AppRoute } from './Header';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
  storeSettings: StoreSettings;
  navigate: (next: AppRoute) => void;
  onAddToCart: (product: Product, qty?: number) => void;
  onBuyNow: (product: Product, qty: number, method: 'pay_now' | 'save_to_buy' | 'credably_bnpl') => void;
}

interface ParsedDescription {
  features: string[];
  specifications: string[];
  otherLines: string[];
}

function parseFouaniMarkdown(raw: string): ParsedDescription {
  const lines = raw.split('\n').map((l) => l.trim());
  const features: string[] = [];
  const specifications: string[] = [];
  const otherLines: string[] = [];

  let mode: 'features' | 'specs' | 'pdfs' | 'other' = 'other';

  for (const line of lines) {
    if (!line || line === '.') continue;
    if (/^#{1,6}\s*(features|description:?)$/i.test(line)) {
      mode = 'features';
      continue;
    }
    if (/^#{1,6}\s*specifications:?$/i.test(line)) {
      mode = 'specs';
      continue;
    }
    if (/^#{1,6}\s*related pdfs:?$/i.test(line)) {
      mode = 'pdfs';
      continue;
    }
    if (mode === 'pdfs' || line.startsWith('- [')) {
      continue;
    }

    const cleaned = line.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '').trim();
    if (!cleaned) continue;

    if (mode === 'features') features.push(cleaned);
    else if (mode === 'specs') specifications.push(cleaned);
    else otherLines.push(cleaned);
  }

  return { features, specifications, otherLines };
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  allProducts,
  storeSettings,
  navigate,
  onAddToCart,
  onBuyNow,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [durationMonths, setDurationMonths] = useState<3 | 6 | 9 | 12>(3);
  const [stbPreview, setStbPreview] = useState<SaveToBuyCalculation | null>(null);

  useEffect(() => {
    setSelectedImageIdx(0);
    setQuantity(1);
  }, [product.id]);

  useEffect(() => {
    let active = true;
    const orderTotal = product.priceNgn * quantity;
    calculateSaveToBuyApi({
      totalOrderNgn: orderTotal,
      durationMonths,
      rates: storeSettings.saveToBuyRates,
      depositPercent: storeSettings.depositPercent,
    })
      .then((res) => {
        if (active) setStbPreview(res);
      })
      .catch(() => {
        // Fallback deterministic preview if backend temporarily unavailable
        const deposit = Math.round((orderTotal * storeSettings.depositPercent) / 100);
        const principal = orderTotal - deposit;
        const rate = storeSettings.saveToBuyRates[String(durationMonths) as '3' | '6' | '9' | '12'] ?? 0;
        const interest = Math.round((principal * rate) / 100);
        const totalRepay = principal + interest;
        setStbPreview({
          totalOrderNgn: orderTotal,
          initialDepositNgn: deposit,
          outstandingPrincipalNgn: principal,
          durationMonths,
          interestRatePercent: rate,
          interestAmountNgn: interest,
          totalRepaymentNgn: totalRepay,
          monthlyInstalmentNgn: Math.round(totalRepay / durationMonths),
          schedule: [],
        });
      });
    return () => {
      active = false;
    };
  }, [product.priceNgn, quantity, durationMonths, storeSettings]);

  const images = useMemo(() => {
    const list = (product.images || []).filter(Boolean);
    return list.length > 0 ? list : ['/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png'];
  }, [product.images]);

  const parsedDesc = useMemo(
    () => parseFouaniMarkdown(product.description || product.shortDescription || ''),
    [product.description, product.shortDescription]
  );

  const outOfStock = product.stockQty <= 0;
  const lineSubtotal = product.priceNgn * quantity;
  const qualifiesIbadanFree = lineSubtotal > storeSettings.ibadanFreeShippingThresholdNgn;
  const related = useMemo(
    () =>
      allProducts
        .filter((p) => p.category === product.category && p.id !== product.id && p.isActive !== false && p.stockQty > 0)
        .slice(0, 5),
    [allProducts, product.category, product.id]
  );

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <button
          type="button"
          onClick={() => navigate({ page: 'catalog', category: product.category })}
          className="inline-flex items-center gap-1.5 font-semibold text-[#141619] hover:text-[#DC2626] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{product.category}</span>
        </button>
        {product.subCategories && product.subCategories[0] && (
          <>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() =>
                navigate({
                  page: 'catalog',
                  category: product.category,
                  subCategory: product.subCategories![0],
                })
              }
              className="hover:text-[#DC2626] cursor-pointer"
            >
              {product.subCategories[0]}
            </button>
          </>
        )}
        <span aria-hidden="true">/</span>
        <button
          type="button"
          onClick={() => navigate({ page: 'catalog', brand: product.brand })}
          className="hover:text-[#DC2626] cursor-pointer"
        >
          {product.brand}
        </button>
        <span aria-hidden="true">/</span>
        <span className="font-mono-num text-gray-500">{product.sku}</span>
      </div>

      {/* Main Split Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start">
        {/* Left: Multi-Image Gallery */}
        <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-28">
          <div className="bg-white border border-gray-200 rounded-2xl aspect-square overflow-hidden flex items-center justify-center p-6 relative">
            {outOfStock && (
              <span className="absolute top-4 left-4 z-10 bg-[#141619] text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                Sold Out
              </span>
            )}
            <ResilientImage
              src={images[selectedImageIdx] || images[0]}
              alt={product.name}
              fallbackLabel={product.name}
              loading="eager"
              className="w-full h-full object-contain"
            />
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2.5">
              {images.slice(0, 6).map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`aspect-square rounded-xl border bg-white p-1.5 overflow-hidden cursor-pointer transition-colors ${
                    idx === selectedImageIdx
                      ? 'border-[#DC2626] ring-2 ring-[#DC2626]/20'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <ResilientImage
                    src={imgUrl}
                    alt={`${product.name} view ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-6 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2 border-b border-gray-100 pb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="font-bold text-[#DC2626]">{product.brand}</span>
              <span aria-hidden="true">·</span>
              <span>{product.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">Model: {product.sku}</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141619] leading-tight">
              {product.name}
            </h1>
          </div>

          {/* Price & Stock */}
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-mono-num text-3xl font-extrabold text-[#141619]">
                {formatNgn(product.priceNgn)}
              </p>
              {product.originalPriceNgn && product.originalPriceNgn > product.priceNgn && (
                <p className="font-mono-num text-sm text-gray-400 line-through mt-0.5">
                  {formatNgn(product.originalPriceNgn)}
                </p>
              )}
            </div>

            <div className="text-right">
              <span
                className={`text-sm font-semibold ${
                  outOfStock ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {outOfStock ? 'Sold Out' : 'In Stock · Ready to Order'}
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Standard delivery target: {storeSettings.deliveryTargetDays} days
              </p>
            </div>
          </div>

          {/* Quantity + Primary Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Quantity:</span>
              <div className="inline-flex items-center border border-gray-300 rounded-full">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-l-full cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-mono-num text-sm font-bold text-[#141619]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.min(Math.max(1, product.stockQty), q + 1))
                  }
                  className="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-r-full cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                disabled={outOfStock}
                onClick={() => onAddToCart(product, quantity)}
                className="py-2.5 px-2 sm:px-4 rounded-full border-2 border-[#141619] text-[#141619] hover:bg-[#141619] hover:text-white disabled:opacity-40 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{outOfStock ? 'Sold Out' : 'Add to Cart'}</span>
              </button>

              <button
                type="button"
                disabled={outOfStock}
                onClick={() => onBuyNow(product, quantity, 'pay_now')}
                className="py-2.5 px-2 sm:px-4 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-40 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer min-h-[44px]"
              >
                Buy Now (Pay Now)
              </button>
            </div>
          </div>


          {/* Warranty & Shipping Eligibility */}
          <div className="bg-[#F8F9FA] border border-gray-200 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-start gap-2.5 text-gray-800">
              <ShieldCheck className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <span>
                <strong>Warranty:</strong> {product.warranty}
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-gray-800">
              <Truck className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <span>
                {qualifiesIbadanFree
                  ? 'This order qualifies for FREE Delivery within Ibadan (strictly above ₦2,000,000).'
                  : 'Free delivery applies strictly within Ibadan on total orders above ₦2,000,000 (orders of ₦2,000,000 exact or outside Ibadan attract configurable delivery fees).'}
              </span>
            </div>
          </div>

          {/* Save to Buy Interactive Plan Preview */}
          <div className="border border-gray-200 rounded-2xl p-5 space-y-4 bg-[#FBFBFC]">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#DC2626]" />
              <h2 className="font-display text-base font-bold text-[#141619]">
                Save to Buy Instalment Plan (50% Deposit)
              </h2>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {([3, 6, 9, 12] as const).map((m) => {
                const rate = storeSettings.saveToBuyRates[String(m) as '3' | '6' | '9' | '12'];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDurationMonths(m)}
                    className={`py-2 px-2 rounded-xl border text-center cursor-pointer transition-colors ${
                      durationMonths === m
                        ? 'bg-[#141619] text-white border-[#141619]'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span className="block text-xs font-bold">{m} Months</span>
                    <span className="block text-[11px] opacity-80">{rate}% int.</span>
                  </button>
                );
              })}
            </div>

            {stbPreview && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <span className="text-gray-500 block">50% Initial Deposit</span>
                  <span className="font-mono-num text-sm font-bold text-[#141619]">
                    {formatNgn(stbPreview.initialDepositNgn)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">
                    Balance + {stbPreview.interestRatePercent}% Int.
                  </span>
                  <span className="font-mono-num text-sm font-bold text-[#141619]">
                    {formatNgn(stbPreview.totalRepaymentNgn)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-500 block">Monthly Instalment</span>
                  <span className="font-mono-num text-sm font-bold text-[#DC2626]">
                    {formatNgn(stbPreview.monthlyInstalmentNgn)} / mo
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={outOfStock}
                onClick={() => onBuyNow(product, quantity, 'save_to_buy')}
                className="py-2.5 px-4 rounded-full bg-[#141619] hover:bg-[#262A30] disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
              >
                Checkout with Save to Buy
              </button>

              <button
                type="button"
                disabled={outOfStock}
                onClick={() => onBuyNow(product, quantity, 'credably_bnpl')}
                className="py-2.5 px-4 rounded-full border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 text-[#141619] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#DC2626]" />
                <span>Apply BNPL via Credably</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features & Technical Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#141619]">
            Features & Description
          </h2>
          {parsedDesc.features.length > 0 && (
            <ul className="space-y-2 text-sm text-gray-700">
              {parsedDesc.features.map((feat, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          )}
          {parsedDesc.otherLines.length > 0 && (
            <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
              {parsedDesc.otherLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#141619]">
            Specifications
          </h2>
          <dl className="divide-y divide-gray-100 text-sm">
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-gray-500">Brand</dt>
              <dd className="font-semibold text-[#141619] text-right">{product.brand}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-gray-500">Model SKU</dt>
              <dd className="font-mono-num font-semibold text-[#141619] text-right">
                {product.sku}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-gray-500">Category</dt>
              <dd className="font-medium text-[#141619] text-right">{product.category}</dd>
            </div>
            {product.subCategories && product.subCategories.length > 0 && (
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-gray-500">Subcategory</dt>
                <dd className="font-medium text-[#141619] text-right">
                  {product.subCategories.join(', ')}
                </dd>
              </div>
            )}
            {product.specs &&
              Object.entries(product.specs).map(([k, v]) => (
                <div key={k} className="py-2.5 flex justify-between gap-4">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-[#141619] text-right">{v}</dd>
                </div>
              ))}
          </dl>

          {parsedDesc.specifications.length > 0 && (
            <ul className="space-y-1.5 pt-2 border-t border-gray-100 text-xs sm:text-sm text-gray-700">
              {parsedDesc.specifications.map((spec, i) => (
                <li key={i} className="py-1 border-b border-gray-50 last:border-b-0">
                  {spec}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-[#141619]">
            Related Products in {product.category}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                onSelect={(p) => navigate({ page: 'product', productId: p.id })}
                onAddToCart={(p) => onAddToCart(p, 1)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
