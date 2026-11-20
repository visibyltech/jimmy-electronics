import React, { useMemo, useState, useEffect } from 'react';
import { SlidersHorizontal, Search, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import {
  SEED_BRANDS,
  SEED_CATEGORIES,
  productMatchesCategory,
} from '../data/seedCatalog';
import { formatNgn } from '../lib/format';
import { ProductCard } from './ProductCard';
import type { Product } from '../types';

interface CatalogPageProps {
  products: Product[];
  initialCategory?: string;
  initialSubCategory?: string;
  initialBrand?: string;
  initialPromoOnly?: boolean;
  initialSearch?: string;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

const PAGE_SIZE = 25;

type SortKey =
  | 'default'
  | 'popularity'
  | 'recent'
  | 'price_asc'
  | 'price_desc'
  | 'name_asc'
  | 'name_desc'
  | 'promo_first';

export const CatalogPage: React.FC<CatalogPageProps> = ({
  products,
  initialCategory,
  initialSubCategory,
  initialBrand,
  initialPromoOnly,
  initialSearch,
  onSelectProduct,
  onAddToCart,
}) => {
  const [search, setSearch] = useState(initialSearch || '');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubCategory || 'ALL');
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    initialBrand ? [initialBrand] : []
  );
  const [brandSearch, setBrandSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [promoOnly, setPromoOnly] = useState(Boolean(initialPromoOnly));
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('default');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setSelectedCategory(initialCategory || 'ALL');
    setSelectedSubCategory(initialSubCategory || 'ALL');
    setSelectedBrands(initialBrand ? [initialBrand] : []);
    setPromoOnly(Boolean(initialPromoOnly));
    setSearch(initialSearch || '');
    setCurrentPage(1);
  }, [initialCategory, initialSubCategory, initialBrand, initialPromoOnly, initialSearch]);

  const activeCategoryObj = useMemo(
    () => SEED_CATEGORIES.find((c) => c.name === selectedCategory),
    [selectedCategory]
  );

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.isActive === false) continue;
      if (p.brand) counts.set(p.brand, (counts.get(p.brand) || 0) + 1);
    }
    for (const b of SEED_BRANDS) {
      if (!counts.has(b.name)) counts.set(b.name, b.productCount || 0);
    }
    const q = brandSearch.trim().toLowerCase();
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count);
  }, [products, brandSearch]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minP = minPrice ? Number(minPrice) : 0;
    const maxP = maxPrice ? Number(maxPrice) : Infinity;

    const list = products.filter((p) => {
      if (p.isActive === false) return false;
      if (!productMatchesCategory(p, selectedCategory, selectedSubCategory)) return false;
      if (
        selectedBrands.length > 0 &&
        !selectedBrands.some((b) => b.toLowerCase() === p.brand.toLowerCase())
      ) {
        return false;
      }
      if (promoOnly && !p.onPromotion) return false;
      if (inStockOnly && p.stockQty <= 0) return false;
      if (p.priceNgn < minP || p.priceNgn > maxP) return false;

      if (q) {
        const haystack = `${p.name} ${p.brand} ${p.category} ${(p.categories || []).join(' ')} ${(p.subCategories || []).join(' ')} ${p.sku} ${p.shortDescription}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'price_asc') sorted.sort((a, b) => a.priceNgn - b.priceNgn);
    else if (sortBy === 'price_desc') sorted.sort((a, b) => b.priceNgn - a.priceNgn);
    else if (sortBy === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'name_desc') sorted.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === 'popularity') sorted.sort((a, b) => (b.nbViews || 0) - (a.nbViews || 0));
    else if (sortBy === 'recent') {
      sorted.sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
    } else if (sortBy === 'promo_first') {
      sorted.sort((a, b) => Number(b.onPromotion) - Number(a.onPromotion));
    } else {
      // Default: In-stock & featured first, preserving Fouani catalogue ordering
      sorted.sort(
        (a, b) =>
          Number(b.stockQty > 0) - Number(a.stockQty > 0) ||
          Number(b.featured) - Number(a.featured)
      );
    }

    return sorted;
  }, [
    products,
    search,
    selectedCategory,
    selectedSubCategory,
    selectedBrands,
    promoOnly,
    inStockOnly,
    minPrice,
    maxPrice,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const toggleBrand = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName)
        ? prev.filter((b) => b !== brandName)
        : [...prev, brandName]
    );
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('ALL');
    setSelectedSubCategory('ALL');
    setSelectedBrands([]);
    setBrandSearch('');
    setMinPrice('');
    setMaxPrice('');
    setPromoOnly(false);
    setInStockOnly(false);
    setSortBy('default');
    setCurrentPage(1);
  };

  // Pagination page numbers with compact ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: Array<number | 'ellipsis'> = [1];
    if (safePage > 3) pages.push('ellipsis');
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }, [totalPages, safePage]);

  const headingTitle =
    selectedSubCategory !== 'ALL'
      ? `${selectedCategory} · ${selectedSubCategory}`
      : selectedCategory !== 'ALL'
        ? selectedCategory
        : selectedBrands.length === 1
          ? `${selectedBrands[0]} Products`
          : 'Shop';

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar Filters (Fouani col-span-3 structure) */}
        <aside
          className={`lg:col-span-3 bg-white border border-gray-200 rounded-2xl p-5 space-y-6 ${
            mobileFiltersOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="font-display text-base font-bold text-[#141619]">Filters</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
            >
              Clear All
            </button>
          </div>

          {/* Categories & Subcategories */}
          <div className="space-y-2">
            <span className="text-sm font-bold text-[#141619] block">Categories</span>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedSubCategory('ALL');
                  setCurrentPage(1);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#141619] text-white font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Categories ({products.length})
              </button>
              {SEED_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.name;
                return (
                  <div key={cat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setSelectedSubCategory('ALL');
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                        active
                          ? 'bg-[#DC2626] text-white font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{cat.name}</span>
                      {cat.subCategories && cat.subCategories.length > 0 && (
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${active ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>
                    {active && cat.subCategories && cat.subCategories.length > 0 && (
                      <div className="pl-3 mt-1 space-y-1 border-l-2 border-[#DC2626]/30 ml-2">
                        {cat.subCategories.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setSelectedSubCategory(
                                selectedSubCategory === sub.name ? 'ALL' : sub.name
                              );
                              setCurrentPage(1);
                            }}
                            className={`w-full text-left px-2 py-1 rounded text-[11px] cursor-pointer ${
                              selectedSubCategory === sub.name
                                ? 'bg-[#141619] text-white font-semibold'
                                : 'text-gray-600 hover:text-[#DC2626]'
                            }`}
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Brands with Search (matching Fouani "Search For Brands") */}
          <div className="space-y-2.5 border-t border-gray-100 pt-4">
            <span className="text-sm font-bold text-[#141619] block">Brands</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Search For Brands"
                className="w-full h-9 pl-8 pr-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
              />
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {availableBrands.map((b) => {
                const checked = selectedBrands.includes(b.name);
                return (
                  <label
                    key={b.name}
                    className="flex items-center justify-between text-xs text-gray-700 cursor-pointer py-0.5"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBrand(b.name)}
                        className="w-3.5 h-3.5 accent-[#DC2626]"
                      />
                      <span className={checked ? 'font-semibold text-[#141619]' : ''}>
                        {b.name}
                      </span>
                    </span>
                    <span className="text-[11px] text-gray-400 tabular-nums">{b.count}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-2.5 border-t border-gray-100 pt-4">
            <span className="text-sm font-bold text-[#141619] block">Price (₦)</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Min ₦"
                className="h-9 px-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
              />
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Max ₦"
                className="h-9 px-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#DC2626]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Under ₦250k', min: '', max: '250000' },
                { label: '₦250k–₦1M', min: '250000', max: '1000000' },
                { label: 'Above ₦2M (Free Ibadan)', min: '2000001', max: '' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setMinPrice(preset.min);
                    setMaxPrice(preset.max);
                    setCurrentPage(1);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-[#F4F5F7] hover:bg-gray-200 text-gray-800 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2.5 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={promoOnly}
                onChange={(e) => {
                  setPromoOnly(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-4 h-4 accent-[#DC2626]"
              />
              <span>Promotions Only</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-4 h-4 accent-[#DC2626]"
              />
              <span>In Stock Only</span>
            </label>
          </div>
        </aside>

        {/* Main Catalogue Grid (Fouani col-span-9) */}
        <div className="lg:col-span-9 space-y-5">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141619]">
                {headingTitle}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 tabular-nums">
                Showing {paginatedProducts.length} of {filteredProducts.length} products
                {search ? ` for "${search}"` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((v) => !v)}
                className="lg:hidden inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full text-xs font-semibold text-[#141619] cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{mobileFiltersOpen ? 'Hide Filters' : 'Filters'}</span>
              </button>

              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortKey);
                  setCurrentPage(1);
                }}
                aria-label="Order By"
                className="h-10 px-4 bg-white border border-gray-300 rounded-full text-xs sm:text-sm font-medium text-[#141619] focus:outline-none focus:border-[#DC2626]"
              >
                <option value="default">Order By: Default</option>
                <option value="popularity">Popularity</option>
                <option value="recent">Recently Added</option>
                <option value="price_asc">Price Low To High</option>
                <option value="price_desc">Price High To Low</option>
                <option value="name_asc">Alphabetically Asc</option>
                <option value="name_desc">Alphabetically Desc</option>
                <option value="promo_first">Promotions First</option>
              </select>
            </div>
          </div>

          {/* Subcategory Quick Chips when a category is selected */}
          {activeCategoryObj?.subCategories && activeCategoryObj.subCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubCategory('ALL');
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  selectedSubCategory === 'ALL'
                    ? 'bg-[#141619] text-white'
                    : 'bg-[#F4F5F7] text-gray-700 hover:bg-gray-200'
                }`}
              >
                All {activeCategoryObj.name}
              </button>
              {activeCategoryObj.subCategories.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubCategory(sub.name);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    selectedSubCategory === sub.name
                      ? 'bg-[#DC2626] text-white'
                      : 'bg-[#F4F5F7] text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}

          {/* Active Filter Pills */}
          {(selectedBrands.length > 0 || search || minPrice || maxPrice || promoOnly || inStockOnly) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#141619] text-white cursor-pointer"
                >
                  <span>Search: {search}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
              {selectedBrands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBrand(b)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#DC2626] text-white cursor-pointer"
                >
                  <span>Brand: {b}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
              {(minPrice || maxPrice) && (
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-200 text-[#141619] cursor-pointer"
                >
                  <span>
                    Price: {minPrice ? formatNgn(Number(minPrice)) : '₦0'} –{' '}
                    {maxPrice ? formatNgn(Number(maxPrice)) : 'Any'}
                  </span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* 2-col Mobile / 5-col Desktop Product Grid matching Fouani */}
          {paginatedProducts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-3">
              <h2 className="font-display text-lg font-bold text-[#141619]">
                No matching products found
              </h2>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Try clearing your keyword or adjusting the category, brand, or price filters.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-6 py-2.5 bg-[#DC2626] text-white text-sm font-semibold rounded-full hover:bg-[#B91C1C] cursor-pointer"
              >
                Show All {products.length} Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {paginatedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={onSelectProduct}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-full border border-gray-300 text-[#141619] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span key={`e-${idx}`} className="px-2 text-gray-400 text-sm">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setCurrentPage(item);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-9 h-9 rounded-full text-xs sm:text-sm font-semibold tabular-nums cursor-pointer ${
                        item === safePage
                          ? 'bg-[#DC2626] text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-full border border-gray-300 text-[#141619] disabled:opacity-40 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
