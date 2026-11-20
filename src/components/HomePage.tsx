import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, PhoneCall, ShieldCheck, Truck, CreditCard, CalendarClock } from 'lucide-react';
import { HOME_LAYOUT, STORE_CONTACT } from '../data/seedCatalog';
import { formatNgn } from '../lib/format';
import { ProductCard } from './ProductCard';
import { ResilientImage } from './ResilientImage';
import type { AppRoute } from './Header';
import type { HomeBannerItem, Product } from '../types';

interface HomePageProps {
  products: Product[];
  navigate: (next: AppRoute) => void;
  onAddToCart: (product: Product) => void;
}

interface ProductCarouselSectionProps {
  title: string;
  items: Product[];
  onViewAll?: () => void;
  onSelectProduct: (p: Product) => void;
  onAddToCart: (p: Product) => void;
}

const ProductCarouselSection: React.FC<ProductCarouselSectionProps> = ({
  title,
  items,
  onViewAll,
  onSelectProduct,
  onAddToCart,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (dir: -1 | 1) => {
    if (!scrollerRef.current) return;
    const width = scrollerRef.current.clientWidth * 0.8;
    scrollerRef.current.scrollBy({ left: dir * width, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141619]">
          {title}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs sm:text-sm font-semibold text-[#DC2626] hover:underline mr-2 cursor-pointer"
            >
              View All
            </button>
          )}
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            className="w-8 h-8 rounded-full border border-gray-300 bg-white hover:bg-[#141619] hover:text-white hover:border-[#141619] flex items-center justify-center transition-colors cursor-pointer"
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            className="w-8 h-8 rounded-full border border-gray-300 bg-white hover:bg-[#141619] hover:text-white hover:border-[#141619] flex items-center justify-center transition-colors cursor-pointer"
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-2"
      >
        {items.map((product) => (
          <div
            key={product.id}
            className="w-[47%] sm:w-[31%] md:w-[23.5%] lg:w-[19%] shrink-0 snap-start"
          >
            <ProductCard
              product={product}
              onSelect={onSelectProduct}
              onAddToCart={onAddToCart}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export const HomePage: React.FC<HomePageProps> = ({
  products,
  navigate,
  onAddToCart,
}) => {
  const [heroIndex, setHeroIndex] = useState(0);
  const promoScrollerRef = useRef<HTMLDivElement>(null);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const heroBanners = HOME_LAYOUT.heroBanners;

  useEffect(() => {
    if (heroBanners.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroBanners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroBanners.length]);

  const handleBannerClick = (b: HomeBannerItem) => {
    if (b.productId && productById.has(b.productId)) {
      navigate({ page: 'product', productId: b.productId });
      return;
    }
    if (b.brandName) {
      navigate({ page: 'catalog', brand: b.brandName });
      return;
    }
    if (b.categoryName) {
      navigate({
        page: 'catalog',
        category: b.categoryName,
        subCategory:
          b.subCategoryName && b.subCategoryName !== 'Promo ACs'
            ? b.subCategoryName
            : undefined,
        promoOnly: b.categoryName === 'Promotions' ? true : undefined,
      });
      return;
    }
    navigate({ page: 'catalog' });
  };

  // Resolve exact migrated sections from Fouani homepage widgets
  const spotlightProduct =
    productById.get(HOME_LAYOUT.spotlightProductId) ||
    products.find((p) => p.featured) ||
    products[0];

  const featuredProducts = useMemo(() => {
    const picked = HOME_LAYOUT.featuredProductIds
      .map((id) => productById.get(id))
      .filter((p): p is Product => Boolean(p && p.isActive !== false));
    return picked.length ? picked : products.filter((p) => p.featured).slice(0, 18);
  }, [HOME_LAYOUT.featuredProductIds, productById, products]);

  const solarProducts = useMemo(() => {
    const picked = HOME_LAYOUT.solarProductIds
      .map((id) => productById.get(id))
      .filter((p): p is Product => Boolean(p && p.isActive !== false));
    return picked.length
      ? picked
      : products.filter((p) => p.category === 'Power Solution').slice(0, 13);
  }, [HOME_LAYOUT.solarProductIds, productById, products]);

  const kitchenProducts = useMemo(() => {
    const picked = HOME_LAYOUT.kitchenProductIds
      .map((id) => productById.get(id))
      .filter((p): p is Product => Boolean(p && p.isActive !== false));
    return picked.length
      ? picked
      : products.filter((p) => p.category === 'Small Appliances/Fans').slice(0, 16);
  }, [HOME_LAYOUT.kitchenProductIds, productById, products]);

  const currentHero = heroBanners[heroIndex] || heroBanners[0];

  return (
    <div className="space-y-9 sm:space-y-11 pt-4 pb-8 bg-white">
      {/* 1. HERO BANNER CAROUSEL (Widget 0: 3/1 web, responsive mobile) */}
      {currentHero && (
        <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
          <div className="relative rounded-2xl overflow-hidden bg-[#141619] border border-gray-200">
            <button
              type="button"
              onClick={() => handleBannerClick(currentHero)}
              className="block w-full cursor-pointer text-left"
              aria-label={
                currentHero.brandName
                  ? `Shop ${currentHero.brandName}`
                  : currentHero.productName || 'Featured Promotion'
              }
            >
              {/* Desktop 3/1 Banner */}
              <div className="hidden lg:block w-full aspect-[3/1] relative">
                <ResilientImage
                  src={currentHero.webImage}
                  alt={currentHero.brandName || currentHero.productName || 'Featured Banner'}
                  loading="eager"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Mobile Banner */}
              <div className="block lg:hidden w-full aspect-[4/3] sm:aspect-[16/9] relative">
                <ResilientImage
                  src={currentHero.mobileImage || currentHero.webImage}
                  alt={currentHero.brandName || currentHero.productName || 'Featured Banner'}
                  loading="eager"
                  className="w-full h-full object-cover"
                />
              </div>
            </button>

            {/* Prev / Next Controls */}
            {heroBanners.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setHeroIndex((i) => (i - 1 + heroBanners.length) % heroBanners.length)
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#141619] shadow flex items-center justify-center cursor-pointer"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setHeroIndex((i) => (i + 1) % heroBanners.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#141619] shadow flex items-center justify-center cursor-pointer"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full">
                  {heroBanners.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setHeroIndex(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === heroIndex ? 'w-6 bg-[#DC2626]' : 'w-2 bg-white/70 hover:bg-white'
                      }`}
                      aria-label={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* 2. SHOP BY BRAND (Widget 1: 8 brands, aspect 1.7/1 cards matching Fouani) */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141619]">
            Shop by Brand
          </h2>
          <button
            type="button"
            onClick={() => navigate({ page: 'catalog' })}
            className="text-xs sm:text-sm font-semibold text-[#DC2626] hover:underline cursor-pointer"
          >
            All 17 Brands
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
          {HOME_LAYOUT.shopByBrands.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() => navigate({ page: 'catalog', brand: brand.name })}
              className="group aspect-[1.7/1] w-full flex items-center justify-center relative rounded-xl overflow-hidden border border-gray-200 bg-white cursor-pointer"
            >
              <ResilientImage
                src={brand.image}
                alt={brand.name}
                className="w-full h-full object-contain p-3 transition-transform duration-200 group-hover:scale-105"
              />
              <span
                className="absolute inset-0 flex items-end justify-end p-2 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(107deg, rgba(0, 0, 0, 0.00) 20%, rgba(20, 22, 25, 0.72) 100%)',
                }}
              >
                <span className="text-white text-xs sm:text-sm font-bold">{brand.name}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. SINGLE PRODUCT SPOTLIGHT (Widget 2: LG TV QNED 100 Inch QNED86A6) */}
      {spotlightProduct && (
        <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
          <div className="bg-[#F4F5F7] p-5 sm:p-8 lg:p-12 rounded-2xl grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 items-center border border-gray-200">
            <button
              type="button"
              onClick={() => navigate({ page: 'product', productId: spotlightProduct.id })}
              className="w-full aspect-square bg-white rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center p-4 cursor-pointer"
            >
              <ResilientImage
                src={spotlightProduct.images?.[0]}
                alt={spotlightProduct.name}
                className="w-full h-full object-contain"
              />
            </button>

            <div className="lg:col-span-2 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
                Featured Flagship · {spotlightProduct.brand}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141619] leading-tight">
                {spotlightProduct.name}
              </h2>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono-num text-2xl font-extrabold text-[#DC2626]">
                  {formatNgn(spotlightProduct.priceNgn)}
                </span>
                {spotlightProduct.priceNgn > 2000000 && (
                  <span className="text-xs font-semibold text-emerald-700">
                    Qualifies for Free Ibadan Delivery
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                {spotlightProduct.shortDescription}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={spotlightProduct.stockQty <= 0}
                  onClick={() => onAddToCart(spotlightProduct)}
                  className="px-6 py-2.5 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] disabled:bg-gray-400 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  {spotlightProduct.stockQty <= 0 ? 'Sold Out' : 'Add to Cart'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'product', productId: spotlightProduct.id })}
                  className="px-6 py-2.5 rounded-full border border-[#141619] text-[#141619] hover:bg-[#141619] hover:text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  View Product Details
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. CATEGORIES GRID (Widget 3: 8 Fouani visual category cards) */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141619]">
            Categories
          </h2>
          <button
            type="button"
            onClick={() => navigate({ page: 'catalog' })}
            className="text-xs sm:text-sm font-semibold text-[#DC2626] hover:underline cursor-pointer"
          >
            View All 13 Categories
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {HOME_LAYOUT.categoryCards.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() =>
                navigate({
                  page: 'catalog',
                  category: cat.name === 'Furnitures' ? 'Furniture' : cat.name,
                })
              }
              className="group aspect-[1.7/1] w-full flex items-center justify-center relative rounded-xl overflow-hidden border border-gray-200 bg-[#F4F5F7] cursor-pointer"
            >
              <ResilientImage
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <span
                className="absolute inset-0 flex items-end justify-end p-3 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(107deg, rgba(0, 0, 0, 0.00) 0%, rgba(20, 22, 25, 0.72) 100%)',
                }}
              >
                <span className="text-white font-display text-sm sm:text-base font-bold text-right">
                  {cat.name}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 5 & 6. PROMOTIONS + 3-COLUMN PROMO BANNERS (Widgets 4 & 5) */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141619]">
            Promotions
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                navigate({ page: 'catalog', category: 'Promotions', promoOnly: true })
              }
              className="text-xs sm:text-sm font-semibold text-[#DC2626] hover:underline mr-2 cursor-pointer"
            >
              All Promotions
            </button>
            <button
              type="button"
              onClick={() =>
                promoScrollerRef.current?.scrollBy({
                  left: -promoScrollerRef.current.clientWidth * 0.7,
                  behavior: 'smooth',
                })
              }
              className="w-8 h-8 rounded-full border border-gray-300 bg-white hover:bg-[#141619] hover:text-white flex items-center justify-center cursor-pointer"
              aria-label="Previous promotions"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                promoScrollerRef.current?.scrollBy({
                  left: promoScrollerRef.current.clientWidth * 0.7,
                  behavior: 'smooth',
                })
              }
              className="w-8 h-8 rounded-full border border-gray-300 bg-white hover:bg-[#141619] hover:text-white flex items-center justify-center cursor-pointer"
              aria-label="Next promotions"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={promoScrollerRef}
          className="flex gap-5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-2"
        >
          {HOME_LAYOUT.promoBanners3Col.map((banner, idx) => (
            <div
              key={`${banner.title}-${idx}`}
              className="w-[88%] sm:w-[48%] lg:w-[32%] shrink-0 snap-start bg-[#F4F5F7] rounded-2xl overflow-hidden border border-gray-200 flex flex-col justify-between"
            >
              <div>
                <div className="w-full aspect-[16/9] bg-white overflow-hidden">
                  <ResilientImage
                    src={banner.webImage}
                    alt={banner.title || 'Special Promotion'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 space-y-2">
                  <h3 className="font-display text-lg font-bold text-[#141619]">
                    {banner.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-700 leading-relaxed line-clamp-3">
                    {banner.description}
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5">
                <button
                  type="button"
                  onClick={() => handleBannerClick(banner)}
                  className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs sm:text-sm font-semibold px-6 py-2 rounded-full transition-colors cursor-pointer"
                >
                  {banner.buttonText || 'View Product'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. 2-COLUMN BRAND FEATURE BANNERS (Widget 6: Hisense & LG 16/9) */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {HOME_LAYOUT.brandBanners2Col.map((banner, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleBannerClick(banner)}
              className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-gray-200 bg-[#141619] group cursor-pointer"
            >
              <ResilientImage
                src={banner.webImage}
                alt={banner.brandName || 'Authorized Brand'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </button>
          ))}
        </div>
      </section>

      {/* 8. FEATURED PRODUCTS (Widget 7: Exact 18 migrated products) */}
      <ProductCarouselSection
        title="Featured Products"
        items={featuredProducts}
        onViewAll={() => navigate({ page: 'catalog' })}
        onSelectProduct={(p) => navigate({ page: 'product', productId: p.id })}
        onAddToCart={onAddToCart}
      />

      {/* 9. WIDE 3/1 HISENSE BANNER (Widget 8) */}
      {HOME_LAYOUT.hisenseWideBanner && (
        <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
          <button
            type="button"
            onClick={() => handleBannerClick(HOME_LAYOUT.hisenseWideBanner!)}
            className="block w-full rounded-2xl overflow-hidden border border-gray-200 cursor-pointer"
            aria-label="Explore Hisense Products"
          >
            <div className="hidden lg:block w-full aspect-[3/1]">
              <ResilientImage
                src={HOME_LAYOUT.hisenseWideBanner.webImage}
                alt="Hisense Home Appliances"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="block lg:hidden w-full aspect-[16/9]">
              <ResilientImage
                src={HOME_LAYOUT.hisenseWideBanner.mobileImage}
                alt="Hisense Home Appliances"
                className="w-full h-full object-cover"
              />
            </div>
          </button>
        </section>
      )}

      {/* 10. EXPLORE SOLAR POWER SOLUTIONS (Widget 9: Exact 13 migrated solar products) */}
      <ProductCarouselSection
        title="Explore Solar Power Solutions"
        items={solarProducts}
        onViewAll={() => navigate({ page: 'catalog', category: 'Power Solution' })}
        onSelectProduct={(p) => navigate({ page: 'product', productId: p.id })}
        onAddToCart={onAddToCart}
      />

      {/* 11. WIDE 16/9 LG BANNER (Widget 10) */}
      {HOME_LAYOUT.lgWideBanner && (
        <section className="max-w-[1440px] mx-auto px-4 lg:px-8">
          <button
            type="button"
            onClick={() => handleBannerClick(HOME_LAYOUT.lgWideBanner!)}
            className="block w-full aspect-[16/9] max-h-[540px] rounded-2xl overflow-hidden border border-gray-200 cursor-pointer"
            aria-label="Explore LG Products"
          >
            <ResilientImage
              src={HOME_LAYOUT.lgWideBanner.webImage}
              alt="LG Home Appliances"
              className="w-full h-full object-cover"
            />
          </button>
        </section>
      )}

      {/* 12. KITCHEN SMALL APPLIANCES (Widget 11: Exact 16 migrated kitchen/small appliances) */}
      <ProductCarouselSection
        title="Kitchen Small Appliances"
        items={kitchenProducts}
        onViewAll={() => navigate({ page: 'catalog', category: 'Small Appliances/Fans' })}
        onSelectProduct={(p) => navigate({ page: 'product', productId: p.id })}
        onAddToCart={onAddToCart}
      />

      {/* 13. BRAND-SAFE JIMMY ELECTRONICS ORDER ASSISTANCE & PAYMENT PILLARS BANNER */}
      <section className="max-w-[1440px] mx-auto px-4 lg:px-8 space-y-6">
        <div className="bg-[#141619] text-white rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center border border-gray-800">
          <div className="lg:col-span-8 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#EF4444]">
              {STORE_CONTACT.brandIdentity} | {STORE_CONTACT.businessName}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
              Need Assistance With an Online Order?
            </h2>
            <p className="text-sm text-gray-300 max-w-2xl leading-relaxed">
              {STORE_CONTACT.aboutDescription} Flexible checkout via Pay Now (Zenith Bank), Save to Buy (50% deposit across 3–12 months), and Credably BNPL.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-3">
            <a
              href={`https://wa.me/2349068333910?text=${encodeURIComponent(
                'Hello JIMMY ELECTRONICS | MIND J-E MULTI CONCEPT, I need assistance with an online order.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Chat {STORE_CONTACT.phoneDisplay}</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#F4F5F7] rounded-xl p-4 flex items-start gap-3">
            <Truck className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#141619]">Free Ibadan Delivery</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Exclusively within Ibadan on orders strictly above ₦2,000,000.
              </p>
            </div>
          </div>
          <div className="bg-[#F4F5F7] rounded-xl p-4 flex items-start gap-3">
            <CalendarClock className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#141619]">Save to Buy</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                50% initial deposit · 3m (0%), 6m (12%), 9m (18%), 12m (24%).
              </p>
            </div>
          </div>
          <div className="bg-[#F4F5F7] rounded-xl p-4 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#141619]">Credably BNPL & Bank Transfer</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Zenith Bank (1310307892) receipt verification or Credably BNPL.
              </p>
            </div>
          </div>
          <div className="bg-[#F4F5F7] rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#141619]">Official Warranty</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Authorized manufacturer warranty on all {products.length} appliances.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
